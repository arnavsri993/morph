# Morph Product Architecture

Morph is the verification layer between AI coding agents and frontend merges. The local CLI is intentionally deterministic, while the server shell models the SaaS surface a team would expect from a serious CI product.

## Core Loop

1. Inspect the configured frontend root.
2. Extract visual grammar from token CSS and component import maps.
3. Detect drift across visual tokens, component usage, interaction states, typography, and responsive constraints.
4. Classify severity and likely agent intent.
5. Emit JSON receipts plus a concise human report.
6. Generate deterministic replacement patches.
7. Optionally apply the patch and re-run verification.
8. Return a final pass/fail gate for CI.

## Runtime Surfaces

- `morph init` creates `morph.config.json`, `.morph/runs`, and safe env examples.
- `morph verify` emits a report suitable for CI logs or agent context.
- `morph repair` emits or applies deterministic remediation.
- `morph loop` verifies, repairs, verifies again, and returns the merge gate.
- `morph demo` runs the Acme SaaS sample review without mutating the seeded fixture.
- `morph serve` starts a dependency-free HTTP control plane.

## Repository Fixtures

- `morph.config.json` points at `fixtures/acme-saas-clean` and is the default product smoke gate. `npm run verify` should pass.
- `morph.demo.config.json` points at `fixtures/acme-saas` and keeps the seeded drift fixture available for demos, tests, and repair receipts.

## Server API

The built-in server stores run records under `.morph/runs` and exposes:

- `GET /` (public landing page — always reachable, even in oauth mode)
- `GET /studio` (Morph Studio dashboard — session-gated when `MORPH_AUTH_MODE=oauth`)
- `GET /login` (SSO buttons when OAuth is configured, a dev-mode explainer when it is not)
- `GET /api/health`
- `GET /api/projects`
- `GET /api/runs`
- `GET /api/runs/:id`
- `POST /api/runs/verify`
- `POST /api/runs/repair`
- `POST /api/runs/loop`
- `POST /api/studio/review`
- `GET /api/billing`
- `POST /api/auth/github` / `POST /api/auth/google` (runtime OAuth credential entry)
- `POST /api/billing/stripe` (runtime Stripe key entry)
- `POST /api/billing/checkout`
- `POST /api/webhooks/stripe`

Billing degrades gracefully. Without Stripe keys, checkout returns stub guidance and webhooks acknowledge without verification. With `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`, checkout creates a real Stripe Checkout session (subscription mode, success/cancel URLs back to `/studio`). With `STRIPE_WEBHOOK_SECRET`, webhook payloads are verified against the `Stripe-Signature` header — HMAC-SHA256 over `timestamp.body`, constant-time comparison, five-minute timestamp tolerance — and `checkout.session.completed` / `customer.subscription.*` events update the workspace plan stored in `.morph/billing.json`.

## Auth And Billing Readiness

`.env.example` documents the production secrets without including secrets:

- `AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

Development mode is explicit through `MORPH_AUTH_MODE=dev`. A production deployment should set `MORPH_AUTH_MODE=oauth`, require a signed session cookie, and scope all run reads/writes by workspace membership.

## Data Model

The current dependency-free storage shape is intentionally simple:

```text
Workspace
  Project
    Morph config
    Runs
      Report
      Repair plan
      Loop receipt
```

Each stored run is a JSON record with `id`, `kind`, `projectId`, `project`, `createdAt`, and `payload`. This can be swapped for Postgres without changing the scanner contract.

## Deployment Notes

The CLI can run in GitHub Actions today. The server can run on any Node 20 host:

```bash
cp .env.example .env
npm run serve -- --host 0.0.0.0 --port 4177
```

For production, place it behind TLS, set strong env secrets, verify Stripe webhooks, require auth for all non-health routes, and persist `.morph/runs` or replace it with a database-backed run store.
