import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import certifi
import requests

app = Flask(__name__)

# Configure CORS to work with Vite dev server and allow credentials properly
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS")
if FRONTEND_ORIGINS:
    allowed_origins = [o.strip() for o in FRONTEND_ORIGINS.split(",") if o.strip()]
else:
    # Default Vite dev URLs
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

CORS(
    app,
    resources={r"/*": {"origins": allowed_origins}},
    supports_credentials=True,
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
# Support both DB_NAME/COLLECTION_NAME and MONGO_DB_NAME/MONGO_COLLECTION
DB_NAME = os.getenv("DB_NAME") or os.getenv("MONGO_DB_NAME", "cinebot")
COLLECTION_NAME = os.getenv("COLLECTION_NAME") or os.getenv("MONGO_COLLECTION", "movies_notebook")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")  # optional

# Embedding configuration
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
# Default to remote embeddings on Vercel to avoid large model downloads
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER") or ("huggingface" if os.getenv("VERCEL") else "local")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# Use TLS only for Atlas (mongodb+srv) or when explicitly requested
tls_required = MONGO_URI.startswith("mongodb+srv://") or os.getenv("MONGO_TLS", "").lower() == "true"
if tls_required:
    client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
else:
    client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coll = db[COLLECTION_NAME]

print("✅ Mongo connected")

# Only load local model when explicitly requested
model = None
if EMBEDDING_PROVIDER.lower() == "local":
    print(f"🔄 Loading local embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("✅ Embedding model loaded")


def embed_text(text: str):
    """Return embedding vector for the given text using configured provider."""
    provider = (EMBEDDING_PROVIDER or "local").lower()
    if provider == "local":
        if not model:
            raise RuntimeError("Embedding model not loaded. Set EMBEDDING_PROVIDER=huggingface on Vercel or load local model.")
        vec = model.encode(text)
        return vec.tolist() if hasattr(vec, "tolist") else vec
    # Remote via Hugging Face Inference API
    if not HUGGINGFACE_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY is required for remote embeddings")
    url = f"https://api-inference.huggingface.co/models/{EMBEDDING_MODEL}"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}", "Content-Type": "application/json"}
    try:
        resp = requests.post(url, headers=headers, json={"inputs": text, "options": {"wait_for_model": True}}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        # Response can be nested [[...]]; flatten one level if needed
        if isinstance(data, list) and data and isinstance(data[0], list):
            return data[0]
        return data
    except Exception as e:
        print(f"❌ Embedding API error: {e}")
        raise


@app.after_request
def add_cors_headers(resp):
    """Ensure CORS headers are present for common methods and headers.
    Flask-CORS usually sets these, but explicitly adding avoids edge cases with preflight.
    """
    resp.headers.setdefault(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    )
    resp.headers.setdefault(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With",
    )
    return resp


@app.route("/run-groq", methods=["POST"]) 
@app.route("/api/run-groq", methods=["POST"]) 
def run_groq():
    """
    Generate structured JSON query (positive_query, negative_query, row_checker).
    Uses GROQ if key provided; otherwise returns a fallback JSON.
    """
    try:
        data = request.get_json(silent=True) or {}
        user_input = data.get("user_input") or data.get("messages") or ""
        if isinstance(user_input, list):
            # Take the latest user message content
            try:
                user_input = next(
                    (m.get("content", "") for m in reversed(user_input) if m.get("role") == "user"),
                    user_input[-1].get("content", "") if user_input else "",
                )
            except Exception:
                user_input = ""

        def make_fallback(text):
            fb = {
                "positive_query": text or "",
                "negative_query": "",
                "row_checker": {"required_genres": []},
            }
            return jsonify({"response": json.dumps(fb)})

        # No key -> fallback
        if not GROQ_API_KEY:
            return make_fallback(user_input)

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": "You are a JSON generator for movie search queries. Respond ONLY with JSON."},
                {"role": "user", "content": f"User input: {user_input}"},
            ],
            "temperature": 0.2,
        }

        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=20,
            )
        except Exception as net_err:
            print(f"⚠️ GROQ request failed: {net_err}")
            return make_fallback(user_input)

        if res.status_code != 200:
            print(f"⚠️ GROQ non-200: {res.status_code} {res.text[:200]}")
            return make_fallback(user_input)

        try:
            data = res.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content")
        except Exception as parse_err:
            print(f"⚠️ GROQ parse error: {parse_err}")
            text = None

        if not text:
            return make_fallback(user_input)
        return jsonify({"response": text})

    except Exception as e:
        print(f"❌ run_groq error: {e}")
        # Never 500 the client here; always provide a fallback response
        try:
            return jsonify({
                "response": json.dumps({
                    "positive_query": "",
                    "negative_query": "",
                    "row_checker": {"required_genres": []},
                })
            })
        except Exception:
            return jsonify({"response": "{\"positive_query\":\"\",\"negative_query\":\"\",\"row_checker\":{\"required_genres\":[]}}"})


@app.route("/search", methods=["POST"]) 
@app.route("/api/search", methods=["POST"]) 
def search_movies():
    try:
        data = request.get_json()
        query = data.get("query", "")
        filters = data.get("filters", {})
        limit = int(data.get("limit", 10))

        if not query:
            return jsonify({"results": []})

        # get query embedding
        query_vector = embed_text(query)

        pipeline = [
            {
                "$vectorSearch": {
                    "index": "movie_vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 200,
                    "limit": limit
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "id": 1,
                    "title": 1,
                    "year": 1,
                    "genres": 1,
                    "languages": 1,
                    "rating": 1,
                    "duration": 1,
                    "description": 1,
                    "score": {"$meta": "vectorSearchScore"}
                }
            }
        ]

        if filters:
            pipeline.insert(1, {"$match": filters})

        try:
            results = list(coll.aggregate(pipeline))
        except Exception as ve:
            # If $vectorSearch is unavailable (local Mongo) or index missing, fall back
            print(f"⚠️ Vector search failed, falling back to regex search: {ve}")
            results = []

        # If vector search returned nothing, try a simple regex fallback
        if not results:
            # Build a basic regex OR across words (escape special characters)
            import re
            words = [w for w in re.split(r"\s+", query) if w]
            if words:
                escaped = [re.escape(w) for w in words]
                regex = "|".join(escaped)
                match_stage = {
                    "$or": [
                        {"title": {"$regex": regex, "$options": "i"}},
                        {"description": {"$regex": regex, "$options": "i"}},
                        {"genres": {"$in": words}},
                        {"languages": {"$in": words}},
                    ]
                }

                fallback_pipeline = []
                if filters:
                    fallback_pipeline.append({"$match": filters})
                fallback_pipeline.append({"$match": match_stage})
                fallback_pipeline.append({
                    "$project": {
                        "_id": 0,
                        "id": 1,
                        "title": 1,
                        "year": 1,
                        "genres": 1,
                        "languages": 1,
                        "rating": 1,
                        "duration": 1,
                        "description": 1,
                    }
                })
                fallback_pipeline.append({"$limit": limit})
                try:
                    results = list(coll.aggregate(fallback_pipeline))
                except Exception as fe:
                    print(f"❌ Fallback search failed: {fe}")
                    results = []

        return jsonify({"results": results})

    except Exception as e:
        print(f"❌ /search error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/", methods=["GET"]) 
@app.route("/api", methods=["GET"]) 
def home():
    return jsonify({"status": "Server running"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
