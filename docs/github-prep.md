# Release Checklist

Use this before publishing or handing morph to another team.

## Repository

- Name: `morph`
- Visibility: choose public for open-source distribution, private for customer/internal pilots
- Description: `CI and Studio review for agent-written frontend.`
- Default branch: `main`

## Local Gates

```bash
cd /Users/arnavsrivastava/Documents/morph
npm test
npm run verify
npm run verify:demo -- --no-fail
npm run demo
```

`npm run verify` proves the clean product smoke fixture passes. `npm run verify:demo -- --no-fail` proves the intentionally drifted fixture still produces the expected failure receipt.

## GitHub Setup

```bash
git add .
git commit -m "Productize morph review workflow"
gh repo create morph --source=. --remote=origin --push
gh repo edit --description "CI and Studio review for agent-written frontend."
```

Invite collaborators by GitHub username when possible. If only email addresses are available, use the GitHub web UI so GitHub can resolve invitations without exposing addresses in repo documentation.

## Release Notes

- Mention that the default config is now a passing smoke fixture.
- Mention that `morph.demo.config.json` owns the seeded drift sample.
- Link to `DEMO.md` for the repeatable sample review flow.
- Link to `docs/product-architecture.md` for runtime and API details.
