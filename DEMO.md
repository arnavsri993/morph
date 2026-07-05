# morph Sample Review Runbook

morph's sample review story is simple:

```text
A developer gets a Cursor-generated billing screen that works but drifts from the product.
morph Studio turns that stressful code-review moment into an interactive before/after review:
it catches drift, narrates the critique, emits deterministic patches, applies the repair,
and proves the branch is safe to review.
```

## Agent Review Fit

- Problem: developers increasingly review AI-generated frontend that compiles but is inconsistent, inaccessible, or off-brand.
- User journey: inspect the agent output, understand the product-design issues, apply the fix, and see a passing merge gate.
- Interactive solution: morph Studio combines before/after UI, issue timeline, JSON receipts, and a repair loop that runs on an isolated review copy so the sample can be repeated safely.

## One-Minute Walkthrough

1. Open with the broken contract:

   ```text
   Cursor can ship UI in seconds, but developers still have to review whether it belongs in the product.
   morph Studio is an interactive review flow for agent-written frontend.
   ```

2. Show the seeded fail:

   ```bash
   npm run verify:demo -- --no-fail
   ```

   Expected signal: `FAIL (68/100)` with 9 findings across color, spacing, radius, components, focus, accessibility, responsiveness, elevation, and type.

3. Show the repair loop:

   ```bash
   npm run demo
   ```

   Expected output:

   ```text
   Before: fail (68/100), 9 issue(s)
   Repair: 9 replacement(s) across 1 file(s)
   After: pass (100/100), 0 issue(s)
   ```

4. Show morph Studio:

   ```bash
   npm run serve
   ```

   Open `http://127.0.0.1:4177`. Click `Launch Studio` in the header to enter the dashboard at `/studio`, connect a GitHub repo or enter a preview URL, then click `Run full review`. The full review repairs `.studio-run/project`, not the seeded fixture.

5. Show the machine-readable receipt:

   ```bash
   open demo/reports/demo-repair.json
   ```

6. Close with:

   ```text
   Most agent tools generate more code. morph improves the human review journey
   by making generated frontend understandable, repairable, and safe to merge.
   ```

## Site Transform Demo

The headline sample: take a website an agent made fast, plug it into morph through GitHub, and get back a site that looks like a frontier company built it.

1. Ask Codex/Cursor to "make a landing page fast" and push it to a GitHub repo. (A bundled stand-in lives at `fixtures/codex-landing` — pure `<center>` tags, inline styles, default fonts.)
2. Start morph and open Studio:

   ```bash
   npm run serve
   ```

3. In Studio, keep the `Connect GitHub` tab, enter `owner/repo`, and click `Run full review`.
4. morph clones the repo, scores the UI against its design-quality heuristics (the bundled fixture scores **0/100** with 19 findings), extracts the content, searches a **150+ site reference corpus** (Linear, Stripe, Notion, Apple, etc.) to pick the best-matching design profile, and re-renders the site.
5. Click `Open transformed site ↗` in the receipt — the result is served at `/transformed/index.html`: gradient hero, glass nav, feature cards, quote band, CTA, fully responsive, **100/100**.

CLI fallback if the network is down:

```bash
node bin/morph.js transform --input fixtures/codex-landing --output .demo-run/stunning
open .demo-run/stunning/index.html
```

## Live Sample

```bash
npm test
npm run verify:demo -- --json --no-fail --output demo/reports/seeded-drift.json
npm run demo
npm run serve
```

Then open `http://127.0.0.1:4177`.

Use the web app in this order:

1. Land on `/` — the product story reads in under 3 seconds, with the animated CLI review in the hero
2. Click `Launch Studio` (header CTA) to enter `/studio`
3. Connect a GitHub repo or enter a preview URL
4. Add the agent instructions
5. `Run full review`
6. Click a stored run and show the JSON payload

## What To Point At

- `fixtures/acme-saas/src/routes/settings/billing.tsx`: the intentionally drifted agent output.
- `fixtures/acme-saas/design-system/tokens.css`: the product grammar morph enforces.
- `demo/reports/demo-before.json`: failure receipt.
- `demo/reports/demo-repair.json`: deterministic patch plan.
- `demo/reports/demo-after.json`: passing gate after repair.
- `.github/workflows/morph-ci.yml`: CI proof that this is merge infrastructure, not a dashboard toy.

## Fallback

If the browser or server is acting up, the CLI demo is enough:

```bash
npm test && npm run demo
```

The core loop is dependency-free and does not require network, API keys, OAuth, screenshots, or LLM calls.
