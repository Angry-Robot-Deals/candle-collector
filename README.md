# Fetches crypto exchanges candles (K-lines) and saves it to a Postgres database

## Supported exchanges

* Binance
* Bybit
* Gateio
* HTX
* Kucoin
* Mexc
* Okx
* Poloniex

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

## Stop the app

```bash
docker compose -p cc -f docker-compose.yml down
```
