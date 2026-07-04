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
- Interactive solution: Morph Studio combines before/after UI, issue timeline, voice narration, JSON receipts, and a repair loop.

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

   Expected signal: `FAIL (71/100)` with 8 findings across color, spacing, radius, components, focus, responsiveness, elevation, and type.

3. Show the repair loop:

   ```bash
   npm run demo
   ```

   Expected output:

   ```text
   Before: fail (71/100), 8 issue(s)
   Repair: 8 replacement(s) across 1 file(s)
   After: pass (100/100), 0 issue(s)
   ```

4. Show Morph Studio:

   ```bash
   npm run serve
   ```

   Open `http://127.0.0.1:4177`, click `Narrate review`, then `Run full review`.

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

Use the web control plane in this order:

1. `Narrate review`
2. `Inspect agent UI`
3. `Generate fix plan`
4. `Run full review`
5. Click a stored run and show the JSON payload

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
