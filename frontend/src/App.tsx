import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudUpload,
  Download, FileSpreadsheet, Filter, LayoutDashboard, LoaderCircle, Menu,
  MoreHorizontal, Package, Plus, Search, Settings2, ShoppingBag, Sparkles,
  Users, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type Customer, type Dashboard, type Filters, type Order, type Product } from "./api";

type Page = "Overview" | "Orders" | "Products" | "Customers";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["#4e7bfa", "#72c6ae", "#f4b264", "#a693f5", "#f48787"];
const currency = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(value);
const compactCurrency = (value: number) => value >= 1_000_000
  ? `$${(value / 1_000_000).toFixed(1)}m`
  : value >= 1_000 ? `$${(value / 1_000).toFixed(0)}k` : currency(value);
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", year: "numeric",
});

function App() {
  const [filters, setFilters] = useState<Filters>();
  const [year, setYear] = useState(2024);
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState<Page>("Overview");
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.filters().then((result) => {
      setFilters(result);
      if (result.years.length && !result.years.includes(year)) setYear(result.years[0]);
    }).catch((cause: Error) => setError(cause.message));
  }, [year]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.dashboard({ year, region, category })
      .then((result) => { if (active) { setDashboard(result); setError(""); } })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, region, category, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const choosePage = (next: Page) => { setPage(next); setMobileMenu(false); };
  const refreshData = useCallback(() => setRefresh((value) => value + 1), []);
  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (region) params.set("region", region);
    if (category) params.set("category", category);
    return `/api/export?${params.toString()}`;
  }, [year, region, category]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); choosePage("Overview"); }}>
          <span className="brand-mark"><Activity size={19} strokeWidth={2.6} /></span>
          <span className="brand-name">northstar<span>.</span></span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-avatar">A</div>
          <div className="workspace-copy"><strong>Acme Studio</strong><small>Business workspace</small></div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active={page === "Overview"} onClick={() => choosePage("Overview")} />
          <NavItem icon={<ShoppingBag size={18} />} label="Orders" active={page === "Orders"} onClick={() => choosePage("Orders")} />
          <NavItem icon={<Package size={18} />} label="Products" active={page === "Products"} onClick={() => choosePage("Products")} />
          <NavItem icon={<Users size={18} />} label="Customers" active={page === "Customers"} onClick={() => choosePage("Customers")} />
        </nav>
        <p className="nav-caption tools-caption">MANAGE</p>
        <button className="nav-item" onClick={() => setUploadOpen(true)}><FileSpreadsheet size={18} /><span>Data sources</span><Plus size={15} className="nav-plus" /></button>
        <button className="nav-item" onClick={() => setToast("Settings are coming soon.")}><Settings2 size={18} /><span>Settings</span></button>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={16} /></div>
            <strong>Your business, in focus.</strong>
            <p>Make better decisions with a clearer picture of your sales.</p>
            <button onClick={() => setUploadOpen(true)}>Add your data <ArrowUpRight size={14} /></button>
          </div>
          <button className="help-link" onClick={() => setToast("Need help? Read the setup guide in the project README.")}><CircleHelp size={17} />Help & support</button>
          <div className="profile-row">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jordan Davis</strong><small>Owner</small></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <span className="live-status"><i /> All systems operational</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast("You’re all caught up.")}><Bell size={18} /><i /></button>
            <div className="top-avatar">JD</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> YOUR BUSINESS AT A GLANCE</div>
              <h1>{page === "Overview" ? "Good morning, Jordan" : page}</h1>
              <p>{page === "Overview" ? "Here’s what’s happening with your store today." : pageSubtitle(page)}</p>
            </div>
            <div className="heading-actions">
              <label className="select-control year-select">
                <CalendarDays size={16} />
                <select aria-label="Reporting year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                  {(filters?.years ?? [2024, 2023]).map((option) => <option key={option} value={option}>FY {option}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
              <a className="button button-primary" href={exportHref} download><Download size={16} /> Export</a>
            </div>
          </div>

          <div className="filters-row">
            <span className="filter-intro"><Filter size={15} /> Filters</span>
            <label className="select-control filter-select">
              <select aria-label="Filter by region" value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="">All regions</option>
                {(filters?.regions ?? []).map((option) => <option key={option}>{option}</option>)}
              </select><ChevronDown size={14} />
            </label>
            <label className="select-control filter-select">
              <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {(filters?.categories ?? []).map((option) => <option key={option}>{option}</option>)}
              </select><ChevronDown size={14} />
            </label>
            {(region || category) && <button className="clear-filters" onClick={() => { setRegion(""); setCategory(""); }}>Clear all <X size={13} /></button>}
            <span className="period-note">Compared with FY {year - 1}</span>
          </div>

          {error ? (
            <div className="error-panel"><div><strong>We couldn’t load your sales data.</strong><p>{error}. Check that the API is running, then try again.</p></div><button className="button button-primary" onClick={refreshData}>Try again</button></div>
          ) : loading && !dashboard ? (
            <div className="loading-panel"><LoaderCircle className="spin" size={24} /><span>Loading your workspace…</span></div>
          ) : dashboard ? (
            <>
              {page === "Overview" && <Overview data={dashboard} year={year} loading={loading} onNavigate={choosePage} />}
              {page === "Orders" && <OrdersPage year={year} region={region} category={category} />}
              {page === "Products" && <ProductsPage year={year} region={region} category={category} />}
              {page === "Customers" && <CustomersPage year={year} region={region} category={category} />}
              <footer className="page-footer"><span>© 2025 Northstar Analytics</span><span><i /> Data last synced just now</span></footer>
            </>
          ) : null}
        </div>
      </main>
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onImported={(message) => { setUploadOpen(false); setToast(message); refreshData(); }} onReset={(message) => { setUploadOpen(false); setToast(message); refreshData(); }} />}
      {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={15} /></button></div>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: Page; active: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <span className="active-indicator" />}</button>;
}

