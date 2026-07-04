# Morph

Morph Studio is an interactive review experience for agent-written frontend. It scans generated UI for design-system drift, shows a before/after product review, explains why the drift matters, and emits machine-readable repair patches an agent can apply before a human reviews the PR.

This repo is a RAISE Summit Hackathon demo for the Cursor track: a local product fixture, seeded agent drift, verifier, isolated Studio review loop, JSON receipts, stored runs, an interactive Morph Studio app, a small product API, an auth/billing-ready app shell, CI, and tests.

## Why this exists

Coding agents can make UI that works but does not belong in the product. Morph improves the review journey for a real daily workflow: a developer receiving AI-generated frontend and needing to decide whether it is safe, polished, accessible, and consistent enough to merge. Morph gives those teams a consistency layer:

1. Read product tokens and component grammar.
2. Scan generated frontend files.
3. Classify drift across visual, component, interaction, and responsive surfaces.
4. Emit JSON findings with exact replacement patches.
5. Apply repairs and re-run until the UI passes.

## Quickstart

```bash
cd /Users/arnavsrivastava/.openclaw/workspace/morph
npm test
npm run verify -- --json --no-fail --output demo/reports/seeded-drift.json
npm run repair -- --json
npm run loop -- --apply --store
npm run demo
npm run serve
```

`npm run verify` intentionally fails without `--no-fail`, because the fixture contains seeded drift.

After `npm run serve`, open `http://127.0.0.1:4177`:

- `/` is the public product landing page (hero, live CLI demo, pricing, docs).
- `/studio` is the interactive Morph Studio review dashboard. The `Launch Studio` button on the landing page routes there.
- `/login` is the auth entry point: SSO buttons when OAuth is configured, a polished dev-mode state when it is not.

For the exact one-minute video and live judge flow, use `DEMO.md`.

## Commands

```bash
morph init
morph verify --config morph.config.json --json --store
morph repair --config morph.config.json --apply --json
morph loop --config morph.config.json --apply --store
morph demo
morph serve --config morph.config.json --host 127.0.0.1 --port 4177
```

- `init` creates `morph.config.json`, `.morph/runs`, and `.env.example`.
- `verify` scans frontend source and emits JSON plus a human report.
- `repair` generates deterministic replacements and can apply them.
- `loop` runs verify, repair, verify again, then returns a final CI gate.
- `demo` copies the seeded fixture, repairs the copy, and writes judge receipts.
- `serve` starts the Morph web app: the landing page at `/`, Morph Studio at `/studio`, and the API backed by `.morph/runs`. Studio full reviews run on `.studio-run/project` so the seeded fixture stays reusable.

## Demo flow

The fixture is `fixtures/acme-saas`, a tiny SaaS billing screen with a real design-token file and a seeded agent-generated drift in `src/routes/settings/billing.tsx`.

The drift includes:

- off-scale spacing
- a new card radius
- hardcoded almost-brand colors
- raw button markup instead of the shared `Button`
- removed focus state
- mobile overflow risk
- heavy elevation outside the product grammar

Run:

```bash
npm run demo
```

The script copies the fixture to `.demo-run`, writes:

- `demo/reports/demo-before.json`
- `demo/reports/demo-repair.json`
- `demo/reports/demo-after.json`
- `demo/terminal-transcript.txt` captures the judge-friendly command transcript.

The source fixture remains seeded so judges can see the catch.

## Product API

`morph serve` starts a dependency-free Node HTTP server with:

- `GET /` (landing page)
- `GET /studio` (Morph Studio dashboard)
- `GET /login` (auth entry)
- `GET /api/health`
- `GET /api/projects`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/billing`
- `POST /api/runs/verify`
- `POST /api/runs/repair`
- `POST /api/runs/loop`
- `POST /api/studio/review`
- `POST /api/auth/github` (save GitHub OAuth credentials at runtime)
- `POST /api/auth/google` (save Google OAuth credentials at runtime)
- `POST /api/billing/stripe` (save Stripe keys at runtime)
- `POST /api/billing/checkout` (live Stripe Checkout session, or stub guidance until configured)
- `POST /api/webhooks/stripe` (signature-verified when `STRIPE_WEBHOOK_SECRET` is set)

Runs are stored as JSON under `.morph/runs`. The API is auth-ready rather than auth-fake: development mode is explicit and production secrets live in environment variables.

## Auth and billing setup

Google and GitHub sign-in are fully wired. Add credentials either through `.env` or live from the Studio `Connect` panel (GitHub / Google / Billing tabs) — saved credentials enable the SSO buttons on `/login` immediately, no restart needed. Set `MORPH_AUTH_MODE=oauth` to require a signed session for Studio and the API.

Stripe billing has two modes:

- **Stub mode** (default): `POST /api/billing/checkout` returns setup guidance, webhooks acknowledge without verification. No fake charges.
- **Live mode**: once `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set (via `.env` or the Studio Billing tab), `Upgrade to Team` creates a real Stripe Checkout session and redirects the browser. With `STRIPE_WEBHOOK_SECRET` set, `POST /api/webhooks/stripe` verifies the `Stripe-Signature` header (HMAC, timestamp tolerance) and updates the workspace plan in `.morph/billing.json`.

Copy `.env.example` to `.env` for local product-shell work. Do not commit real secrets.

Required production-style variables:

- `AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `MORPH_APP_URL`

See `docs/product-architecture.md` for the workspace/project/run model and deployment notes.

## Example report shape

```json
{
  "schemaVersion": "morph.report.v1",
  "verdict": "fail",
  "score": 71,
  "issues": [
    {
      "id": "radius-drift",
      "type": "design_drift",
      "severity": "high",
      "file": "src/routes/settings/billing.tsx",
      "classification": "accidental_drift",
      "suggestedFix": "Use the product card radius token.",
      "patch": {
        "file": "src/routes/settings/billing.tsx",
        "replacements": [
          {
            "find": "rounded-[28px]",
            "replace": "rounded-[var(--radius-card)]"
          }
        ]
      }
    }
  ]
}
```

## Hackathon positioning

Morph is not a generic dashboard and not a screenshot upload tool. It is an interactive review journey plus a machine-readable verification loop for coding agents:

```text
Cursor changes frontend -> Morph Studio review -> JSON findings + patches -> Morph repair -> verify again -> safe to merge
```

The public repo and collaborator invite checklist is in `docs/github-prep.md`.

## Existing tools checked

Chromatic, Loki, BackstopJS, stylelint, ESLint, and token linters cover pieces of this space. Morph's hackathon wedge is the agent-native loop: product grammar extraction, drift classification, and patch output designed for Cursor/Codex-style repair cycles.
