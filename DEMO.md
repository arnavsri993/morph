# Morph Demo Runbook

Morph's judge story is simple:

```text
An AI coding agent writes a billing screen that works but drifts from the product.
Morph catches the drift, explains it with file-level receipts, emits deterministic patches,
applies the repair, and proves the branch is safe to review.
```

## One-Minute Video

1. Open with the broken contract:

   ```text
   Coding agents can ship UI that compiles, but quietly breaks product taste.
   Morph is CI for agent-written frontend.
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

4. Show the machine-readable receipt:

   ```bash
   open demo/reports/demo-repair.json
   ```

5. Close with:

   ```text
   Most hackathon projects generate more code. Morph is the verification layer
   that keeps generated frontend safe to merge.
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

1. `Run verify`
2. `Plan repair`
3. `Run loop`
4. Click a stored run and show the JSON payload

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
