# Morph Demo Runbook

Morph's judge story is simple:

```text
A developer gets a Cursor-generated billing screen that works but drifts from the product.
Morph Studio turns that stressful code-review moment into an interactive before/after review:
it catches drift, narrates the critique, emits deterministic patches, applies the repair,
and proves the branch is safe to review.
```

## Cursor Prompt Fit

- Problem: developers increasingly review AI-generated frontend that compiles but is inconsistent, inaccessible, or off-brand.
- User journey: inspect the agent output, understand the product-design issues, apply the fix, and see a passing merge gate.
- Interactive solution: Morph Studio combines before/after UI, issue timeline, voice narration, JSON receipts, and a repair loop that runs on an isolated review copy so the demo can be repeated safely.

## One-Minute Video

1. Open with the broken contract:

   ```text
   Cursor can ship UI in seconds, but developers still have to review whether it belongs in the product.
   Morph Studio is an interactive review flow for agent-written frontend.
   ```

2. Show the seeded fail:

   ```bash
   npm run verify -- --no-fail
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

4. Show Morph Studio:

   ```bash
   npm run serve
   ```

   Open `http://127.0.0.1:4177` — the cinematic landing page makes the pitch in one screen. Click `Launch Studio` in the header to enter the dashboard at `/studio`, then click `Narrate review` and `Run full review`. The full review repairs `.studio-run/project`, not the seeded fixture.

5. Show the machine-readable receipt:

   ```bash
   open demo/reports/demo-repair.json
   ```

6. Close with:

   ```text
   Most hackathon projects generate more code. Morph improves the human review journey
   by making generated frontend understandable, repairable, and safe to merge.
   ```

## Live Demo

```bash
npm test
npm run verify -- --json --no-fail --output demo/reports/seeded-drift.json
npm run demo
npm run serve
```

Then open `http://127.0.0.1:4177`.

Use the web app in this order:

1. Land on `/` — the product story reads in under 3 seconds, with the animated CLI review in the hero
2. Click `Launch Studio` (header CTA) to enter `/studio`
3. `Narrate review`
4. `Inspect agent UI`
5. `Generate fix plan`
6. `Run full review`
7. Click a stored run and show the JSON payload

## What To Point At

- `fixtures/acme-saas/src/routes/settings/billing.tsx`: the intentionally drifted agent output.
- `fixtures/acme-saas/design-system/tokens.css`: the product grammar Morph enforces.
- `demo/reports/demo-before.json`: failure receipt.
- `demo/reports/demo-repair.json`: deterministic patch plan.
- `demo/reports/demo-after.json`: passing gate after repair.
- `.github/workflows/morph-ci.yml`: CI proof that this is merge infrastructure, not a dashboard toy.

## Fallback

If the browser or server is acting up, the CLI demo is enough:

```bash
npm test && npm run demo
```

The core loop is dependency-free and does not require network, API keys, Stripe, OAuth, screenshots, or LLM calls.