function pageSubtitle(page: Page) {
  return {
    Orders: "Every order, organized in one place.",
    Products: "Understand what sells and what drives your margins.",
    Customers: "Get to know your best customers and their value.",
    Overview: "",
  }[page];
}

function Overview({ data, year, loading, onNavigate }: { data: Dashboard; year: number; loading: boolean; onNavigate: (page: Page) => void }) {
  const { kpis } = data;
  return (
    <div className={`dashboard-body ${loading ? "is-refreshing" : ""}`}>
      <section className="kpi-grid" aria-label="Key performance indicators">
        <KpiCard title="Total revenue" value={currency(kpis.revenue)} change={kpis.revenue_change} icon={<Activity size={17} />} tint="blue" note="from delivered orders" />
        <KpiCard title="Orders fulfilled" value={number(kpis.orders)} change={kpis.orders_change} icon={<ShoppingBag size={17} />} tint="mint" note="delivered this year" />
        <KpiCard title="Average order value" value={currency(kpis.average_order_value)} change={kpis.aov_change} icon={<Boxes size={17} />} tint="peach" note="per completed order" />
        <KpiCard title="Active customers" value={number(kpis.active_customers)} icon={<Users size={17} />} tint="lilac" note="with a delivered order" />
      </section>

      <section className="chart-grid">
        <article className="panel revenue-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">REVENUE OVER TIME</span><h2>Sales performance</h2></div>
            <div className="chart-legend"><span><i className="legend-current" /> {year}</span><span><i className="legend-previous" /> {year - 1}</span><button aria-label="Chart options"><MoreHorizontal size={19} /></button></div>
          </div>
          <div className="chart-summary"><strong>{currency(kpis.revenue)}</strong><span className={kpis.revenue_change >= 0 ? "positive" : "negative"}>{kpis.revenue_change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(kpis.revenue_change)}%</span><small>vs. last year</small></div>
          <div className="revenue-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4e7bfa" stopOpacity={0.20} /><stop offset="95%" stopColor="#4e7bfa" stopOpacity={0.01} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="3 4" />
                <XAxis dataKey="month" tickFormatter={(month: number) => MONTHS[month - 1]} tickLine={false} axisLine={false} tick={{ fill: "#9aa1ae", fontSize: 11 }} dy={10} />
                <YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} tick={{ fill: "#9aa1ae", fontSize: 10 }} />
                <Tooltip content={<RevenueTooltip year={year} previousYear={year - 1} />} />
                <Area type="monotone" dataKey="previous_revenue" stroke="#bdc6d4" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                <Area type="monotone" dataKey="revenue" stroke="#4e7bfa" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel mix-panel">
          <div className="panel-heading"><div><span className="section-kicker">WHERE IT COMES FROM</span><h2>Revenue by region</h2></div><button className="plain-icon" aria-label="More region options"><MoreHorizontal size={19} /></button></div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.regions} dataKey="revenue" nameKey="region" innerRadius={66} outerRadius={91} paddingAngle={3} stroke="none">{data.regions.map((entry, index) => <Cell key={entry.region} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} /></PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{data.regions.length}</strong><span>regions</span></div>
          </div>
          <div className="legend-list">{data.regions.map((item, index) => <div className="legend-row" key={item.region}><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.region}</span><strong>{currency(item.revenue)}</strong></div>)}</div>
        </article>
      </section>

      <section className="lower-grid">
        <article className="panel product-panel">
          <div className="panel-heading"><div><span className="section-kicker">BEST SELLERS</span><h2>Top products</h2></div><button className="text-action" onClick={() => onNavigate("Products")}>View all <ArrowUpRight size={14} /></button></div>
          {data.products.length ? <div className="product-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...data.products].reverse()} layout="vertical" margin={{ top: 4, right: 18, left: 3, bottom: 0 }} barSize={13}>
                <CartesianGrid horizontal={false} stroke="#edf0f4" />
                <XAxis type="number" tickFormatter={compactCurrency} tickLine={false} axisLine={false} tick={{ fill: "#9aa1ae", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={145} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 10 }} />
                <Tooltip formatter={(value) => currency(Number(value))} cursor={{ fill: "#f5f7fb" }} />
                <Bar dataKey="revenue" fill="#6f91fa" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <EmptyState message="No product sales match these filters." />}
        </article>
        <article className="panel category-panel">
          <div className="panel-heading"><div><span className="section-kicker">PRODUCT MIX</span><h2>By category</h2></div><button className="plain-icon" aria-label="More category options"><MoreHorizontal size={19} /></button></div>
          <div className="category-list">{data.categories.map((item, index) => {
            const total = data.categories.reduce((sum, row) => sum + row.revenue, 0);
            const share = total ? item.revenue / total * 100 : 0;
            return <div className="category-item" key={item.category}><div className="category-meta"><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.category}</span><strong>{currency(item.revenue)}</strong></div><div className="progress-track"><i style={{ width: `${share}%`, background: COLORS[index % COLORS.length] }} /></div><small>{share.toFixed(0)}% of revenue</small></div>;
          })}</div>
          <div className="note-card"><span><Sparkles size={15} /></span><p><strong>A little insight</strong> &nbsp;Your best-selling categories are bringing customers back.</p></div>
        </article>
      </section>

      <section className="panel table-panel overview-table">
        <div className="panel-heading"><div><span className="section-kicker">LATEST ACTIVITY</span><h2>Recent orders</h2></div><button className="text-action" onClick={() => onNavigate("Orders")}>All orders <ArrowUpRight size={14} /></button></div>
        <OrdersTable rows={data.recent_orders} compact />
      </section>

      <section className="bottom-grid">
        <article className="panel status-panel">
          <div className="panel-heading"><div><span className="section-kicker">ORDER HEALTH</span><h2>Fulfillment status</h2></div></div>
          <div className="status-list">{data.statuses.map((item) => {
            const total = data.statuses.reduce((sum, row) => sum + row.count, 0);
            const pct = total ? item.count / total * 100 : 0;
            return <div className="status-item" key={item.status}><div className="status-top"><span><i className={`status-dot ${item.status.toLowerCase()}`} />{item.status}</span><strong>{number(item.count)} <small>{pct.toFixed(0)}%</small></strong></div><div className="progress-track"><i className={`status-bar ${item.status.toLowerCase()}`} style={{ width: `${pct}%` }} /></div></div>;
          })}</div>
        </article>
        <article className="panel customer-panel">
          <div className="panel-heading"><div><span className="section-kicker">CUSTOMER LOVE</span><h2>Top customers</h2></div><button className="text-action" onClick={() => onNavigate("Customers")}>See all <ArrowUpRight size={14} /></button></div>
          <div className="customer-list">{data.top_customers.slice(0, 5).map((customer, index) => <div className="customer-row" key={customer.customer_id}><div className={`customer-initial initial-${index % 5}`}>{initials(customer.name)}</div><div className="customer-name"><strong>{customer.name}</strong><small>{customer.segment} · {customer.total_orders} orders</small></div><strong className="customer-value">{currency(customer.revenue ?? 0)}</strong></div>)}</div>
        </article>
      </section>
    </div>
  );
}

