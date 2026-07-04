# Morph

Morph is CI for agent-written frontend. It scans generated UI for design-system drift, explains why the drift matters, and emits machine-readable repair patches an agent can apply before a human reviews the PR.

This repo is a RAISE Summit Hackathon demo for the Cursor track: a local product fixture, seeded agent drift, verifier, repair loop, JSON receipts, stored runs, a small product API, an auth/billing-ready app shell, CI, and tests.

## Why this exists

Coding agents can make UI that works but does not belong in the product. Morph gives those agents a consistency layer:

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

Open the local product shell at `http://127.0.0.1:4177` after `npm run serve`.

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
- `serve` starts a local dashboard and API backed by `.morph/runs`.

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

- `GET /api/health`
- `GET /api/projects`
- `GET /api/runs`
- `GET /api/runs/:id`
- `POST /api/runs/verify`
- `POST /api/runs/repair`
- `POST /api/runs/loop`
- `POST /api/billing/checkout`
- `POST /api/webhooks/stripe`

Runs are stored as JSON under `.morph/runs`. The API is intentionally auth-ready rather than auth-fake: development mode is explicit, production secrets live in environment variables, and Stripe endpoints return stubbed setup guidance until configured.

## Auth and billing setup

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

Morph is not a generic dashboard and not a screenshot upload tool. It is a machine-readable verification loop for coding agents:

```text
Cursor/agent changes frontend -> Morph verify -> JSON findings + patches -> Morph repair -> verify again -> safe to merge
```

The public repo and collaborator invite checklist is in `docs/github-prep.md`.

## Existing tools checked

Chromatic, Loki, BackstopJS, stylelint, ESLint, and token linters cover pieces of this space. Morph's hackathon wedge is the agent-native loop: product grammar extraction, drift classification, and patch output designed for Cursor/Codex-style repair cycles.
