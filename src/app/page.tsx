"use client";

import { useState, useEffect, useCallback } from "react";
import { evaluatePortfolio, fetchDashboard, fetchPlaybook, fetchStatus, triggerAgent } from "@/lib/api";

/* ── Types (mirrors backend schemas) ─────────────────── */
interface IndexData { symbol: string; name: string; current_value: number; change: number; change_percent: number; }
interface StockPrice { symbol: string; name: string; current_price: number; change_percent: number; volume: number; currency: string; }
interface NewsArticle { title: string; summary: string; source: string; url: string; published_at: string | null; }
interface Recommendation {
  symbol: string; name: string; recommendation: string; composite_score: number;
  risk_level: string; current_price: number; entry_price: number | null;
  stop_loss: number | null; target_price_1: number | null; target_price_2: number | null;
  potential_upside: number | null; sentiment_score: number; fundamental_score: number;
  technical_score: number; rationale: string; key_catalysts: string[]; risks: string[];
  sector: string; confidence: number; generated_at: string;
}
interface AgentReport {
  market: string; status: string;
  overview: { indices: IndexData[]; top_gainers: StockPrice[]; top_losers: StockPrice[]; market_summary: string; market_sentiment: string; } | null;
  recommendations: Recommendation[]; news: NewsArticle[];
  started_at: string | null; completed_at: string | null; duration_seconds: number | null;
  stocks_analyzed: number; news_articles_processed: number; errors: string[];
}
interface DashboardData { india: AgentReport | null; us: AgentReport | null; next_india_run: string | null; next_us_run: string | null; }
interface PlaybookPick {
  symbol: string;
  name: string;
  recommendation: string;
  risk_level: string;
  confidence: number;
  composite_score: number;
  entry_price: number;
  stop_loss: number | null;
  target_price_1: number | null;
  potential_upside: number | null;
  risk_per_share: number | null;
  position_size_shares: number;
  capital_required: number;
  max_loss_at_stop: number;
  reward_to_risk: number | null;
  thesis: string;
}
interface PlaybookData {
  market: string;
  date: string;
  capital: number;
  risk_percent_per_trade: number;
  effective_risk_percent_per_trade?: number;
  max_positions: number;
  effective_max_positions?: number;
  regime?: {
    mode: string;
    source: string;
    reason: string;
    risk_multiplier: number;
    position_multiplier: number;
  };
  guardrails: {
    risk_budget_per_trade?: number;
    total_capital_deployed?: number;
    capital_utilization_percent?: number;
    total_worst_case_loss?: number;
    warnings?: string[];
  };
  picks: PlaybookPick[];
}
interface PortfolioPosition {
  symbol: string;
  quantity: number;
  entry_price: number;
  stop_loss?: number;
  target_price?: number;
}
interface PortfolioEvaluatedPosition {
  symbol: string;
  name: string;
  quantity: number;
  entry_price: number;
  live_price: number;
  stop_loss: number | null;
  target_price: number | null;
  invested: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  stop_distance_percent: number | null;
  target_distance_percent: number | null;
  status: string;
  currency: string;
}
interface PortfolioEvaluation {
  market: string;
  generated_at: string;
  summary: {
    positions_count: number;
    invested_capital: number;
    current_value: number;
    unrealized_pnl: number;
    unrealized_pnl_percent: number;
    risk_alerts: number;
  };
  positions: PortfolioEvaluatedPosition[];
  alerts: string[];
}

/* ── Helper Components ───────────────────────────────── */

