const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function safeFetchJson(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchDashboard() {
  return safeFetchJson("/api/dashboard");
}

export async function fetchStatus() {
  return safeFetchJson("/api/status");
}

export async function fetchRecommendations(market: string) {
  return safeFetchJson(`/api/recommendations/${market}`);
}

export async function fetchReport(market: string) {
  return safeFetchJson(`/api/report/${market}`);
}

export async function triggerAgent(market: string) {
  const res = await safeFetchJson(`/api/run/${market}`, { method: "POST" });
  if (!res) throw new Error("Failed to trigger agent");
  return res;
}

export async function fetchUSTiming() {
  return safeFetchJson("/api/market-timing/us");
}

export async function fetchPlaybook(
  market: string,
  capital: number,
  riskPercent: number,
  maxPositions: number,
  autoRegime: boolean,
  regimeOverride?: "aggressive" | "balanced" | "defensive",
) {
  const params = new URLSearchParams({
    capital: String(capital),
    risk_percent: String(riskPercent),
    max_positions: String(maxPositions),
    auto_regime: String(autoRegime),
  });
  if (!autoRegime && regimeOverride) {
    params.set("regime_override", regimeOverride);
  }
  return safeFetchJson(`/api/playbook/${market}?${params.toString()}`);
}

export async function evaluatePortfolio(payload: {
  market: "india" | "us";
  positions: Array<{
    symbol: string;
    quantity: number;
    entry_price: number;
    stop_loss?: number | null;
    target_price?: number | null;
  }>;
}) {
  return safeFetchJson("/api/portfolio/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
