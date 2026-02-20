# Security

This repository is **public**. Do not commit secrets or sensitive configuration.

## Never commit

- **`.env`** — local and server environment (DB URLs, ports, feature flags).
- **`.env.production`** — production env copied to server by deploy script; keep only on your machine or CI secrets.
- **`.env.*`** — any variant (e.g. `.env.local`) except `.env.example`.
- **Passwords, API keys, tokens, SSH private keys** — in any file.
- **Real connection strings** — e.g. `postgresql://user:password@host:port/db` must not appear in tracked files.
- **Real server IPs or hostnames** — use placeholders in docs (e.g. `your-server.example.com`).

## Before every push

1. **Check staged files:**  
   `git status` and `git diff --cached` — ensure no `.env`, `.env.production`, or files containing passwords/keys are staged.

2. **Confirm .env is ignored:**  
   `git check-ignore .env` should output a `.gitignore` rule.

3. **Use `.env.example` as the only env template in repo** — it contains placeholders only (USER, PASSWORD, HOST, etc.).

## Safe defaults

- **`.gitignore`** — ignores `.env`, `.env.*`, and keeps `!.env.example`.
- **`.dockerignore`** — excludes `.env` and `.env.*` so they are not copied into the Docker build context.
- **Deploy:** `scripts/external-deploy.sh` copies your local `.env.production` to the server via SCP; that file must not be in the repo.

## If you accidentally committed a secret

1. Remove the secret from the file and commit the fix.
2. Rotate the secret (new DB password, new key, etc.) — the old one is already exposed in history.
3. Consider using `git filter-branch` or BFG Repo-Cleaner to remove the secret from history (advanced; rewrite history).
