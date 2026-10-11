# Northstar Sales Intelligence

A full-stack sales analytics workspace with an interactive React dashboard, a FastAPI backend, and persistent SQLite storage. It starts with a reproducible sample dataset and can import your own sales CSV.

## Features

- Executive overview with revenue, fulfilled orders, average order value, and active customers.
- Interactive year, region, and category filters.
- Revenue trends, regional and category mix, best-selling products, order health, and top customers.
- Searchable and paginated orders and customer views, plus product performance.
- CSV exports that honor the selected reporting filters.
- CSV upload with validation and useful row-level error messages.
- SQLite persistence: imported data survives restarts. Restore the sample dataset from Data sources.
- Interactive API documentation at `http://127.0.0.1:8001/docs`.

Revenue and customer-value metrics include delivered orders only. Fulfillment-status counts include every order. Year-over-year comparisons use the matching region/category filters and the prior calendar year.

## Run locally (Windows PowerShell)

Use two terminals from the project root.

### 1. Start the API

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8001
```

The API initializes `backend\data\sales.db` on first startup and seeds 12,000 sample orders across 2023 and 2024. Override the database location with `SALES_DATABASE_PATH` if you want to use a different SQLite file.

### 2. Start the web app

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Vite forwards `/api` requests to the local FastAPI server.

## Importing a sales CSV

Open **Data sources → Bring your sales into focus** in the app. CSV uploads are appended to the current database; the app validates the whole file before importing it. Files are limited to 10 MB and 50,000 rows.

Required columns (header names are case-sensitive):

| Column | Format |
| --- | --- |
| `order_date` | ISO date, `YYYY-MM-DD` |
| `customer_name` | Customer name |
| `product_name` | Product name |
| `category` | Product category |
| `region` | Sales region |
| `quantity` | Positive whole number |
| `unit_price` | Non-negative number |
| `status` | `Delivered`, `Pending`, `Returned`, or `Cancelled` |

Optional columns: `segment` (defaults to `New`) and `cost_price` (defaults to 55% of the unit price). Exported transaction CSVs use the app's own column names; to upload an export again, rename `customer` to `customer_name` and `product` to `product_name`.

The database and sample data are local to this installation. The upload endpoint does not replace existing sales; use **Restore demo data** to replace the local database with the original sample dataset.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | API and database health |
| `GET /api/filters` | Available years, regions, categories, and order statuses |
| `GET /api/dashboard` | Dashboard metrics and chart data |
| `GET /api/orders` | Searchable, filtered, paginated orders |
| `GET /api/products` | Product revenue and estimated margins |
| `GET /api/customers` | Customer value and order history |
| `GET /api/export` | Download filtered transactions as CSV |
| `POST /api/data/upload` | Validate and append sales CSV data |
| `POST /api/data/reset` | Restore generated sample data |

## Project layout

```text
backend/
  app/main.py       FastAPI routes, SQLite schema, analytics, and CSV ingestion
  tests/            Backend API and data tests
  requirements.txt  Python dependencies
frontend/
  src/App.tsx       React application and dashboard views
  src/api.ts        Typed API client
  src/styles.css    Responsive application styles
  package.json      Frontend scripts and dependencies
sales dashboard.py  Original standalone Matplotlib dashboard
sales_*.csv         Example analytics exports from the original script
```

The original Matplotlib script remains available as a separate demo:

```powershell
python "sales dashboard.py"
```

## Tests and production builds

From the project root:

```powershell
python -m unittest discover -s backend\tests -v
```

From `frontend`:

```powershell
npm run build
```

For production deployment, serve the compiled frontend behind a web server and run the API with a production ASGI server, configure `SALES_DATABASE_PATH` to durable storage, and restrict CORS origins to your deployed frontend. The included sample configuration is intended for local development.
