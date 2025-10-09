# ---- Core Libraries ----
import os, json, re, ast, pickle, subprocess
import pandas as pd
import numpy as np
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# ---- ML Libraries ----
import faiss
from sentence_transformers import SentenceTransformer

# ---- External APIs ----
from groq import Groq
import chromadb

# ---- Setup ----
app = Flask(__name__)
CORS(app)
load_dotenv()

# ---- Global Config ----
BASE_DIR = "./faiss_embeddings1"
DEFAULT_MODEL = 'sentence-transformers/multi-qa-MiniLM-L6-cos-v1'
API_KEY = os.getenv("API_KEY")
client = Groq(api_key=API_KEY)

# ---- FAISS + Metadata ----
index = faiss.read_index(f"{BASE_DIR}/movie_index.faiss")
with open(f"{BASE_DIR}/movie_ids.pkl", "rb") as f:
    id_list = pickle.load(f)
metadata = pd.read_csv(f"{BASE_DIR}/movie_metadata.csv")
model = SentenceTransformer(DEFAULT_MODEL)

# ---- ChromaDB ----
chroma_client = chromadb.PersistentClient(path="./chromadb_client")
collection = chroma_client.get_collection(name="best_movies_database")

# ---- Model Maps ----
model_map = {
    "1": "sentence-transformers/multi-qa-MiniLM-L6-cos-v1",
    "2": "sentence-transformers/all-MiniLM-L6-v2",
    "3": "sentence-transformers/all-distilroberta-v1",
    "4": "sentence-transformers/distilbert-base-nli-stsb-mean-tokens",
    "5": "sentence-transformers/all-MiniLM-L12-v2",
    "6": "chromadb"
}
index_map = {
    "1": "./faiss_embeddings1/movie_index.faiss",
    "2": "./faiss_embeddings2/movie_index.faiss",
    "3": "./faiss_embeddings3/movie_index.faiss",
    "4": "./faiss_embeddings4/movie_index.faiss",
    "5": "./faiss_embeddings5/movie_index.faiss",
    "6": None
}
metadata_map = {
    "1": "./faiss_embeddings1/movie_metadata.csv",
    "2": "./faiss_embeddings2/movie_metadata.csv",
    "3": "./faiss_embeddings3/movie_metadata.csv",
    "4": "./faiss_embeddings4/movie_metadata.csv",
    "5": "./faiss_embeddings5/movie_metadata.csv",
    "6": None
}
id_list_map = {
    "1": "./faiss_embeddings1/movie_ids.pkl",
    "2": "./faiss_embeddings2/movie_ids.pkl",
    "3": "./faiss_embeddings3/movie_ids.pkl",
    "4": "./faiss_embeddings4/movie_ids.pkl",
    "5": "./faiss_embeddings5/movie_ids.pkl",
    "6": None
}

# ---- Utils ----
def clean_nans(obj):
    if isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nans(i) for i in obj]
    elif isinstance(obj, float) and (obj != obj):
        return None
    return obj