function RecBadge({ type }: { type: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    strong_buy: { cls: "badge-buy", label: "Strong Buy" },
    buy: { cls: "badge-buy", label: "Buy" },
    hold: { cls: "badge-hold", label: "Hold" },
    sell: { cls: "badge-sell", label: "Sell" },
    strong_sell: { cls: "badge-sell", label: "Strong Sell" },
  };
  const b = map[type] || { cls: "badge-neutral", label: type };
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = { low: "badge-buy", medium: "badge-hold", high: "badge-sell", very_high: "badge-sell" };
  return <span className={`badge ${map[level] || "badge-neutral"}`}>{level.replace("_", " ")}</span>;
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rec-score-item">
      <div className="rec-score-label">{label}</div>
      <div className="rec-score-value" style={{ color }}>{value.toFixed(0)}</div>
      <div style={{ height: 3, background: "var(--bg-secondary)", borderRadius: 2, marginTop: 4 }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Main Dashboard ──────────────────────────────────── */

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [market, setMarket] = useState<"india" | "us">("india");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusPoll, setStatusPoll] = useState(0);
  const [capital, setCapital] = useState(200000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [maxPositions, setMaxPositions] = useState(5);
  const [autoRegime, setAutoRegime] = useState(true);
  const [regimeOverride, setRegimeOverride] = useState<"aggressive" | "balanced" | "defensive">("balanced");
  const [playbook, setPlaybook] = useState<PlaybookData | null>(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([
    { symbol: "RELIANCE.NS", quantity: 20, entry_price: 2950, stop_loss: 2875, target_price: 3080 },
  ]);
  const [portfolioEval, setPortfolioEval] = useState<PortfolioEvaluation | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const d = await fetchDashboard();
      if (d) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadPlaybook = useCallback(async () => {
    setPlaybookLoading(true);
    try {
      const pb = await fetchPlaybook(market, capital, riskPercent, maxPositions, autoRegime, regimeOverride);
      if (pb) setPlaybook(pb as PlaybookData);
    } catch {
      // Ignore transient API failures for playbook.
    } finally {
      setPlaybookLoading(false);
    }
  }, [autoRegime, capital, market, maxPositions, regimeOverride, riskPercent]);

  useEffect(() => {
    loadPlaybook();
  }, [loadPlaybook]);

  useEffect(() => {
    const key = `portfolio-positions-${market}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as PortfolioPosition[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPortfolioPositions(parsed);
          return;
        }
      }
      setPortfolioPositions(
        market === "india"
          ? [{ symbol: "RELIANCE.NS", quantity: 20, entry_price: 2950, stop_loss: 2875, target_price: 3080 }]
          : [{ symbol: "AAPL", quantity: 10, entry_price: 180, stop_loss: 172, target_price: 195 }],
      );
    } catch {
      // Ignore localStorage parse issues.
    }
  }, [market]);

  useEffect(() => {
    const key = `portfolio-positions-${market}`;
    try {
      localStorage.setItem(key, JSON.stringify(portfolioPositions));
    } catch {
      // Ignore localStorage write issues.
    }
  }, [market, portfolioPositions]);

  // Poll while agent is running
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await fetchStatus();
        if (s) {
          const isRunning = ["collecting_data", "analyzing", "generating_recommendations"].includes(s.india_agent) ||
                            ["collecting_data", "analyzing", "generating_recommendations"].includes(s.us_agent);
          if (isRunning) { loadData(); setStatusPoll(p => p + 1); }
        }
      } catch {
        // Ignore transient network errors during polling.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleTrigger = async (m: string) => {
    setTriggering(true);
    try { await triggerAgent(m); } catch { /* */ }
    setTimeout(() => { setTriggering(false); loadData(); }, 2000);
  };

  const evaluateCurrentPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const sanitized = portfolioPositions
        .filter((p) => p.symbol && p.quantity > 0 && p.entry_price > 0)
        .map((p) => ({
          symbol: p.symbol.trim(),
          quantity: p.quantity,
          entry_price: p.entry_price,
          stop_loss: p.stop_loss ?? null,
          target_price: p.target_price ?? null,
        }));

      const result = await evaluatePortfolio({ market, positions: sanitized });
      if (result) setPortfolioEval(result as PortfolioEvaluation);
    } catch {
      // Ignore transient API failures.
    } finally {
      setPortfolioLoading(false);
    }
  }, [market, portfolioPositions]);

  useEffect(() => {
    evaluateCurrentPortfolio();
  }, [evaluateCurrentPortfolio]);

  const report = market === "india" ? data?.india : data?.us;
  const overview = report?.overview;
  const recs = report?.recommendations || [];
  const news = report?.news || [];

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <div className="logo-icon">📈</div>
            Investment Autopilot
          </div>

          <div className="market-tabs">
            <button className={`market-tab ${market === "india" ? "active" : ""}`} onClick={() => setMarket("india")}>
              🇮🇳 India
            </button>
            <button className={`market-tab ${market === "us" ? "active" : ""}`} onClick={() => setMarket("us")}>
              🇺🇸 US
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
              <span className={`status-dot ${report?.status === "complete" ? "active" : report?.status === "error" ? "error" : "idle"}`} />
              {report?.status || "No data"}
            </div>
            <button className="btn btn-primary" disabled={triggering} onClick={() => handleTrigger(market)}>
              {triggering ? "⏳ Running..." : "▶ Run Agent"}
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 28, paddingBottom: 60 }}>
        {/* Agent Info Bar */}
        {report && (
          <div className="glass-card animate-in" style={{ padding: "14px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <span>📊 Stocks analyzed: <strong style={{ color: "var(--text-primary)" }}>{report.stocks_analyzed}</strong></span>
            <span>📰 News processed: <strong style={{ color: "var(--text-primary)" }}>{report.news_articles_processed}</strong></span>
            <span>⏱️ Duration: <strong style={{ color: "var(--text-primary)" }}>{report.duration_seconds?.toFixed(0)}s</strong></span>
            <span>🕐 Last run: <strong style={{ color: "var(--text-primary)" }}>{formatTime(report.completed_at)} · {formatDate(report.completed_at)}</strong></span>
          </div>
        )}

        {/* Indices */}
        {overview && overview.indices.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div className="section-header"><h2 className="section-title">Market Indices</h2></div>
            <div className="grid-4">
              {overview.indices.map((idx, i) => (
                <div key={idx.symbol} className="glass-card index-card animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="name">{idx.name}</div>
                  <div className="value">{idx.current_value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                  <div className={`change ${idx.change_percent >= 0 ? "positive" : "negative"}`}>
                    {idx.change_percent >= 0 ? "▲" : "▼"} {Math.abs(idx.change).toFixed(2)} ({idx.change_percent >= 0 ? "+" : ""}{idx.change_percent.toFixed(2)}%)
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Market Summary */}
        {overview?.market_summary && (
          <section className="animate-in" style={{ marginBottom: 28, animationDelay: "0.3s" }}>
            <div className="section-header">
              <h2 className="section-title">AI Market Brief</h2>
              <span className={`badge ${overview.market_sentiment === "bullish" || overview.market_sentiment === "very_bullish" ? "badge-bullish" : overview.market_sentiment === "bearish" || overview.market_sentiment === "very_bearish" ? "badge-bearish" : "badge-neutral"}`}>
                {overview.market_sentiment}
              </span>
            </div>
            <div className="glass-card market-summary">{overview.market_summary}</div>
          </section>
        )}

        {/* Recommendations */}
        <section style={{ marginBottom: 28 }}>
          <div className="section-header">
            <h2 className="section-title">⚙️ Execution Playbook</h2>
            <span className="section-subtitle">Capital-aware sizing with risk guardrails</span>
          </div>

          <div className="glass-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Capital
                <input
                  type="number"
                  min={10000}
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value || 0))}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Risk % / Trade
                <input
                  type="number"
                  min={0.25}
                  max={5}
                  step={0.25}
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value || 0))}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Max Positions
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(Number(e.target.value || 1))}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Regime Mode
                <select
                  value={autoRegime ? "auto" : regimeOverride}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "auto") {
                      setAutoRegime(true);
                    } else {
                      setAutoRegime(false);
                      setRegimeOverride(v as "aggressive" | "balanced" | "defensive");
                    }
                  }}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                >
                  <option value="auto">Auto</option>
                  <option value="aggressive">Aggressive</option>
                  <option value="balanced">Balanced</option>
                  <option value="defensive">Defensive</option>
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="btn btn-primary" onClick={loadPlaybook} disabled={playbookLoading}>
                  {playbookLoading ? "Refreshing..." : "Refresh Playbook"}
                </button>
              </div>
            </div>
          </div>

          {playbook && (
            <>
              {playbook.regime && (
                <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 12, fontSize: "0.8rem", color: "var(--text-secondary)", borderColor: "rgba(99, 102, 241, 0.35)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Regime: {playbook.regime.mode.toUpperCase()}</strong>
                  <span style={{ marginLeft: 10 }}>Source: {playbook.regime.source}</span>
                  <span style={{ marginLeft: 10 }}>Reason: {playbook.regime.reason}</span>
                </div>
              )}

              <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <span>Risk budget/trade: <strong style={{ color: "var(--text-primary)" }}>{Number(playbook.guardrails?.risk_budget_per_trade ?? 0).toLocaleString()}</strong></span>
                <span>Capital deployed: <strong style={{ color: "var(--text-primary)" }}>{Number(playbook.guardrails?.total_capital_deployed ?? 0).toLocaleString()}</strong></span>
                <span>Utilization: <strong style={{ color: "var(--text-primary)" }}>{Number(playbook.guardrails?.capital_utilization_percent ?? 0).toFixed(1)}%</strong></span>
                <span>Worst-case loss: <strong style={{ color: "var(--accent-rose)" }}>{Number(playbook.guardrails?.total_worst_case_loss ?? 0).toLocaleString()}</strong></span>
                <span>Effective risk %: <strong style={{ color: "var(--text-primary)" }}>{Number(playbook.effective_risk_percent_per_trade ?? playbook.risk_percent_per_trade).toFixed(2)}%</strong></span>
                <span>Effective positions: <strong style={{ color: "var(--text-primary)" }}>{playbook.effective_max_positions ?? playbook.max_positions}</strong></span>
              </div>

              {(playbook.guardrails?.warnings ?? []).length > 0 && (
                <div className="glass-card" style={{ padding: 14, marginBottom: 14, borderColor: "rgba(245, 158, 11, 0.4)" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-amber)", marginBottom: 8 }}>Risk Warnings</div>
                  <ul style={{ paddingLeft: 16, margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    {(playbook.guardrails?.warnings ?? []).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {(playbook.picks ?? []).length > 0 && (
                <div className="grid-2" style={{ marginBottom: 8 }}>
                  {(playbook.picks ?? []).map((pick) => (
                    <div key={pick.symbol} className="glass-card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{pick.symbol.replace(".NS", "")}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{pick.name}</div>
                        </div>
                        <RecBadge type={pick.recommendation} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.8rem" }}>
                        <div>Entry: <strong>{pick.entry_price.toLocaleString()}</strong></div>
                        <div>Stop: <strong>{pick.stop_loss?.toLocaleString() || "—"}</strong></div>
                        <div>Target: <strong>{pick.target_price_1?.toLocaleString() || "—"}</strong></div>
                        <div>Qty: <strong>{pick.position_size_shares.toLocaleString()}</strong></div>
                        <div>Capital: <strong>{pick.capital_required.toLocaleString()}</strong></div>
                        <div>Max Loss: <strong style={{ color: "var(--accent-rose)" }}>{pick.max_loss_at_stop.toLocaleString()}</strong></div>
                        <div>R:R: <strong>{pick.reward_to_risk || "—"}</strong></div>
                        <div>Confidence: <strong>{pick.confidence.toFixed(0)}</strong></div>
                      </div>
                      <div style={{ marginTop: 10, color: "var(--text-secondary)", fontSize: "0.78rem", lineHeight: 1.45 }}>
                        {pick.thesis}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <div className="section-header">
            <h2 className="section-title">📂 Portfolio Monitor</h2>
            <span className="section-subtitle">Live PnL, stop/target breach alerts, and position health</span>
          </div>

          <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button
                className="btn"
                onClick={() => setPortfolioPositions((prev) => [...prev, {
                  symbol: market === "india" ? "TCS.NS" : "MSFT",
                  quantity: 1,
                  entry_price: 1,
                }])}
              >
                + Add Position
              </button>
              <button className="btn btn-primary" onClick={evaluateCurrentPortfolio} disabled={portfolioLoading}>
                {portfolioLoading ? "Evaluating..." : "Evaluate Portfolio"}
              </button>
            </div>

            {portfolioPositions.map((p, i) => (
              <div key={`${p.symbol}-${i}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <input value={p.symbol} onChange={(e) => setPortfolioPositions((prev) => prev.map((row, idx) => idx === i ? { ...row, symbol: e.target.value } : row))}
                  placeholder={market === "india" ? "RELIANCE.NS" : "AAPL"}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }} />
                <input type="number" value={p.quantity} onChange={(e) => setPortfolioPositions((prev) => prev.map((row, idx) => idx === i ? { ...row, quantity: Number(e.target.value || 0) } : row))}
                  placeholder="Qty"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }} />
                <input type="number" value={p.entry_price} onChange={(e) => setPortfolioPositions((prev) => prev.map((row, idx) => idx === i ? { ...row, entry_price: Number(e.target.value || 0) } : row))}
                  placeholder="Entry"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }} />
                <input type="number" value={p.stop_loss ?? ""} onChange={(e) => setPortfolioPositions((prev) => prev.map((row, idx) => idx === i ? { ...row, stop_loss: e.target.value ? Number(e.target.value) : undefined } : row))}
                  placeholder="Stop"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }} />
                <input type="number" value={p.target_price ?? ""} onChange={(e) => setPortfolioPositions((prev) => prev.map((row, idx) => idx === i ? { ...row, target_price: e.target.value ? Number(e.target.value) : undefined } : row))}
                  placeholder="Target"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }} />
                <button className="btn" onClick={() => setPortfolioPositions((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
              </div>
            ))}
          </div>

          {portfolioEval && (
            <>
              <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>Invested: <strong style={{ color: "var(--text-primary)" }}>{portfolioEval.summary.invested_capital.toLocaleString()}</strong></span>
                <span>Current value: <strong style={{ color: "var(--text-primary)" }}>{portfolioEval.summary.current_value.toLocaleString()}</strong></span>
                <span>PnL: <strong style={{ color: portfolioEval.summary.unrealized_pnl >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>{portfolioEval.summary.unrealized_pnl.toLocaleString()} ({portfolioEval.summary.unrealized_pnl_percent.toFixed(2)}%)</strong></span>
                <span>Risk alerts: <strong style={{ color: portfolioEval.summary.risk_alerts > 0 ? "var(--accent-rose)" : "var(--text-primary)" }}>{portfolioEval.summary.risk_alerts}</strong></span>
              </div>

              {(portfolioEval.alerts ?? []).length > 0 && (
                <div className="glass-card" style={{ padding: 14, marginBottom: 12, borderColor: "rgba(244, 63, 94, 0.45)" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-rose)", marginBottom: 8 }}>Portfolio Alerts</div>
                  <ul style={{ paddingLeft: 16, margin: 0, color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    {(portfolioEval.alerts ?? []).map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              <div className="glass-card" style={{ overflow: "hidden" }}>
                {(portfolioEval.positions ?? []).map((pos) => (
                  <div key={pos.symbol} className="news-item" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{pos.symbol.replace(".NS", "")}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{pos.name}</div>
                    </div>
                    <div style={{ fontSize: "0.78rem" }}>Entry/LTP: <strong>{pos.entry_price} / {pos.live_price}</strong></div>
                    <div style={{ fontSize: "0.78rem" }}>Qty: <strong>{pos.quantity}</strong></div>
                    <div style={{ fontSize: "0.78rem" }}>PnL: <strong style={{ color: pos.unrealized_pnl >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>{pos.unrealized_pnl.toFixed(2)} ({pos.unrealized_pnl_percent.toFixed(2)}%)</strong></div>
                    <div style={{ fontSize: "0.78rem" }}>Stop dist: <strong>{pos.stop_distance_percent != null ? `${pos.stop_distance_percent.toFixed(2)}%` : "—"}</strong></div>
                    <div>
                      <span className={`badge ${pos.status === "stop_breach" ? "badge-sell" : pos.status === "target_hit" ? "badge-buy" : "badge-neutral"}`}>{pos.status.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <div className="section-header">
            <h2 className="section-title">🎯 Top Recommendations</h2>
            <span className="section-subtitle">{recs.length} stocks analyzed</span>
          </div>
          {recs.length === 0 ? (
            <div className="glass-card empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No recommendations yet</div>
              <p>Click "Run Agent" to start analyzing the {market === "india" ? "Indian" : "US"} market</p>
            </div>
          ) : (
            <div className="grid-2">
              {recs.map((rec, i) => (
                <div key={rec.symbol} className="glass-card rec-card animate-in" style={{ animationDelay: `${i * 0.06}s` }}
                  onClick={() => setExpanded(expanded === rec.symbol ? null : rec.symbol)}>
                  <div className="rec-header">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="rec-symbol">{rec.symbol.replace(".NS", "")}</span>
                        <RecBadge type={rec.recommendation} />
                        <RiskBadge level={rec.risk_level} />
                      </div>
                      <div className="rec-name">{rec.name} · {rec.sector}</div>
                    </div>
                    <div className="rec-price">
                      <div>{rec.current_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                      {rec.potential_upside != null && (
                        <div style={{ fontSize: "0.75rem", color: rec.potential_upside >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                          {rec.potential_upside >= 0 ? "↑" : "↓"} {Math.abs(rec.potential_upside).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rec-scores">
                    <ScoreBar value={Math.min(100, Math.max(0, rec.sentiment_score + 50))} label="Sentiment" color="var(--accent-cyan)" />
                    <ScoreBar value={rec.fundamental_score} label="Fundamental" color="var(--accent-violet)" />
                    <ScoreBar value={rec.technical_score} label="Technical" color="var(--accent-amber)" />
                    <ScoreBar value={rec.confidence} label="Confidence" color="var(--accent-indigo)" />
                  </div>

                  {(rec.entry_price || rec.stop_loss || rec.target_price_1) && (
                    <div className="rec-targets">
                      <div className="rec-target">
                        <div className="rec-target-label">Entry</div>
                        <div className="rec-target-value positive">{rec.entry_price?.toLocaleString() || "—"}</div>
                      </div>
                      <div className="rec-target">
                        <div className="rec-target-label">Stop Loss</div>
                        <div className="rec-target-value negative">{rec.stop_loss?.toLocaleString() || "—"}</div>
                      </div>
                      <div className="rec-target">
                        <div className="rec-target-label">Target</div>
                        <div className="rec-target-value positive">{rec.target_price_1?.toLocaleString() || "—"}</div>
                      </div>
                    </div>
                  )}

                  <div className="rec-rationale">{rec.rationale}</div>

                  {expanded === rec.symbol && (
                    <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "0.8rem" }}>
                      {rec.key_catalysts.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, color: "var(--accent-emerald)", marginBottom: 4 }}>Key Catalysts</div>
                          <ul style={{ paddingLeft: 16, color: "var(--text-secondary)" }}>
                            {rec.key_catalysts.map((c, j) => <li key={j} style={{ marginBottom: 2 }}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {rec.risks.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--accent-rose)", marginBottom: 4 }}>Risks</div>
                          <ul style={{ paddingLeft: 16, color: "var(--text-secondary)" }}>
                            {rec.risks.map((r, j) => <li key={j} style={{ marginBottom: 2 }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {rec.target_price_2 && (
                        <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                          Medium-term target: <strong style={{ color: "var(--accent-emerald)" }}>{rec.target_price_2.toLocaleString()}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Two-column: Gainers/Losers + News */}
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {/* Top Movers */}
          <div>
            {overview && overview.top_gainers.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <div className="section-header"><h2 className="section-title" style={{ fontSize: "1rem" }}>🟢 Top Gainers</h2></div>
                <div className="glass-card" style={{ overflow: "hidden" }}>
                  {overview.top_gainers.slice(0, 7).map((s, i) => (
                    <div key={s.symbol} className="news-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.symbol.replace(".NS", "")}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.current_price.toLocaleString()}</div>
                        <div className="positive" style={{ fontSize: "0.78rem" }}>+{s.change_percent.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {overview && overview.top_losers.length > 0 && (
              <section>
                <div className="section-header"><h2 className="section-title" style={{ fontSize: "1rem" }}>🔴 Top Losers</h2></div>
                <div className="glass-card" style={{ overflow: "hidden" }}>
                  {overview.top_losers.slice(0, 7).map((s) => (
                    <div key={s.symbol} className="news-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.symbol.replace(".NS", "")}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.current_price.toLocaleString()}</div>
                        <div className="negative" style={{ fontSize: "0.78rem" }}>{s.change_percent.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* News */}
          <section>
            <div className="section-header"><h2 className="section-title" style={{ fontSize: "1rem" }}>📰 Latest News</h2></div>
            <div className="glass-card" style={{ overflow: "hidden", maxHeight: 650, overflowY: "auto" }}>
              {news.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div>No news articles yet</div>
                </div>
              ) : (
                news.slice(0, 20).map((n, i) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="news-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div className="news-title">{n.title}</div>
                    <div className="news-meta">
                      <span>{n.source}</span>
                      {n.published_at && <span>{formatDate(n.published_at)} {formatTime(n.published_at)}</span>}
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Next Run Info */}
        {data && (
          <div className="glass-card animate-in" style={{ padding: "16px 20px", display: "flex", justifyContent: "center", gap: 40, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            <span>🇮🇳 Next India run: <strong style={{ color: "var(--text-primary)" }}>{data.next_india_run ? `${formatDate(data.next_india_run)} ${formatTime(data.next_india_run)}` : "—"}</strong></span>
            <span>🇺🇸 Next US run: <strong style={{ color: "var(--text-primary)" }}>{data.next_us_run ? `${formatDate(data.next_us_run)} ${formatTime(data.next_us_run)}` : "—"}</strong></span>
          </div>
        )}
      </main>
    </>
  );
}
