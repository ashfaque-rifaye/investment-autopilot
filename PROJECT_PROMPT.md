# Investment Autopilot - Product Prompt (Source of Truth)

Use this prompt with coding assistants such as GitHub Copilot, Lovable, or Emergent.

## Purpose
Build a production-ready AI-powered stock intelligence platform that provides actionable daily recommendations for Indian and US markets, with automated pre-market data collection, deep analysis, and clear risk-aware trade suggestions.

## Core Outcome
When I open the app:
- By 8:30 AM IST: I should see complete India-market recommendations for the day.
- By 6:30 PM IST (US pre-open, DST-aware): I should see complete US-market recommendations.

Each recommendation must be based on:
- Previous market conditions
- Financial results and fundamentals
- Company announcements/corporate actions
- Recent, reliable news and sentiment
- Technical indicators and index context

## Product Scope
### 1) Market Coverage
- Indian stock market
- US stock market

### 2) Agent Scheduling
- India agent window: start collecting from 7:30 AM IST, finalize by 8:45 AM IST.
- US agent window: start collecting from 5:30 PM IST, deliver actionable output by 6:30 PM IST.
- US timing must be DST-aware and clearly shown in UI/reporting.
- Jobs should run automatically via scheduler/cron and also support manual trigger.

### 3) Data Collection Requirements
For each market cycle, collect and normalize:
- Major index snapshots and movement context
- Stock-level price/volume/volatility/technical indicators
- Fundamentals (valuation, growth, profitability, debt, cash flow where available)
- News from multiple reliable sources with source + timestamp metadata
- Corporate/market announcements when available
- Macro context signals relevant to that market session

### 4) AI Analysis Requirements
Use provided inference model/gateway for:
- Market sentiment analysis (headline + article-level)
- Fundamental scoring
- Technical scoring
- Composite ranking and recommendation classification
- Rationale generation and key catalysts/risks

Recommendation output should include:
- Symbol, market, current price
- Recommendation type (strong buy/buy/hold/sell)
- Confidence score and risk level
- Entry, stop loss, target(s), potential upside/downside
- Plain-language rationale
- Key catalysts and key risks
- Data freshness timestamps

### 5) Dashboard / UX Requirements
Build a practical trader-focused dashboard:
- India/US tabs
- Agent status and last run details
- Market summary with sentiment badge
- Top recommendations with expandable details
- Top gainers/losers and latest news panels
- Upcoming next run times
- Graceful loading/error states
- Responsive desktop + mobile layout

### 6) Notifications
Optional but supported:
- Telegram notification with top picks and rationale after each completed run
- Include timestamp and market session context in notifications

### 7) Backend Requirements
- FastAPI service with endpoints for dashboard, status, run trigger, reports, and recommendations
- Robust scheduler lifecycle management
- Persist reports/history to local DB
- Structured logging and fault-tolerant execution

### 8) Reliability / Quality Bar
- No frontend crashes if backend is temporarily unavailable
- All network operations should handle timeout/retry/fallback cleanly
- Clearly distinguish "no data yet" vs "error"
- Validate schema compatibility between backend and frontend

### 9) Configuration / Secrets
Use environment variables for:
- Inference gateway URL + API key (required for AI analysis)
- Optional market/news providers (Alpha Vantage/Finnhub/Marketaux)
- Optional Telegram bot settings
- Scheduling and timezone settings

Never commit real secrets.

## Technical Constraints
- Keep architecture modular: agents, data sources, analysis engine, API, notifications.
- Maintain code readability and typed contracts.
- Prioritize deterministic and explainable recommendation output.

## Acceptance Criteria
The solution is acceptable when:
- Automated India and US jobs run on schedule and produce usable reports.
- Opening the app at target times shows complete, fresh recommendations.
- Recommendations include entry/risk/rationale details and are backed by current data.
- Frontend remains stable even if backend/data providers are temporarily failing.
- Reports are persisted and visible through API/dashboard.

## Current Implemented Features
- AI recommendation pipeline for India and US markets with scheduled jobs and manual triggers.
- Execution Playbook that converts recommendations into capital-aware trade plans.
- Risk-based position sizing with per-trade risk budget and total portfolio guardrails.
- Market Regime Engine (auto + manual override) to adapt effective risk percent and effective max positions.
- Portfolio Mode with:
	- Persistent position inputs (market-specific local persistence in frontend)
	- Live mark-to-market PnL and PnL percent
	- Stop-loss breach and target-hit alerts
	- Position health/status monitor for active trades

## Deployment
- Frontend (Production): https://frontend-rho-cyan-1g2hzgp9vm.vercel.app
- Backend API (Production): https://backend-phi-lyart-72.vercel.app
- Backend Health Endpoint: https://backend-phi-lyart-72.vercel.app/api/status

## Change Management Rules
Whenever requirements or implementation changes:
1. Update this file first.
2. Add a short "what changed" note under the section below.
3. Ensure API/schema expectations stay consistent with frontend rendering.

## Change Log
- 2026-04-28: Initial prompt baseline added for reusable agent handoff and implementation alignment.
- 2026-04-28: Added execution playbook capability with risk-based position sizing, capital guardrails, and per-pick trade plan output.
- 2026-04-28: Added market regime engine (auto + manual override) to adapt effective risk % and position count by sentiment state.
- 2026-04-28: Added frontend resilience guards for partial/empty playbook payloads to prevent runtime UI crashes.
- 2026-04-28: Added Portfolio Mode with position persistence, live PnL monitoring, and stop-loss/target breach alerts.
