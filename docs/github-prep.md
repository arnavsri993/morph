# GitHub Prep

Use this when the local demo is ready to publish. The 2026-07-04 hackathon start task explicitly approved repo creation, push, and collaborator invites.

## Suggested repo

- Name: `morph`
- Visibility: public, required by the RAISE Summit Hackathon rules
- Description: `CI for agent-written frontend: detect design-system drift and emit repair patches.`

## Collaborators to invite

- Arefazizi574@gmail.com
- Sowmyan.ssk@gmail.com
- Akshaj.kommepalli@gmail.com
- Harshankrishna30@gmail.com
- Arnavsri993@gmail.com

## Commands

```bash
cd /Users/arnavsrivastava/.openclaw/workspace/morph
git init
git add .
git commit -m "Build Morph hackathon demo"
gh repo create morph --public --source=. --remote=origin --push
gh repo edit --description "CI for agent-written frontend: detect design-system drift and emit repair patches."
```

GitHub's collaborator API accepts usernames, not arbitrary email addresses. If only email addresses are known, try the invite and record the exact failure, then ask the repo owner to invite from GitHub's web UI if GitHub cannot resolve them.

```bash
gh api -X PUT repos/:owner/morph/collaborators/Arefazizi574@gmail.com -f permission=push
gh api -X PUT repos/:owner/morph/collaborators/Sowmyan.ssk@gmail.com -f permission=push
gh api -X PUT repos/:owner/morph/collaborators/Akshaj.kommepalli@gmail.com -f permission=push
gh api -X PUT repos/:owner/morph/collaborators/Harshankrishna30@gmail.com -f permission=push
gh api -X PUT repos/:owner/morph/collaborators/Arnavsri993@gmail.com -f permission=push
```

## 2026-07-04 invite attempt

Repo created and pushed:

- `https://github.com/arnavsri993/morph`

GitHub user search for the provided emails returned no resolvable usernames. Direct collaborator API calls using the email strings failed for every requested email with:

```json
{
  "message": "Not Found",
  "documentation_url": "https://docs.github.com/rest/collaborators/collaborators#add-a-repository-collaborator",
  "status": "404"
}
```

`Arnavsri993` resolves to the owner account `arnavsri993`, which already owns the repo. Required action: invite the remaining collaborators through GitHub's web UI by email, or provide their GitHub usernames for API invites.
