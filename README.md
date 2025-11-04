
# NLP-Project - Movie Chat + Semantic Search

This repository is a full-stack experimental project that demonstrates a movie-focused conversational and semantic search application. It combines a React + Vite frontend (chat UI and saved sessions), a Flask backend that exposes semantic search endpoints, and integration with **Supabase PostgreSQL with pgvector** for retrieval and the Groq API for LLM responses. The stack has been simplified to Supabase + Groq only (legacy FAISS/Chroma/Ollama paths were removed).

### New Features

- **Supabase Integration**: Complete PostgreSQL vector database setup with pgvector extension for persistent, scalable embedding storage
- **Automated Setup**: One-command installation script for all Python dependencies
- **Vector Similarity Search**: Direct database queries using PostgreSQL's vector similarity functions

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

- Natural language search for movies using embedding-based similarity via Supabase pgvector.
- LLM summarization/chat via Groq API.
- A React UI for chat and saved chat sessions.

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
- `python-scripts/` — Notebooks and scripts used to precompute embeddings and debug queries.
  - `supabase_training.py` — Complete pipeline for uploading embeddings to Supabase PostgreSQL
  - `supabase_training.ipynb` — Interactive notebook for testing Supabase integration
- `install_dependencies.py` — Automated installation script for all Python dependencies

### Supabase Setup Files

For the new PostgreSQL vector database functionality:

- `supabase_training.py` — Python class for managing Supabase embedding pipeline
- `supabase_training.ipynb` — Step-by-step notebook for testing database setup
- `.env` — Environment configuration (add your Supabase credentials here)

Runtime requirements:

- A Supabase Postgres database with pgvector enabled and a `movies` table populated with embeddings (see `python-scripts/supabase_training.ipynb`).

## Prerequisites

Install the following on your machine:

- Node.js + npm (Node 18+ recommended).
- Python 3.8+ (use a venv).
- Groq API key for cloud LLM calls.

### Quick Setup with Installation Script

We provide an automated installation script that handles all Python dependencies:

```powershell
# Run the dependency installation script
python install_dependencies.py
```

This script will:
- Check Python version compatibility (3.8+)
- Optionally create a virtual environment
- Install all required backend packages
- Verify installations and provide setup guidance

### Manual Installation

If you prefer manual installation or the script fails:

Notes: Older docs referenced FAISS/Chroma/Ollama. Those paths have been removed in favor of a single Supabase pgvector + Groq flow. If you see mentions of FAISS in historical notes, you can ignore them.

## Backend — setup & running (Flask)

### Option 1: Quick Setup (Recommended)

1) Run the automated installation script:

```powershell
python install_dependencies.py
```

2) Add environment variables (create `.env` file in project root):

```ini
# Supabase direct Postgres connection string (ensure sslmode=require)
SUPABASE_DB_URL=postgresql://postgres.[USER]:[URL_ENCODED_PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require

# Groq API Key
GROQ_API_KEY=your_groq_api_key_here
```

3) Run the Flask server:

```powershell
npm run server
# OR
python .\backend\flask_server.py
```

### Option 2: Manual Setup

1) Create and activate a virtual environment (PowerShell):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
```

2) Install Python dependencies:

```powershell
pip install -r backend/requirements.txt
```

3) Add environment variables

- Create a `.env` file in the project root (or `backend/.env`). At minimum, set:

```ini
SUPABASE_DB_URL=postgresql://...
GROQ_API_KEY=...
```

4) Confirm database readiness

- Ensure your Supabase database has the `movies` table created and populated with embeddings. See `python-scripts/supabase_training.ipynb`.

5) Run the Flask server

```powershell
# From repo root
npm run server
# OR
python .\backend\flask_server.py
```

The Flask server binds to port 5000 by default and prints logs describing received requests. The embedding model loads lazily on the first vector-search request.

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

1) POST /vector-search

Purpose: run a semantic search using Supabase pgvector. Returns the top-k most similar movies by cosine similarity.

Request JSON fields:

- query_text (string) — required
- limit (int) — optional (default 10)

Example (PowerShell/curl style):

```powershell
curl -X POST http://localhost:5000/vector-search -H "Content-Type: application/json" -d (
	'{"query_text":"feel-good family comedy","limit":5}'
)
```

Response format (successful):

```
{
	"results": [
		{
			"id": "tt0316654",
			"title": "Spider-Man 2",
			"overview": "Peter Parker is beset...",
			"similarity": 0.6052
		},
		...
	]
}
```

2) POST /run-groq

Purpose: Use Groq's chat completions API (requires `GROQ_API_KEY`). Send a `messages` array in the request body.

Request:

```
{
	"messages": [{"role":"user","content":"Summarize the top result for me"}]
}
```

Response:

```
{ "response": "<string>" }
```

3) GET /health

Purpose: Simple health check endpoint.

Response:

```
{ "status": "ok" }
```

## How to use the app (user-facing guide)

1. Start backend and frontend.
2. Open `http://localhost:5173` (Vite dev URL).
3. Navigate to Chat. Enter a natural language query in the input box.
4. Optionally open the Right Sidebar and set Top K for the search.
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

4) CORS issues

- The backend uses `flask_cors.CORS(app)` which is permissive by default. If you have custom network policies, configure CORS accordingly in the server.

5) Backend port mismatch

- If Flask runs on a different port, update the frontend service files in `src/services/` (e.g. `supabase_vector_search.jsx`).

6) Python dependency installation issues

- Use the automated script: `python install_dependencies.py`
- If the script fails, check Python version (3.8+ required) and try manual installation

7) Supabase connection issues

- Verify your `SUPABASE_DB_URL` in the `.env` file includes the correct password
- Ensure pgvector extension is enabled in your Supabase dashboard
- Check that your Supabase project allows connections from your IP address

8) Jupyter notebook kernel issues

- Install Jupyter in your virtual environment: `pip install jupyter notebook ipykernel`
- Register the kernel: `python -m ipykernel install --user --name=cinebot`

## Developer notes & next steps

- **Supabase Integration**: Use the `supabase_training.ipynb` notebook to set up vector embeddings in PostgreSQL
- Add unit tests around the vector search and response shaping.
- Improve the UI to better surface the extracted query parameters and filters.
- Consider adding authentication and rate-limiting before exposing Groq API keys.

## Contributing

1. Fork and create a feature branch.
2. Run app locally and ensure no regressions.
3. Open a PR with a clear description and any migration/run instructions.


README updated on: 2025-09-18
