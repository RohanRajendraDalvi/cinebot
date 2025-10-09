
# NLP-Project - Movie Chat + Semantic Search

This repository is a full-stack experimental project that demonstrates a movie-focused conversational and semantic search application. It combines a React + Vite frontend (chat UI and saved sessions), a Flask backend that exposes semantic search endpoints, and local/remote model integration (FAISS vector indices, ChromaDB, Groq API and a local Ollama/Gemma setup).

This README documents what the app does, how it looks, how to run it locally (frontend + backend), how to use the APIs, and troubleshooting tips. It is intentionally detailed so you (or a teammate) can reproduce the environment and understand how data flows through the system.

---

## Table of contents

- Project purpose (what it does)
- How the app looks (visual walkthrough)
- Architecture and data layout
- Prerequisites
- Backend: setup & running
- Frontend: setup & running
- API reference (examples)
- Using the app (how to interact with the UI)
- Troubleshooting and common fixes
- Dev notes, next steps, and contribution guidelines

---

## Project purpose (what it does)

This project provides a conversational interface and advanced semantic search over a movie dataset. Key capabilities:

- Natural language search for movies using embedding-based similarity (FAISS).
- Multiple embedding model choices (switchable at query time) with separate FAISS indices per model.
- Dual-query scoring (positive and negative queries) with tunable alpha and beta weights.
- Metadata filtering (year, rating, duration, genres, languages).
- Optional ChromaDB-backed retrieval path.
- Integration points for LLM summarization/chat: Groq API (cloud) and local Ollama/Gemma.
- A React UI for chat, model & filter controls, and saved chat sessions.

This repository is structured as a research/experimentation project. The code emphasizes modularity so you can swap vector stores, models, or ranking logic.

## How the app looks (visual walkthrough)

The frontend is a React app built with Vite and organized under `src/`. Important UI components and their responsibilities:

- `Navbar.jsx` — Global navigation linking to Intro, Chat, Documentation, About.
- `IntroPage/IntroPage.jsx` — Project landing and quickstart notes for users.
- `ChatPage/index.jsx` — Main chat page; composes the chat experience:
	- `ChatBox/` — Left/main column with chat messages and result cards.
	- `ChatDialogue/` — Renders each user/assistant message.
	- `LoadingAnimation/` — Shows when requests are in-flight.
	- `RightSidebar/` — Settings and controls (model selection, alpha/beta, filters).
	- `SavedChats/` — Save and re-open previous sessions.
	- `UserInput/` — Input box with submit and optional advanced fields.
- `AboutUs/` and `Documentation/` — Static explanatory pages with their own CSS.

Visual styling and behavior notes:

- Bootstrap is used for layout (see `package.json` dependencies). Expect a responsive two-column layout on wide screens and stacked layout on narrow screens.
- Chat messages appear chronologically; search results are shown inline or as dedicated result cards including metadata and similarity scores.

## Architecture and data layout

Top-level folders:

- `backend/` — Flask application and server logic. Main file: `backend/flask_server.py`.
- `src/` — React frontend code and components.
- `faiss_embeddings1/`...`faiss_embeddings5/` — Prebuilt FAISS index files, metadata CSVs and id lists for different embedding runs.
- `chromadb_client/` — ChromaDB persistent folder (sqlite files) used when model_choice `6` is selected.
- `python-scripts/` — Notebooks and scripts used to precompute embeddings, build FAISS indices, and debug queries.

Runtime files the server expects (ensure present):

- FAISS index files: e.g. `faiss_embeddings1/movie_index.faiss`.
- ID lists: `faiss_embeddings1/movie_ids.pkl` (pickle with ids in index order).
- Metadata CSVs: `faiss_embeddings1/movie_metadata.csv` used to attach metadata to results.
- ChromaDB folder: `chromadb_client/` with `chroma.sqlite3` and binary data blocks.

If you move the data folders, update the path mappings in `backend/flask_server.py`.

## Prerequisites

Install the following on your machine:

- Node.js + npm (Node 18+ recommended).
- Python 3.10+ (use a venv).
- pip and build tools. For FAISS, consider conda on Windows if pip wheels are problematic.
- Optional: Ollama (local) for `run-local-gemma` and a Groq API key for cloud LLM calls.

Notes about FAISS on Windows:

- The easiest path on Windows is to use conda/conda-forge: `conda install -c conda-forge faiss-cpu`.
- Alternatively, use WSL or a Linux VM if you run into wheel compatibility issues.

## Backend — setup & running (Flask)

1) Create and activate a virtual environment (PowerShell):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
```

2) Install Python dependencies:

```powershell
pip install -r backend/requirements.txt
```

3) Add environment variables

- Create a `.env` file at `backend/.env` or project root. At minimum, set `API_KEY` if you plan to use Groq:

```ini
API_KEY=your_groq_api_key_here
```

4) Confirm data files

- Verify the FAISS indices and metadata files exist under `faiss_embeddings*/` and the `chromadb_client/` directory is present if you plan to use ChromaDB.

5) Run the Flask server

```powershell
# From repo root
npm run server
# OR
python .\backend\flask_server.py
```

The Flask server binds to port 5000 by default and prints logs describing received requests. Startup will load FAISS indices and a SentenceTransformer model — expect some delay on first run.

Important runtime notes:

- The backend preloads a SentenceTransformer model and FAISS index for `BASE_DIR` (default `./faiss_embeddings1`). If those files are large, startup will take longer and memory usage will increase.
- `model_choice` in the `advanced-query-search` route maps to different index/metadata paths; `6` maps to ChromaDB.

## Frontend — setup & running (React + Vite)

1) Install node modules:

```powershell
npm install
```

2) Run the Vite dev server:

```powershell
npm run client
```

3) Open the app

- Vite will print a local URL (default `http://localhost:5173`). The frontend uses the backend API at `http://localhost:5000` by default. If you change the backend port, update the service endpoints under `src/services/`.

