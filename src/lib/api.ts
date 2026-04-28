const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/api/dashboard`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchRecommendations(market: string) {
  const res = await fetch(`${API_BASE}/api/recommendations/${market}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchReport(market: string) {
  const res = await fetch(`${API_BASE}/api/report/${market}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function triggerAgent(market: string) {
  const res = await fetch(`${API_BASE}/api/run/${market}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to trigger agent");
  return res.json();
}

export async function fetchUSTiming() {
  const res = await fetch(`${API_BASE}/api/market-timing/us`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
