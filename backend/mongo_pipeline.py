import os
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import certifi

class MongoNativePipeline:
    def __init__(self, mongo_uri=None, db_name='cinebot', collection_name='movies_notebook'):
        self.client = MongoClient(mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017"),
                                  tls=True, tlsCAFile=certifi.where())
        self.db = self.client[db_name]
        self.coll = self.db[collection_name]
        self.model = None
        self.index_name = "movie_vector_index"  # match notebook

    # ------------------------
    def load_embedding_model(self, model_name="sentence-transformers/all-MiniLM-L6-v2"):
        print(f"🔄 Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        print("✅ Model loaded successfully")

    # ------------------------
    def embed(self, text: str):
        if not text.strip():
            return None
        vec = self.model.encode(text)
        return vec.tolist() if hasattr(vec, "tolist") else vec

    # ------------------------
    def search_similar(self, query_text, top_k=10, filters=None, top_k_raw=200):
        """Run MongoDB-native $vectorSearch with optional filters."""
        if not self.model:
            raise RuntimeError("❌ Model not loaded. Run load_embedding_model() first.")

        query_vector = self.embed(query_text)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": self.index_name,
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": top_k_raw,
                    "limit": top_k_raw
                }
            }
        ]

        # ---------- FILTER STAGE ----------
        if filters:
            match_conditions = []

            if "min_year" in filters or "max_year" in filters:
                cond = {}
                if filters.get("min_year") is not None:
                    cond["$gte"] = filters["min_year"]
                if filters.get("max_year") is not None:
                    cond["$lte"] = filters["max_year"]
                match_conditions.append({"year": cond})

            if "min_rating" in filters or "max_rating" in filters:
                cond = {}
                if filters.get("min_rating") is not None:
                    cond["$gte"] = filters["min_rating"]
                if filters.get("max_rating") is not None:
                    cond["$lte"] = filters["max_rating"]
                match_conditions.append({"rating": cond})

            if filters.get("required_genres"):
                match_conditions.append({"genres": {"$in": filters["required_genres"]}})
            if filters.get("excluded_genres"):
                match_conditions.append({"genres": {"$nin": filters["excluded_genres"]}})
            if filters.get("required_languages"):
                match_conditions.append({"languages": {"$in": filters["required_languages"]}})
            if filters.get("excluded_languages"):
                match_conditions.append({"languages": {"$nin": filters["excluded_languages"]}})
            if "min_duration" in filters or "max_duration" in filters:
                cond = {}
                if filters.get("min_duration") is not None:
                    cond["$gte"] = filters["min_duration"]
                if filters.get("max_duration") is not None:
                    cond["$lte"] = filters["max_duration"]
                match_conditions.append({"duration": cond})

            if match_conditions:
                pipeline.append({"$match": {"$and": match_conditions}})

        # ---------- PROJECTION ----------
        pipeline.append({
            "$project": {
                "_id": 0,
                "title": 1,
                "year": 1,
                "genres": 1,
                "languages": 1,
                "rating": 1,
                "duration": 1,
                "description": 1,
                "score": {"$meta": "vectorSearchScore"},
                "embedding": 1
            }
        })

        results = list(self.coll.aggregate(pipeline))
        return results[:top_k]
