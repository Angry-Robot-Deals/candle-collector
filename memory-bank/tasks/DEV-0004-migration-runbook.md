# DEV-0004 Migration Runbook: Feeder and API to DB Server

Step-by-step runbook for migrating candle-collector from **37.27.107.227** to **23.88.34.218** (DB server). Execute in order.

---

## Step 0: Update DB server and reboot (do this first)

On the **new** server (23.88.34.218) dependencies may be outdated. Update all packages and reboot before continuing.

**From your local machine** (run this once; SSH will disconnect when server reboots):

```bash
ssh root@23.88.34.218 'bash -s' < scripts/update-db-server-and-reboot.sh
```

Or **on the server** after SSH:

```bash
ssh root@23.88.34.218
# then paste or run:
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
# optional: upgrade Docker if already installed
reboot
```

Wait 1–2 minutes for the server to come back, then continue with Step 1 (pre-migration on old server) and Step 2 (prepare new server).

---

## Prerequisites

- SSH access to both servers.
- Local repo with `.env` and `.env.production` (not committed).
- For pre-migration script: set `OLD_APP_SERVER_USER` and `OLD_APP_SERVER_SSH_KEY` in `.env` to the **old** server (see Step 1).

---

## Step 1: Pre-migration — stop app and remove Docker (current server 37.27.107.227)

### Option A: Using the pre-migration script

1. In `.env` set (temporarily or use dedicated vars):
   - `OLD_APP_SERVER_USER=root@37.27.107.227`
   - `OLD_APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`
2. Run:
   ```bash
   pnpm run pre-migration-stop
   # or: bash scripts/pre-migration-stop-old-server.sh
   ```
3. Optionally SSH to the old server and uninstall Docker (see Option B, uninstall section).

### Option B: Manual

1. From local machine (with `.env` still pointing to **old** server):
   ```bash
   APP_SERVER_USER=root@37.27.107.227 APP_SERVER_SSH_KEY=~/.ssh/id_ed25519 pnpm run down
   ```
2. SSH to the old server:
   ```bash
   ssh -i ~/.ssh/id_ed25519 root@37.27.107.227
   ```
3. On the server:
   ```bash
   cd /repos/candle-collector
   docker compose -p cc -f docker-compose.yml down --remove-orphans
   docker image rm cc-candles 2>/dev/null || true
   docker image prune -f -a
   docker volume prune -f
   ```
4. Optional — uninstall Docker (Debian/Ubuntu):
   ```bash
   apt-get remove -y docker-ce docker-ce-cli containerd.io
   apt-get purge -y docker-ce docker-ce-cli containerd.io
   ```

**Verify:** `docker ps -a` shows no `cc` containers (or no containers at all).

---

## Step 2: Prepare new server (23.88.34.218)

1. SSH to new server:
   ```bash
   ssh root@23.88.34.218
   # or: ssh -i ~/.ssh/id_ed25519 root@23.88.34.218
   ```

2. Install Docker and Docker Compose (if not present). Example (Debian/Ubuntu):
   ```bash
   apt-get update && apt-get install -y ca-certificates curl
   install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   chmod a+r /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
   apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

3. Install and configure PostgreSQL locally. Create database and user; note the connection string for `DATABASE_URL` (e.g. `postgresql://user:pass@localhost:5432/candles?schema=public`). If the app runs in Docker and DB is on host, use `host.docker.internal` or the host IP in `DATABASE_URL` if required by your OS.

4. Clone repo (or create directory for first deploy):
   ```bash
   mkdir -p /repos
   git clone <your-repo-url> /repos/candle-collector
   ```
   If the repo is **private**: add an SSH deploy key to GitHub and use the SSH clone URL, or use HTTPS with a token. Ensure the server can run `git pull` for future deploys.

5. Create logs directory:
   ```bash
   mkdir -p /repos/candle-collector/logs
   ```

---

## Step 3: Update local .env and .env.production

On your **local** machine:

1. **`.env`** — set deploy target to the **new** server:
   ```bash
   APP_SERVER_USER=root@23.88.34.218
   APP_SERVER_SSH_KEY=~/.ssh/id_ed25519
   ```
   (Use the key that can SSH to 23.88.34.218.)

