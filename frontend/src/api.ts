export interface Filters {
  years: number[];
  regions: string[];
  categories: string[];
  statuses: string[];
}

export interface Dashboard {
  year: number;
  previous_year: number;
  kpis: {
    revenue: number;
    orders: number;
    average_order_value: number;
    active_customers: number;
    revenue_change: number;
    orders_change: number;
    aov_change: number;
  };
  monthly: { month: number; revenue: number; previous_revenue: number }[];
  regions: { region: string; revenue: number }[];
  categories: { category: string; revenue: number }[];
  products: Product[];
  statuses: { status: string; count: number }[];
  segments: { segment: string; count: number }[];
  top_customers: Customer[];
  recent_orders: Order[];
}

export interface Order {
  order_id: number;
  order_date: string;
  customer: string;
  product: string;
  category: string;
  region: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: string;
}

export interface Product {
  product_id?: number;
  name: string;
  category: string;
  revenue: number;
  units_sold: number;
  margin_pct: number | null;
}

export interface Customer {
  customer_id: number;
  name: string;
  segment: string;
  total_orders: number;
  revenue?: number;
  lifetime_value?: number;
  last_order: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail ?? message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const api = {
  filters: () => request<Filters>("/api/filters"),
  dashboard: (values: { year: number; region: string; category: string }) =>
    request<Dashboard>(`/api/dashboard?${queryString(values)}`),
  orders: (values: Record<string, string | number | undefined>) =>
    request<PageResult<Order>>(`/api/orders?${queryString(values)}`),
  products: (values: Record<string, string | number | undefined>) =>
    request<PageResult<Product>>(`/api/products?${queryString(values)}`),
  customers: (values: Record<string, string | number | undefined>) =>
    request<PageResult<Customer>>(`/api/customers?${queryString(values)}`),
  upload: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return request<{ message: string; imported: number }>("/api/data/upload", {
      method: "POST",
      body,
    });
  },
  reset: () =>
    request<{ message: string }>("/api/data/reset", { method: "POST" }),
};