Build for production:

```powershell
npm run build
npm run preview
```

## API Reference (backend endpoints)

Base URL (default): `http://localhost:5000`

All endpoints accept JSON and return JSON.

1) POST /advanced-query-search

Purpose: run a semantic search using FAISS (or ChromaDB for `model_choice=6`) with optional metadata filtering and alpha/beta dual-query reweighting.

Request JSON fields:

- positive_query (string) — required
- negative_query (string) — optional
- top_k (int) — optional (default 10)
- search_batch_size (int) — optional (default 200)
- row_checker (object) — optional metadata filter (see examples below)
- alpha (float) — weight for positive similarity (default 1.0)
- beta (float) — weight for negative similarity (default 1.0)
- model_choice (string) — which index/model to use ("1".."6")

row_checker example:

```
{
	"min_year": 1990,
	"max_rating": 9.0,
	"required_genres": ["Comedy", "Family"],
	"excluded_languages": ["Hindi"]
}
```

Example (PowerShell/curl style):

```powershell
curl -X POST http://localhost:5000/advanced-query-search -H "Content-Type: application/json" -d (
	'{"positive_query":"feel-good family comedy","negative_query":"horror","top_k":5,"row_checker":{"min_year":1990,"required_genres":["Comedy","Family"]},"alpha":1.0,"beta":0.4,"model_choice":"1"}'
)
```

Response format (successful):

```
{
	"results": [
		{
			"id": 1234,
			"positive_similarity": 0.823,
			"negative_similarity": 0.120,
			"score": 0.7,
			"metadata": { /* movie metadata row */ }
		},
		...
	]
}
```

Notes:

- If a row fails metadata checks, the backend assigns it a very low score so it won't appear in the returned top_k.
- `positive_similarity` comes from the FAISS returned distances/scores; `negative_similarity` is computed internally when a negative query is provided.

2) POST /run-local-gemma

Purpose: proxy chat requests to a local Ollama/Gemma model (default URL `http://localhost:11434/api/chat`).

Request:

```
{
	"messages": [{"role":"user","content":"Summarize the top result for me"}],
	"model":"gemma2:2b"
}
```

Response:

```
{ "response": "<string>" }
```

3) POST /run-groq

Purpose: Use Groq's chat completions API (requires `API_KEY`). Send a `messages` array in the request body.

Response:

```
{ "response": "<string>" }
```

## How to use the app (user-facing guide)

1. Start backend and frontend.
2. Open `http://localhost:5173` (Vite dev URL).
3. Navigate to Chat. Enter a natural language query in the input box.
4. Optionally open the Right Sidebar and set:
	 - `model_choice` to switch FAISS indices or ChromaDB
	 - `alpha` / `beta` to change positive vs negative weighting
	 - metadata filters (year, rating, genres, languages)
5. Submit the query and inspect results in the chat flow. Use the local Gemma/Groq options to summarize or expand on specific results.

UX tips:

- Use `negative_query` when you want to explicitly penalize certain content.
- If results look noisy, try lowering `beta` or switching `model_choice`.
- Increase `search_batch_size` to scan more candidates at the cost of latency.

## Troubleshooting and common fixes

1) FAISS file not found

- Error: `No such file or directory: './faiss_embeddings1/movie_index.faiss'`
	- Ensure the `faiss_embeddings1/` folder exists and contains `movie_index.faiss`, `movie_ids.pkl`, and `movie_metadata.csv`.

2) Installing FAISS on Windows

- Prefer conda on Windows: `conda install -c conda-forge faiss-cpu`.
- Use WSL if you encounter wheel compatibility problems.

3) Model memory / OOM

- SentenceTransformer models can be large. Use a smaller model in `flask_server.py` or run on a machine with more memory.

4) ChromaDB returns no results

- Confirm `chromadb_client/` contains the expected DB files and the collection name `best_movies_database` exists.

5) Local Ollama/Gemma connection refused

- Confirm Ollama is running and listening on `http://localhost:11434` or update the URL in `backend/flask_server.py`.

6) CORS issues

- The backend uses `flask_cors.CORS(app)` which is permissive by default. If you have custom network policies, configure CORS accordingly in the server.

7) Backend port mismatch

- If Flask runs on a different port, update the frontend service files in `src/services/` (e.g. `faiss_advanced_query1.jsx`, `choma_query_service.jsx`).

## Developer notes & next steps

- Add a small `scripts/check-data.py` utility to verify required files before starting the server.
- Add unit tests for `metadata_filter` and search ranking logic.
- Improve the UI to better surface `row_checker` construction and validation.
- Consider adding authentication and rate-limiting before exposing Groq API keys.

## Contributing

1. Fork and create a feature branch.
2. Run app locally and ensure no regressions.
3. Open a PR with a clear description and any migration/run instructions.


README updated on: 2025-09-18