2. **`.env.production`** — set DB to the **new** server’s local PostgreSQL:
   ```bash
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public
   SHADOW_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_shadow?schema=public
   ```
   If the app runs inside Docker and PostgreSQL is on the host, use `host.docker.internal` (or host IP) instead of `localhost` if your setup requires it.

---

## Step 4: First deploy to new server

1. From repo root (with updated `.env` and `.env.production`):
   ```bash
   pnpm run deploy
   # or: bash scripts/external-deploy.sh
   ```

2. Open port **14444** on the new server (firewall / security group):
   ```bash
   # On server (example with ufw):
   ufw allow 14444/tcp
   ufw reload
   ```
   Or add an inbound rule in your cloud provider’s security group for TCP 14444.

3. Verify from your local machine:
   ```bash
   curl http://23.88.34.218:14444/
   ```
   Optional: call an API endpoint (e.g. `GET /exchange` or `GET /getTopCoins`). On the server, check logs: `docker compose -p cc -f docker-compose.yml logs -f` and `logs/app.log`.

---

## Step 5: Documentation (done in repo)

- README and techContext state that the production deploy target is **23.88.34.218**.
- New-server checklist (Docker, PostgreSQL, clone, GitHub access, port 14444) is in README.

No manual step required if the repo was updated as part of DEV-0004.

---

## Validation checklist

- [ ] Old server (37.27.107.227): app stopped, Docker removed (and optionally uninstalled).
- [ ] New server (23.88.34.218): Docker and PostgreSQL installed; repo at `/repos/candle-collector`; GitHub access configured if private.
- [ ] Local `.env`: `APP_SERVER_USER=root@23.88.34.218`, correct `APP_SERVER_SSH_KEY`.
- [ ] Local `.env.production`: `DATABASE_URL` points to DB on new server (localhost or host.docker.internal).
- [ ] Deploy script ran successfully; port 14444 open; `curl http://23.88.34.218:14444/` returns healthy response.
- [ ] App logs show successful DB connection; no connection errors.

---

## Reducing CPU load

If the app uses too much CPU on 23.88.34.218:

1. **Limit concurrent exchanges**  
   In `.env` on the server (or in `.env.production` before deploy) set:
   ```bash
   FETCH_CONCURRENT_EXCHANGES=2
   ```
   Default is 2: at most two exchanges fetch D1/H1/M15 in parallel. Use `1` for minimum CPU, or `4`–`6` if the server has spare capacity.

2. **Docker CPU limit**  
   In `docker-compose.yml`, `deploy.resources.limits.cpus` is set to `"2"`. This applies when using Docker Stack; with `docker compose up` you may need to rely on `FETCH_CONCURRENT_EXCHANGES` or adjust the limit in the compose file for your runtime.

3. **Disable optional jobs**  
   Turn off unneeded fetchers to reduce work:
   - `ENABLE_CANDLE_H1_FETCH=false` — no H1 candles
   - `ENABLE_CANDLE_M15_FETCH=false` — no M15 candles
   - `ENABLE_TOP_COIN_FETCH=false` — no M1 top-coin fetch
   - `ENABLE_ATHL_CALCULATION=false` — no ATHL calculation

4. **Fewer exchanges**  
   Restrict which exchanges are used (e.g. only Binance and OKX):
   ```bash
   DAY_CANDLE_FETCH_EXCHANGES=binance,okx
   HOUR_CANDLE_FETCH_EXCHANGES=binance,okx
   M15_CANDLE_FETCH_EXCHANGES=binance,okx
   FETCH_EXCHANGES=binance,okx
   ```

After changing env, recreate the container: `docker compose -p cc up -d --force-recreate`.

---

## GitHub key on new server

If the deploy script runs `git pull` on the server and the repo is **private**, the server needs access:

- **Option 1:** Add an SSH **deploy key** (read-only) to the repo and use the SSH clone URL on the server.
- **Option 2:** Use HTTPS clone with a personal access token (store in git credential helper or env, never commit).

If keys are not set up yet, configure them on 23.88.34.218 before the first deploy (or before the first `git pull` during deploy).
