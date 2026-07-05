# Morph

Morph Studio is an interactive review experience for agent-written frontend. It scans generated UI for design-system drift, shows a before/after product review, explains why the drift matters, and emits machine-readable repair patches an agent can apply before a human reviews the PR.

Morph also ships a **design intelligence transform**: point it at any fast agent-generated website (a GitHub repo or a local folder) and it re-renders the site with a frontier-grade design system — curated profiles modeled on the visual grammar of companies like Linear, Stripe, Notion, and Apple — while keeping the original content.

This repo ships the local CLI, an interactive Morph Studio app, JSON receipts, stored runs, a product API, an auth/billing-ready app shell, CI coverage, a clean smoke fixture, and a separate seeded demo fixture for repeatable review walkthroughs.

## Why this exists

Coding agents can make UI that works but does not belong in the product. Morph improves the review journey for a real daily workflow: a developer receiving AI-generated frontend and needing to decide whether it is safe, polished, accessible, and consistent enough to merge. Morph gives those teams a consistency layer:

1. Read product tokens and component grammar.
2. Scan generated frontend files.
3. Classify drift across visual, component, interaction, and responsive surfaces.
4. Emit JSON findings with exact replacement patches.
5. Apply repairs and re-run until the UI passes.

## Quickstart

```bash
cd /Users/arnavsrivastava/Documents/morph
npm test
npm run verify
npm run verify:demo -- --json --no-fail --output demo/reports/seeded-drift.json
npm run repair -- --json
npm run loop -- --apply --store
npm run demo
npm run serve
```

`npm run verify` is the product smoke gate and should pass. `npm run verify:demo` points at the intentionally drifted Acme fixture; use `--no-fail` when you want a receipt without a failing process exit.

After `npm run serve`, open `http://127.0.0.1:4177`:

- `/` is the public product landing page (hero, live CLI demo, pricing, docs).
- `/studio` is the interactive Morph Studio review dashboard. The `Launch Studio` button on the landing page routes there.
- `/login` is the auth entry point: SSO buttons when OAuth is configured, a polished dev-mode state when it is not.

For the repeatable sample review flow, use `DEMO.md`.

## Commands

```bash
morph init
morph verify --config morph.config.json --json --store
morph verify --config morph.demo.config.json --no-fail
morph repair --config morph.config.json --apply --json
morph loop --config morph.config.json --apply --store
morph transform --repo owner/repo --output ./morph-output
morph transform --input ./my-ugly-site --profile aurora-dark
morph demo
morph serve --config morph.config.json --host 127.0.0.1 --port 4177
```

- `init` creates `morph.config.json`, `.morph/runs`, and `.env.example`.
- `verify` scans frontend source and emits JSON plus a human report.
- `repair` generates deterministic replacements and can apply them.
- `loop` runs verify, repair, verify again, then returns a final CI gate.
- `transform` clones (or reads) an arbitrary site, scores it against the design-quality heuristics, selects the best-matching design profile, and re-renders the whole site — polished HTML plus a generated `morph-theme.css` design system.
- `demo` copies the seeded fixture, repairs the copy, and writes review receipts.
- `serve` starts the Morph web app: the landing page at `/`, Morph Studio at `/studio`, and the API backed by `.morph/runs`. Studio full reviews run on `.studio-run/project` so the seeded fixture stays reusable.

## Design intelligence database

`src/design-db/` is the engine behind the transform:

- **Profiles** (`profiles.js`): complete design systems — color palette, font pairing, type scale, spacing rhythm, radii, shadows, gradients, and hero textures — distilled from the visual grammar of frontier product companies (Linear/Vercel-class dark developer sites, Stripe-class fintech, Notion-warm consumer, Apple-minimal monochrome, and more).
- **Heuristics** (`heuristics.js`): 25 rules that fingerprint quickly-generated UI — missing viewport meta, default typography, raw saturated colors, no hover/focus states, no responsive rules, `<center>`-era markup — and produce a 0–100 UI quality score.
- **Patterns** (`patterns.js`): the component library (glass nav, gradient hero, feature card grid, split sections, quote band, CTA band, footer) that re-renders extracted content into a finished page with reveal-on-scroll motion, `focus-visible` states, and `prefers-reduced-motion` support.

The Studio GitHub flow uses the same engine end to end: connect a repo, and Morph clones it, scores the incoming UI, transforms it, and serves the result at `/transformed/index.html` with a before/after receipt.

## Sample Review Flow

The product smoke fixture is `fixtures/acme-saas-clean`; it should pass the default gate. The seeded review fixture is `fixtures/acme-saas`, a tiny SaaS billing screen with a real design-token file and agent-generated drift in `src/routes/settings/billing.tsx`.

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
- `demo/terminal-transcript.txt` captures the review transcript.

The source fixture remains seeded so the sample review can be replayed.

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

## Product Positioning

Morph is not a generic dashboard and not a screenshot upload tool. It is an interactive review journey plus a machine-readable verification loop for coding agents:

```text
Cursor changes frontend -> Morph Studio review -> JSON findings + patches -> Morph repair -> verify again -> safe to merge
```

Release and repository hygiene notes live in `docs/github-prep.md`.

## Existing tools checked

Chromatic, Loki, BackstopJS, stylelint, ESLint, and token linters cover pieces of this space. Morph's wedge is the agent-native loop: product grammar extraction, drift classification, and patch output designed for Cursor/Codex-style repair cycles.