def metadata_filter(row, checker):
    def safe_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def safe_float(value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def safe_set(value):
        if value is None:
            return set()
        if isinstance(value, str):
            try:
                parsed = ast.literal_eval(value)
                if isinstance(parsed, (list, tuple, set)):
                    return set(map(str.lower, map(str, parsed)))
                return set()
            except Exception:
                return set()
        elif isinstance(value, (list, tuple, set)):
            return set(map(str.lower, map(str, value)))
        return set()

    # Ensure row and checker are dicts
    if not isinstance(row, dict):
        row = {}
    if not isinstance(checker, dict):
        checker = {}

    # Parse and sanitize row values
    year = safe_int(row.get("year"))
    rating = safe_float(row.get("rating"))
    duration = safe_int(row.get("duration"))
    genres = safe_set(row.get("genres"))
    languages = safe_set(row.get("languages"))

    # Checker filters with sensible defaults
    min_year = safe_int(checker.get("min_year"), default=float("-inf"))
    max_year = safe_int(checker.get("max_year"), default=float("inf"))
    min_rating = safe_float(checker.get("min_rating"), default=float("-inf"))
    max_rating = safe_float(checker.get("max_rating"), default=float("inf"))
    min_duration = safe_int(checker.get("min_duration"), default=float("-inf"))
    max_duration = safe_int(checker.get("max_duration"), default=float("inf"))
    required_genres = safe_set(checker.get("required_genres"))
    excluded_genres = safe_set(checker.get("excluded_genres"))
    required_languages = safe_set(checker.get("required_languages"))
    excluded_languages = safe_set(checker.get("excluded_languages"))

    # Apply all filters
    return (
        min_year <= year <= max_year and
        min_rating <= rating <= max_rating and
        min_duration <= duration <= max_duration and
        (not required_genres or genres & required_genres) and
        not (genres & excluded_genres) and
        (not required_languages or languages & required_languages) and
        not (languages & excluded_languages)
    )
    
def search_movies_dual_query_fast(
    positive_query,
    negative_query=None,
    top_k=10,
    search_batch_size=200,
    row_checker={},
    alpha=1.0,
    beta=1.0
):
    pos_embed = model.encode([positive_query], normalize_embeddings=True).astype("float32")
    neg_embed = model.encode([negative_query], normalize_embeddings=True).astype("float32") if negative_query else None

    D_pos, I_pos = index.search(pos_embed, search_batch_size)
    results = []

    for i, idx in enumerate(I_pos[0]):
        movie_id = id_list[idx]
        row = metadata[metadata["id"] == movie_id].iloc[0].to_dict()
        

        pos_sim = float(D_pos[0][i])
        neg_sim = float(np.dot(index.reconstruct(i), neg_embed[0])) if neg_embed is not None else 0.0
        score = alpha * pos_sim - beta * neg_sim

        if not metadata_filter(row, row_checker):
            score = -1e10 

        results.append({
            "id": movie_id,
            "positive_similarity": pos_sim,
            "negative_similarity": neg_sim,
            "score": score,
            "metadata": row
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)[:top_k]


def run_local_ollama(messages, model="gemma2:2b"):
    print("Running local Ollama model...")
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False  # change to True if you want streaming
    }

    try:
        response = requests.post(url, json=payload)
        print("Response status code:", response.status_code)
        print("Response content:", response.content)
        response.raise_for_status()  # Raise error for non-2xx responses
        return response.json()["message"]["content"]
    except requests.exceptions.RequestException as e:
        print("Request failed:", e)
        return f"Request failed: {e}"
    except KeyError:
        print("Unexpected response format:", response.text)
        return f"Unexpected response format: {response.text}"
    except exception as e:
        print("An error occurred:", e)
        return f"An error occurred: {e}"

def extract_json(text):
    print("Text to parse:", text)
    try:
        match = re.search(r"\{[\s\S]*?\}", text)
        return json.loads(match.group(0)) if match else None
    except Exception as e:
        print("JSON parse error:", e)
        return None

def query_chromadb_with_filter(query, checker, top_k=10):
    filters = []
    if "min_year" in checker or "max_year" in checker:
        c = []
        if "min_year" in checker: c.append({"year": {"$gte": checker["min_year"]}})
        if "max_year" in checker: c.append({"year": {"$lte": checker["max_year"]}})
        filters.append({"$and": c} if len(c) > 1 else c[0])
    if "min_rating" in checker or "max_rating" in checker:
        c = []
        if "min_rating" in checker: c.append({"rating": {"$gte": checker["min_rating"]}})
        if "max_rating" in checker: c.append({"rating": {"$lte": checker["max_rating"]}})
        filters.append({"$and": c} if len(c) > 1 else c[0])

    where_clause = {"$and": filters} if len(filters) > 1 else (filters[0] if filters else None)
    results = collection.query(query_texts=[query], n_results=top_k, where=where_clause) if where_clause else collection.query(query_texts=[query], n_results=top_k)
    return results

# ---- Routes ----
@app.route('/run-groq', methods=['POST'])
def run_groq():
    try:
        messages = request.get_json().get("messages", [])
        response = client.chat.completions.create(
            messages=messages, model="llama-3.3-70b-versatile", max_tokens=10000
        )
        return jsonify({"response": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/run-local-gemma', methods=['POST'])
def run_local_gemma():
    try:
        data = request.get_json()
        messages = data.get("messages", [])
        model = data.get("model", "gemma2:2b")

        # Call local Ollama
        content = run_local_ollama(messages=messages, model=model)
        print("Raw response content:", content)

        return jsonify({"response": content})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route('/advanced-query-search', methods=['POST'])
def advanced_query_search():
    data = {}  # Ensure data is always defined
    try:
        data = request.get_json()
        positive_query = data.get('positive_query')
        negative_query = data.get('negative_query')
        row_checker = data.get('row_checker', {})
        top_k = int(data.get('top_k', 10))
        batch_size = int(data.get('search_batch_size', 200))
        alpha = float(data.get('alpha', 1.0))
        beta = float(data.get('beta', 1.0))
        model_choice = data.get('model_choice', '1')

        print("Received data:", data)

        if not positive_query:
            return jsonify({"error": "positive_query is required"}), 400

        if model_choice == "6":
            return jsonify({"results": clean_nans(query_chromadb_with_filter(positive_query, row_checker, top_k)["metadatas"])})

        if model_choice not in model_map:
            return jsonify({"error": "Invalid model choice"}), 400

        global model, index, metadata, id_list
        model = SentenceTransformer(model_map[model_choice])
        index = faiss.read_index(index_map[model_choice])
        metadata = pd.read_csv(metadata_map[model_choice])
        with open(id_list_map[model_choice], "rb") as f:
            id_list = pickle.load(f)

        results = search_movies_dual_query_fast(
            positive_query=positive_query,
            negative_query=negative_query,
            top_k=top_k,
            search_batch_size=batch_size,
            row_checker=row_checker,
            alpha=alpha,
            beta=beta
        )
        return jsonify({"results": clean_nans(results)})

    except Exception as e:
        import traceback
        print("Error in /advanced-query-search:", traceback.format_exc())
        return jsonify({
            "error": str(e),
            "payload": data  # Include payload for easier debugging
        }), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
