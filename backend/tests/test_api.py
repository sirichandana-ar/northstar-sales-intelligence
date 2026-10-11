import asyncio
import io
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, UploadFile

from backend.app import main


class SalesApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        main.DATABASE_PATH = Path(self.temp_dir.name) / "test-sales.db"
        main.initialize_database()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_dashboard_kpis_match_monthly_revenue(self):
        with main.connect() as db:
            payload = main.dashboard_payload(db, 2024, None, None)

        self.assertEqual(len(payload["monthly"]), 12)
        self.assertGreater(payload["kpis"]["revenue"], 0)
        self.assertEqual(
            round(sum(row["revenue"] for row in payload["monthly"]), 2),
            payload["kpis"]["revenue"],
        )
        self.assertEqual(payload["year"], 2024)

    def test_dashboard_filters_apply_to_revenue(self):
        with main.connect() as db:
            north = main.dashboard_payload(db, 2024, "North", None)
            all_regions = main.dashboard_payload(db, 2024, None, None)

        self.assertGreater(north["kpis"]["revenue"], 0)
        self.assertLess(north["kpis"]["revenue"], all_regions["kpis"]["revenue"])
        self.assertEqual({row["region"] for row in north["regions"]}, {"North"})

    def test_orders_endpoint_paginates(self):
        result = main.orders(year=2024, limit=5, offset=0)

        self.assertEqual(len(result["items"]), 5)
        self.assertGreater(result["total"], 5)
        self.assertEqual(result["limit"], 5)

    def test_customer_filters_match_region(self):
        north = main.customers(year=2024, region="North", limit=100)
        south = main.customers(year=2024, region="South", limit=100)
        north_names = {customer["name"] for customer in north["items"]}
        south_names = {customer["name"] for customer in south["items"]}
        self.assertNotEqual(north_names, south_names)
        self.assertGreater(north["total"], 0)

    def test_product_search_and_category_filter_the_product_list(self):
        result = main.products(year=2024, category="Home", search="Standing Desk")

        self.assertEqual([product["name"] for product in result["items"]],
                         ["Standing Desk"])
        self.assertEqual(result["total"], 1)

    def test_csv_upload_adds_valid_orders(self):
        content = (
            "order_date,customer_name,product_name,category,region,quantity,"
            "unit_price,status\n"
            "2024-10-15,Test Customer,Test Item,Home,North,2,25.5,Delivered\n"
        )
        upload = UploadFile(filename="orders.csv", file=io.BytesIO(content.encode()))
        result = asyncio.run(main.upload_csv(upload))
        self.assertEqual(result["imported"], 1)

        with main.connect() as db:
            row = db.execute(
                """SELECT o.quantity, o.unit_price, o.status
                   FROM orders o JOIN customers c ON c.customer_id = o.customer_id
                   WHERE c.name = 'Test Customer'"""
            ).fetchone()
        self.assertEqual(tuple(row), (2, 25.5, "Delivered"))

    def test_csv_upload_rejects_invalid_rows(self):
        content = (
            "order_date,customer_name,product_name,category,region,quantity,"
            "unit_price,status\n"
            "not-a-date,Test Customer,Test Item,Home,North,2,25.5,Delivered\n"
        )
        upload = UploadFile(filename="orders.csv", file=io.BytesIO(content.encode()))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.upload_csv(upload))
        self.assertEqual(error.exception.status_code, 422)
        with main.connect() as db:
            customer = db.execute(
                "SELECT customer_id FROM customers WHERE name = 'Test Customer'"
            ).fetchone()
        self.assertIsNone(customer)


if __name__ == "__main__":
    unittest.main()
