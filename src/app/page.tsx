"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchDashboard, fetchStatus, triggerAgent } from "@/lib/api";

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

  const loadData = useCallback(async () => {
    try {
      const d = await fetchDashboard();
      if (d) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
