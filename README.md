## Prepare for launch

```bash
cp .env.example .env
```
Change the values in the .env file to your own

## Running the app

```bash
docker compose -p cc -f docker-compose.yml build
docker compose --env-file .env -p cc -f docker-compose.yml up -d --remove-orphans
```