function KpiCard({ title, value, change, icon, tint, note }: { title: string; value: string; change?: number; icon: React.ReactNode; tint: string; note: string }) {
  return <article className="panel kpi-card"><div className="kpi-top"><span>{title}</span><i className={`kpi-icon ${tint}`}>{icon}</i></div><strong className="kpi-value">{value}</strong><div className="kpi-bottom">{change !== undefined && <span className={`change-pill ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change)}%</span>}<span>{note}</span></div></article>;
}

function RevenueTooltip({ active, payload, label, year, previousYear }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: number; year: number; previousYear: number }) {
  if (!active || !payload?.length) return null;
  const current = payload.find((row) => row.dataKey === "revenue")?.value ?? 0;
  const previous = payload.find((row) => row.dataKey === "previous_revenue")?.value ?? 0;
  return <div className="chart-tooltip"><strong>{MONTHS[Number(label) - 1]}</strong><span><i className="tooltip-blue" />{year} <b>{currency(current)}</b></span><span><i className="tooltip-gray" />{previousYear} <b>{currency(previous)}</b></span></div>;
}

function OrdersTable({ rows, compact = false }: { rows: Order[]; compact?: boolean }) {
  if (!rows.length) return <EmptyState message="No orders found for this selection." />;
  return <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Date</th><th>Region</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{rows.map((order) => <tr key={order.order_id}><td><span className="order-id">#{String(order.order_id).padStart(5, "0")}</span></td><td><span className="table-person"><i>{initials(order.customer)}</i>{order.customer}</span></td><td><span className="product-cell">{order.product}{!compact && <small>{order.category}</small>}</span></td><td className="muted-cell">{dateLabel(order.order_date)}</td><td className="muted-cell">{order.region}</td><td><StatusBadge status={order.status} /></td><td className="align-right amount-cell">{currency(order.total)}</td></tr>)}</tbody></table></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i />{status}</span>;
}

function OrdersPage({ year, region, category }: { year: number; region: string; category: string }) {
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 12;
  useEffect(() => { setOffset(0); }, [year, region, category, search, status]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.orders({ year, region, category, search, status, limit, offset })
      .then((result) => { if (active) { setRows(result.items); setTotal(result.total); setError(""); } })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, region, category, search, status, offset]);
  return <section className="panel full-table-panel">
    <div className="table-toolbar"><div><span className="section-kicker">TRANSACTION LEDGER</span><h2>All orders <span className="count-label">{number(total)}</span></h2><p>Every order from your connected sales data.</p></div><div className="toolbar-controls"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders…" /></label><label className="select-control status-select"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["Delivered", "Pending", "Returned", "Cancelled"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div></div>
    {error ? <div className="inline-error">{error}</div> : loading ? <TableLoading /> : <OrdersTable rows={rows} />}
    <Pagination total={total} offset={offset} limit={limit} onChange={setOffset} />
  </section>;
}

function ProductsPage({ year, region, category }: { year: number; region: string; category: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.products({ year, region, category, search, limit: 100 })
      .then((result) => { if (active) { setItems(result.items); setError(""); } })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, region, category, search]);
  return <section className="panel full-table-panel">
    <div className="table-toolbar"><div><span className="section-kicker">PRODUCT CATALOG</span><h2>Product performance</h2><p>Revenue and estimated gross margin from delivered orders.</p></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" /></label></div>
    {error ? <div className="inline-error">{error}</div> : loading ? <TableLoading /> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Units sold</th><th>Gross margin</th><th className="align-right">Revenue</th></tr></thead><tbody>{items.map((item) => <tr key={item.product_id ?? item.name}><td><span className="product-table-name"><i><Package size={16} /></i>{item.name}</span></td><td><span className="category-chip">{item.category}</span></td><td>{number(item.units_sold)}</td><td><span className="margin-value">{item.margin_pct ?? 0}%</span><div className="mini-progress"><i style={{ width: `${Math.max(0, Math.min(item.margin_pct ?? 0, 100))}%` }} /></div></td><td className="align-right amount-cell">{currency(item.revenue)}</td></tr>)}</tbody></table></div>}
  </section>;
}

function CustomersPage({ year, region, category }: { year: number; region: string; category: string }) {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 12;
  useEffect(() => { setOffset(0); }, [year, region, category, search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.customers({ year, region, category, search, limit, offset })
      .then((result) => { if (active) { setItems(result.items); setTotal(result.total); setError(""); } })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, region, category, search, offset]);
  return <section className="panel full-table-panel">
    <div className="table-toolbar"><div><span className="section-kicker">YOUR COMMUNITY</span><h2>Customer insights <span className="count-label">{number(total)}</span></h2><p>Ranked by customer value for the selected year.</p></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers…" /></label></div>
    {error ? <div className="inline-error">{error}</div> : loading ? <TableLoading /> : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Segment</th><th>Orders</th><th>Last order</th><th className="align-right">Customer value</th></tr></thead><tbody>{items.map((customer, index) => <tr key={customer.customer_id}><td><span className="table-person"><i className={`customer-initial initial-${index % 5}`}>{initials(customer.name)}</i><strong>{customer.name}</strong></span></td><td><span className={`segment-chip ${customer.segment.toLowerCase().replaceAll(" ", "-")}`}>{customer.segment}</span></td><td>{number(customer.total_orders)}</td><td className="muted-cell">{dateLabel(customer.last_order)}</td><td className="align-right amount-cell">{currency(customer.lifetime_value ?? 0)}</td></tr>)}</tbody></table></div>}
    <Pagination total={total} offset={offset} limit={limit} onChange={setOffset} />
  </section>;
}

function Pagination({ total, offset, limit, onChange }: { total: number; offset: number; limit: number; onChange: (offset: number) => void }) {
  const first = total ? offset + 1 : 0;
  const last = Math.min(offset + limit, total);
  return <div className="pagination"><span>Showing <strong>{first}–{last}</strong> of <strong>{number(total)}</strong></span><div><button aria-label="Previous page" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}><ChevronLeft size={16} /></button><button aria-label="Next page" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}><ChevronRight size={16} /></button></div></div>;
}

function UploadModal({ onClose, onImported, onReset }: { onClose: () => void; onImported: (message: string) => void; onReset: (message: string) => void }) {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const handleUpload = async () => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const result = await api.upload(file);
      onImported(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally { setBusy(false); }
  };
  const resetSampleData = async () => {
    setResetBusy(true); setError("");
    try { const result = await api.reset(); onReset(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not restore sample data."); }
    finally { setResetBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="modal-heading"><div><span className="section-kicker">CONNECT YOUR DATA</span><h2 id="upload-title">Bring your sales into focus</h2></div><button className="plain-icon" aria-label="Close" onClick={onClose}><X size={19} /></button></div>
      <p className="modal-description">Upload a CSV of your transactions to add them to your local workspace. Your file stays on this machine.</p>
      <label className={`drop-zone ${file ? "has-file" : ""}`}><input type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0]); setError(""); }} /><span className="upload-symbol">{file ? <FileSpreadsheet size={22} /> : <CloudUpload size={23} />}</span><strong>{file ? file.name : "Choose a CSV file to upload"}</strong><small>{file ? `${(file.size / 1024).toFixed(0)} KB · ready to import` : "or drag and drop it here · up to 10 MB"}</small><span className="button button-secondary">{file ? "Choose another" : "Browse files"}</span></label>
      <div className="csv-requirements"><strong>Required columns</strong><p>order_date, customer_name, product_name, category, region, quantity, unit_price, status</p><small>Dates use YYYY-MM-DD. Optional columns: segment, cost_price.</small></div>
      {error && <div className="upload-error">{error}</div>}
      <div className="modal-footer"><button className="text-action reset-action" onClick={resetSampleData} disabled={resetBusy}>{resetBusy ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />} Restore demo data</button><div><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={handleUpload} disabled={!file || busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <CloudUpload size={16} />}{busy ? "Importing…" : "Import data"}</button></div></div>
    </section>
  </div>;
}

function TableLoading() {
  return <div className="table-loading"><LoaderCircle className="spin" size={21} />Loading records…</div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><Package size={21} /><span>{message}</span></div>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default App;
