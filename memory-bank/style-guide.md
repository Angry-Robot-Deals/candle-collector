# Style Guide: Candles

## Code

- **TypeScript:** strict; project uses NestJS and Prisma conventions.
- **Formatting:** Prettier (`pnpm run format` for src/test).
- **Linting:** ESLint (`pnpm run lint`).
- **Naming:** camelCase for variables/methods; PascalCase for classes; UPPER for env and constants where applicable.

## Documentation and AI Rules

- **Language:** Comments and docs in English; user-facing responses may be in Russian per project rules.
- **Memory Bank:** All operational task docs and reports in `memory-bank/` per memory-bank-paths; task IDs in report filenames (e.g. DEV-0001, QA-0008).

## Repo

- **Branch:** main.
- **Secrets (repo is public):** Never commit `.env`, `.env.production`, or any `.env.*` except the template `.env.example`. No passwords, API keys, or real connection strings in any tracked file. Before push: run `git status` and `git diff --cached`; see root [SECURITY.md](../SECURITY.md).
