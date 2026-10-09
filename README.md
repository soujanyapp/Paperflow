# Paperflow

Browser-based document studio: a true-to-print A4 canvas editor, a form builder that
publishes documents as shareable forms, and pixel-faithful PDF export rendered with
Playwright + Chromium.

## Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS 4, shadcn-style UI (Radix), Tiptap, dnd-kit, Zustand + Immer, react-router.
- **Backend** — FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Playwright (Python) for PDF rendering, pypdf, nh3 sanitization.
- **Tests** — Vitest (frontend unit), pytest (backend), Playwright (end-to-end).

The document is a versioned JSON model (`SCHEMA_VERSION = 1`) shared by the browser
paginator and the Python renderer, so the on-screen preview and the exported PDF agree.

## Prerequisites

- Node.js 20+ and npm
- Python 3.12 or 3.13 with [`uv`](https://docs.astral.sh/uv/)
- Docker (for PostgreSQL)
- Playwright Chromium (installed below)

## Quickstart

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
uv sync
uv run playwright install chromium
export PATH="$HOME/.local/bin:$PATH"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173  (proxies /api -> :8000)
```

Configuration lives in `.env.example` (root, Docker) and `backend/.env`. The backend
reads `PAPERFLOW_ENV`, `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `STORAGE_ROOT`,
`MAX_UPLOAD_MB`, and `PDF_EXPORT_TIMEOUT_MS`.

## Tests

```bash
cd backend  && uv run ruff check app tests && uv run pytest
cd frontend && npm run typecheck && npm test && npm run build
cd frontend && npm run test:e2e     # starts backend + Vite automatically
```

## Project layout

```
backend/
  app/
    api/routes/      auth, workspaces, documents, templates, assets, forms, pdf
    models/          SQLAlchemy models (identity, documents, assets, forms, pdf)
    services/        renderer, pdf, storage, tokens, document_model, forms, seed
  alembic/           migrations
  tests/             pytest suite
frontend/
  src/
    document/        model, operations, pagination, styles (shared with preview)
    components/      ui primitives, document renderer, editor, layout
    features/        auth, documents, templates, editor, forms, public, settings
    lib/             API client, formatting, utils
    store/           Zustand editor store (undo/redo)
  e2e/               Playwright specs
storage/             uploaded assets and generated PDFs (gitignored)
```

## Notes

- PDF export requires the Playwright Chromium browser; run `uv run playwright install chromium`.
- Server-side form submissions are validated against the published document's field
  definitions, and rich text is sanitized (nh3) before it is stored or rendered.
- The Postgres data lives in the named Docker volume `paperflow_paperflow_pgdata`.
