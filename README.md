# Investment Autopilot Frontend

Frontend dashboard for Investment Autopilot, an AI-powered market intelligence and trade-planning system for Indian and US markets.

## Live Deployments

- Frontend (Vercel): https://frontend-rho-cyan-1g2hzgp9vm.vercel.app
- Backend API (Vercel): https://backend-phi-lyart-72.vercel.app
- Backend health check: https://backend-phi-lyart-72.vercel.app/api/status

## Key Features

- India/US market dashboard with agent run status and scheduling context.
- AI recommendations with confidence, risk level, rationale, catalysts, and risks.
- Execution Playbook:
	- Capital-aware position sizing
	- Risk budget guardrails
	- Regime-aware adjustments (auto or manual override)
- Portfolio Mode:
	- Add and persist positions in browser storage
	- Live mark-to-market PnL
	- Stop-loss breach and target-hit alerts

## Local Development

### Prerequisites

- Node.js 20+
- Backend API running locally on port 8000 (or set a custom API URL)

### Install

```bash
npm install
```

### Environment

Create `.env.local` in `frontend/`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production deployments, set `NEXT_PUBLIC_API_URL` to your public backend URL.

### Run

```bash
npm run dev
```

Open http://localhost:3000.

## Deployment Notes

- Frontend is deployed using Vercel.
- Build-time environment variable required:
	- `NEXT_PUBLIC_API_URL`
- If backend URL changes, redeploy frontend with updated `NEXT_PUBLIC_API_URL`.

## Source of Truth Prompt

Project-level implementation and change guidance is maintained in:

- `PROJECT_PROMPT.md`
