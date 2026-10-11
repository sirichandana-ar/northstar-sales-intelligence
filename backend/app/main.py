from __future__ import annotations

import csv
import io
import os
import random
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated, Iterator

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

ROOT = Path(__file__).resolve().parents[2]
DATABASE_PATH = Path(os.environ.get(
    "SALES_DATABASE_PATH", ROOT / "backend" / "data" / "sales.db"
))
UPLOAD_LIMIT = 10 * 1024 * 1024
UPLOAD_ROW_LIMIT = 50_000
VALID_STATUSES = {"Delivered", "Pending", "Returned", "Cancelled"}
REGIONS = ["North", "South", "East", "West"]
SEGMENTS = ["Champions", "Loyalists", "At Risk", "New", "Dormant"]
CATEGORIES = {
    "Electronics": ["Laptop Pro X", "Noise Cancelling Headphones",
                    "Smart Watch Series 5", "Wireless Keyboard", "4K Monitor"],
    "Sports": ["Running Shoes Elite", "Yoga Mat Pro", "Cycling Helmet",
               "Resistance Bands", "Water Bottle Pro"],
    "Home": ["Ergonomic Office Chair", "Coffee Maker Premium",
             "Air Purifier", "Standing Desk", "LED Desk Lamp"],
    "Apparel": ["Winter Jacket", "Backpack Explorer", "Formal Shirt Pack",
                "Sports Tshirt", "Denim Jeans"],
}
PRICE_MAP = {
    "Laptop Pro X": (850, 1400), "Noise Cancelling Headphones": (60, 120),
    "Smart Watch Series 5": (80, 160), "Wireless Keyboard": (25, 55),
    "4K Monitor": (200, 450), "Running Shoes Elite": (40, 90),
    "Yoga Mat Pro": (15, 35), "Cycling Helmet": (30, 70),
    "Resistance Bands": (8, 20), "Water Bottle Pro": (10, 25),
    "Ergonomic Office Chair": (200, 500), "Coffee Maker Premium": (60, 150),
    "Air Purifier": (80, 200), "Standing Desk": (250, 600),
    "LED Desk Lamp": (20, 50), "Winter Jacket": (60, 140),
    "Backpack Explorer": (35, 90), "Formal Shirt Pack": (25, 60),
    "Sports Tshirt": (12, 30), "Denim Jeans": (30, 80),
}


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with connect() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS products (
                product_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                cost_price REAL NOT NULL CHECK (cost_price >= 0),
                UNIQUE (name, category)
            );
            CREATE TABLE IF NOT EXISTS customers (
                customer_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                segment TEXT NOT NULL,
                signup_date TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                order_id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
                product_id INTEGER NOT NULL REFERENCES products(product_id),
                region TEXT NOT NULL,
                order_date TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_price REAL NOT NULL CHECK (unit_price >= 0),
                status TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
            CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
            CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
            CREATE INDEX IF NOT EXISTS idx_orders_region ON orders(region);
        """)
        if db.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 0:
            seed_sample_data(db)


def seed_sample_data(db: sqlite3.Connection) -> None:
    from faker import Faker

    rng = random.Random(42)
    fake = Faker("en_IN")
    fake.seed_instance(42)
    products: list[tuple[str, str, float]] = []
    for category, names in CATEGORIES.items():
        for name in names:
            low, high = PRICE_MAP[name]
            cost = round(rng.uniform(low, high) * 0.55, 2)
            products.append((name, category, cost))
    db.executemany(
        "INSERT OR IGNORE INTO products(name, category, cost_price) VALUES (?, ?, ?)",
        products,
    )
    customers = [
        (fake.name(), rng.choice(SEGMENTS),
         str(date(rng.choice([2022, 2023, 2024]), 1, 1)
             + timedelta(days=rng.randint(0, 364))))
        for _ in range(500)
    ]
    db.executemany(
        "INSERT OR IGNORE INTO customers(name, segment, signup_date) VALUES (?, ?, ?)",
        customers,
    )
    customer_ids = [row[0] for row in db.execute(
        "SELECT customer_id FROM customers ORDER BY customer_id"
    )]
    product_ids = {
        row["name"]: row["product_id"]
        for row in db.execute("SELECT product_id, name FROM products")
    }
    product_data = {name: (category, cost) for name, category, cost in products}
    orders = []
    statuses = (["Delivered"] * 72 + ["Pending"] * 15
                + ["Returned"] * 8 + ["Cancelled"] * 5)
    for order_id in range(1, 12_001):
        year = 2023 if order_id <= 5_500 else 2024
        order_date = date(year, 1, 1) + timedelta(days=rng.randint(0, 364))
        name = rng.choice(list(PRICE_MAP))
        low, high = PRICE_MAP[name]
        orders.append((
            rng.choice(customer_ids), product_ids[name], rng.choice(REGIONS),
            str(order_date), rng.randint(1, 4),
            round(rng.uniform(low, high), 2), rng.choice(statuses),
        ))
    db.executemany(
        """INSERT INTO orders(customer_id, product_id, region, order_date,
                              quantity, unit_price, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        orders,
    )


def records(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]


def order_filters(
    year: int,
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
) -> tuple[str, list]:
    clauses = ["strftime('%Y', o.order_date) = ?"]
    values: list = [str(year)]
    if region:
        clauses.append("o.region = ?")
        values.append(region)
    if category:
        clauses.append("p.category = ?")
        values.append(category)
    if status:
        clauses.append("o.status = ?")
        values.append(status)
    return " AND ".join(clauses), values


def dashboard_payload(
    db: sqlite3.Connection, year: int, region: str | None, category: str | None,
) -> dict:
    where, params = order_filters(year, region, category)
    previous_where, previous_params = order_filters(year - 1, region, category)
    revenue_filter = f"{where} AND o.status = 'Delivered'"
    previous_revenue_filter = f"{previous_where} AND o.status = 'Delivered'"
    current = db.execute(
        f"""SELECT COALESCE(SUM(o.quantity * o.unit_price), 0) AS revenue,
                   COUNT(DISTINCT o.order_id) AS orders,
                   COUNT(DISTINCT o.customer_id) AS customers
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}""",
        params,
    ).fetchone()
    previous = db.execute(
        f"""SELECT COALESCE(SUM(o.quantity * o.unit_price), 0) AS revenue,
                   COUNT(DISTINCT o.order_id) AS orders
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {previous_revenue_filter}""",
        previous_params,
    ).fetchone()
    revenue = current["revenue"]
    orders_count = current["orders"]
    previous_revenue = previous["revenue"]
    previous_orders = previous["orders"]
    aov = revenue / orders_count if orders_count else 0
    previous_aov = previous_revenue / previous_orders if previous_orders else 0

    monthly = records(db.execute(
        f"""SELECT CAST(strftime('%m', o.order_date) AS INTEGER) AS month,
                   ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue,
                   COUNT(DISTINCT o.order_id) AS orders
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY month ORDER BY month""",
        params,
    ).fetchall())
    previous_monthly = records(db.execute(
        f"""SELECT CAST(strftime('%m', o.order_date) AS INTEGER) AS month,
                   ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {previous_revenue_filter}
            GROUP BY month ORDER BY month""",
        previous_params,
    ).fetchall())
    region_rows = records(db.execute(
        f"""SELECT o.region, ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY o.region ORDER BY revenue DESC""",
        params,
    ).fetchall())
    category_rows = records(db.execute(
        f"""SELECT p.category, ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY p.category ORDER BY revenue DESC""",
        params,
    ).fetchall())
    product_rows = records(db.execute(
        f"""SELECT p.name, p.category,
                   ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue,
                   SUM(o.quantity) AS units_sold,
                   ROUND((SUM(o.quantity * o.unit_price)
                          - SUM(o.quantity * p.cost_price))
                         / NULLIF(SUM(o.quantity * o.unit_price), 0) * 100, 1)
                         AS margin_pct
            FROM orders o JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY p.product_id ORDER BY revenue DESC LIMIT 10""",
        params,
    ).fetchall())
    status_rows = records(db.execute(
        f"""SELECT o.status, COUNT(*) AS count FROM orders o
            JOIN products p ON p.product_id = o.product_id
            WHERE {where} GROUP BY o.status ORDER BY count DESC""",
        params,
    ).fetchall())
    segments = records(db.execute(
        f"""SELECT c.segment, COUNT(DISTINCT c.customer_id) AS count
            FROM customers c JOIN orders o ON o.customer_id = c.customer_id
            JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY c.segment ORDER BY count DESC""",
        params,
    ).fetchall())
    top_customers = records(db.execute(
        f"""SELECT c.customer_id, c.name, c.segment,
                   COUNT(DISTINCT o.order_id) AS total_orders,
                   ROUND(SUM(o.quantity * o.unit_price), 2) AS revenue,
                   MAX(o.order_date) AS last_order
            FROM customers c JOIN orders o ON o.customer_id = c.customer_id
            JOIN products p ON p.product_id = o.product_id
            WHERE {revenue_filter}
            GROUP BY c.customer_id ORDER BY revenue DESC LIMIT 8""",
        params,
    ).fetchall())
    recent_orders = records(db.execute(
        f"""SELECT o.order_id, o.order_date, c.name AS customer,
                   p.name AS product, p.category, o.region, o.quantity,
                   o.unit_price, o.quantity * o.unit_price AS total, o.status
            FROM orders o JOIN customers c ON c.customer_id = o.customer_id
            JOIN products p ON p.product_id = o.product_id
            WHERE {where} ORDER BY o.order_date DESC, o.order_id DESC LIMIT 8""",
        params,
    ).fetchall())

    def change(value: float, previous_value: float) -> float:
        return round((value - previous_value) / previous_value * 100, 1) if previous_value else 0

    return {
        "year": year,
        "previous_year": year - 1,
        "kpis": {
            "revenue": round(revenue, 2),
            "orders": orders_count,
            "average_order_value": round(aov, 2),
            "active_customers": current["customers"],
            "revenue_change": change(revenue, previous_revenue),
            "orders_change": change(orders_count, previous_orders),
            "aov_change": change(aov, previous_aov),
        },
        "monthly": [
            {
                "month": month,
                "revenue": next((r["revenue"] for r in monthly if r["month"] == month), 0),
                "previous_revenue": next(
                    (r["revenue"] for r in previous_monthly if r["month"] == month), 0
                ),
            }
            for month in range(1, 13)
        ],
        "regions": region_rows,
        "categories": category_rows,
        "products": product_rows,
        "statuses": status_rows,
        "segments": segments,
        "top_customers": top_customers,
        "recent_orders": recent_orders,
    }


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Northstar Sales API",
    description="Sales analytics, customer insights, and data import API.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    with connect() as db:
        order_count = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    return {"status": "ok", "orders": order_count}


@app.get("/api/filters")
def filters():
    with connect() as db:
        years = [
            int(row[0]) for row in db.execute(
                "SELECT DISTINCT strftime('%Y', order_date) FROM orders ORDER BY 1 DESC"
            )
        ]
        regions = [row[0] for row in db.execute(
            "SELECT DISTINCT region FROM orders ORDER BY region"
        )]
        categories = [row[0] for row in db.execute(
            "SELECT DISTINCT category FROM products ORDER BY category"
        )]
    return {"years": years, "regions": regions, "categories": categories,
            "statuses": sorted(VALID_STATUSES)}


@app.get("/api/dashboard")
def dashboard(
    year: Annotated[int, Query(ge=2000, le=2100)] = 2024,
    region: str | None = None,
    category: str | None = None,
):
    with connect() as db:
        available_years = {
            int(row[0]) for row in db.execute(
                "SELECT DISTINCT strftime('%Y', order_date) FROM orders"
            )
        }
        if year not in available_years:
            raise HTTPException(status_code=404, detail=f"No sales data for {year}.")
        return dashboard_payload(db, year, region, category)


@app.get("/api/orders")
def orders(
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    clauses: list[str] = []
    params: list = []
    if year is not None:
        clauses.append("strftime('%Y', o.order_date) = ?")
        params.append(str(year))
    for column, value in (("o.region", region), ("p.category", category),
                          ("o.status", status)):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value)
    if search:
        clauses.append("(c.name LIKE ? OR p.name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with connect() as db:
        total = db.execute(
            f"""SELECT COUNT(*) FROM orders o
                JOIN customers c ON c.customer_id = o.customer_id
                JOIN products p ON p.product_id = o.product_id{where}""",
            params,
        ).fetchone()[0]
        rows = records(db.execute(
            f"""SELECT o.order_id, o.order_date, c.name AS customer,
                       p.name AS product, p.category, o.region, o.quantity,
                       o.unit_price, o.quantity * o.unit_price AS total, o.status
                FROM orders o JOIN customers c ON c.customer_id = o.customer_id
                JOIN products p ON p.product_id = o.product_id{where}
                ORDER BY o.order_date DESC, o.order_id DESC LIMIT ? OFFSET ?""",
            [*params, limit, offset],
        ).fetchall())
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@app.get("/api/products")
def products(
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    region: str | None = None,
    category: str | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    order_clauses = ["o.status = 'Delivered'"]
    order_params: list = []
    if year is not None:
        order_clauses.append("strftime('%Y', o.order_date) = ?")
        order_params.append(str(year))
    if region:
        order_clauses.append("o.region = ?")
        order_params.append(region)
    product_filters = []
    product_params = []
    if category:
        product_filters.append("p.category = ?")
        product_params.append(category)
    if search:
        product_filters.append("p.name LIKE ?")
        product_params.append(f"%{search}%")
    where = " WHERE " + " AND ".join(product_filters) if product_filters else ""
    with connect() as db:
        rows = records(db.execute(
            f"""SELECT p.product_id, p.name, p.category,
                       ROUND(COALESCE(SUM(o.quantity * o.unit_price), 0), 2) AS revenue,
                       COALESCE(SUM(o.quantity), 0) AS units_sold,
                       ROUND((SUM(o.quantity * o.unit_price)
                              - SUM(o.quantity * p.cost_price))
                             / NULLIF(SUM(o.quantity * o.unit_price), 0) * 100, 1)
                             AS margin_pct
                FROM products p LEFT JOIN orders o ON o.product_id = p.product_id
                    AND {" AND ".join(order_clauses)}
                {where}
                GROUP BY p.product_id ORDER BY revenue DESC LIMIT ? OFFSET ?""",
            [*order_params, *product_params, limit, offset],
        ).fetchall())
        total = db.execute(
            f"SELECT COUNT(*) FROM products p{where}", product_params
        ).fetchone()[0]
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@app.get("/api/customers")
def customers(
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    region: str | None = None,
    category: str | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    clauses = ["o.status = 'Delivered'"]
    params: list = []
    if year is not None:
        clauses.append("strftime('%Y', o.order_date) = ?")
        params.append(str(year))
    if region:
        clauses.append("o.region = ?")
        params.append(region)
    if category:
        clauses.append("p.category = ?")
        params.append(category)
    if search:
        clauses.append("(c.name LIKE ? OR c.segment LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    where = " AND ".join(clauses)
    with connect() as db:
        total = db.execute(
            f"""SELECT COUNT(DISTINCT c.customer_id) FROM customers c
                JOIN orders o ON o.customer_id = c.customer_id
                JOIN products p ON p.product_id = o.product_id WHERE {where}""",
            params,
        ).fetchone()[0]
        rows = records(db.execute(
            f"""SELECT c.customer_id, c.name, c.segment,
                       COUNT(DISTINCT o.order_id) AS total_orders,
                       ROUND(SUM(o.quantity * o.unit_price), 2) AS lifetime_value,
                       MAX(o.order_date) AS last_order
                FROM customers c JOIN orders o ON o.customer_id = c.customer_id
                JOIN products p ON p.product_id = o.product_id
                WHERE {where} GROUP BY c.customer_id
                ORDER BY lifetime_value DESC LIMIT ? OFFSET ?""",
            [*params, limit, offset],
        ).fetchall())
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@app.get("/api/export")
def export_csv(
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
):
    clauses: list[str] = []
    params: list = []
    if year is not None:
        clauses.append("strftime('%Y', o.order_date) = ?")
        params.append(str(year))
    for column, value in (("o.region", region), ("p.category", category),
                          ("o.status", status)):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with connect() as db:
        rows = records(db.execute(
            f"""SELECT o.order_id, o.order_date, c.name AS customer,
                       c.segment, p.name AS product, p.category, o.region,
                       o.quantity, o.unit_price, o.quantity * o.unit_price AS total,
                       o.status
                FROM orders o JOIN customers c ON c.customer_id = o.customer_id
                JOIN products p ON p.product_id = o.product_id{where}
                ORDER BY o.order_date DESC""",
            params,
        ).fetchall())
    output = io.StringIO()
    columns = ["order_id", "order_date", "customer", "segment", "product",
               "category", "region", "quantity", "unit_price", "total", "status"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    filename = f"sales-orders-{year or 'all'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/data/upload")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read(UPLOAD_LIMIT + 1)
    if len(content) > UPLOAD_LIMIT:
        raise HTTPException(status_code=413, detail="CSV must be smaller than 10 MB.")
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"order_date", "customer_name", "product_name", "category",
                    "region", "quantity", "unit_price", "status"}
        headers = set(reader.fieldnames or [])
        missing = sorted(required - headers)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required columns: {', '.join(missing)}.",
            )
        parsed = []
        for row_number, row in enumerate(reader, start=2):
            if row_number > UPLOAD_ROW_LIMIT + 1:
                raise HTTPException(
                    status_code=413, detail="CSV cannot contain more than 50,000 rows."
                )
            try:
                order_date = date.fromisoformat(row["order_date"].strip())
                customer = row["customer_name"].strip()
                product = row["product_name"].strip()
                category_name = row["category"].strip()
                region_name = row["region"].strip()
                quantity = int(row["quantity"])
                unit_price = float(row["unit_price"])
                status_value = row["status"].strip().title()
                cost_price = float(row.get("cost_price") or unit_price * 0.55)
                segment = (row.get("segment") or "New").strip() or "New"
                if not all((customer, product, category_name, region_name)):
                    raise ValueError("name, category, and region fields cannot be blank")
                if quantity < 1 or unit_price < 0 or cost_price < 0:
                    raise ValueError("quantity must be positive and prices cannot be negative")
                if status_value not in VALID_STATUSES:
                    raise ValueError("status must be Delivered, Pending, Returned, or Cancelled")
            except (ValueError, TypeError) as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid value on CSV row {row_number}: {exc}.",
                ) from exc
            parsed.append((str(order_date), customer, segment, product, category_name,
                           region_name, quantity, unit_price, cost_price, status_value))
        if not parsed:
            raise HTTPException(status_code=422, detail="CSV contains no order rows.")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV must use UTF-8 encoding.") from exc

    with connect() as db:
        for order_date, customer, segment, product, category_name, region_name, quantity, unit_price, cost_price, status_value in parsed:
            db.execute(
                """INSERT INTO customers(name, segment, signup_date) VALUES (?, ?, ?)
                   ON CONFLICT(name) DO UPDATE SET segment = excluded.segment""",
                (customer, segment, order_date),
            )
            db.execute(
                """INSERT INTO products(name, category, cost_price) VALUES (?, ?, ?)
                   ON CONFLICT(name, category) DO UPDATE SET cost_price = excluded.cost_price""",
                (product, category_name, cost_price),
            )
            customer_id = db.execute(
                "SELECT customer_id FROM customers WHERE name = ?", (customer,)
            ).fetchone()[0]
            product_id = db.execute(
                "SELECT product_id FROM products WHERE name = ? AND category = ?",
                (product, category_name),
            ).fetchone()[0]
            db.execute(
                """INSERT INTO orders(customer_id, product_id, region, order_date,
                                      quantity, unit_price, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (customer_id, product_id, region_name, order_date,
                 quantity, unit_price, status_value),
            )
    return {"message": f"Imported {len(parsed):,} orders.", "imported": len(parsed)}


@app.post("/api/data/reset")
def reset_sample_data():
    with connect() as db:
        db.execute("DELETE FROM orders")
        db.execute("DELETE FROM customers")
        db.execute("DELETE FROM products")
        seed_sample_data(db)
    return {"message": "Sample dataset restored.", "orders": 12_000}
