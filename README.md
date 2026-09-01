# goobie
---
goodreads rss feed scraper discord bot
(inspired by [moobie](https://github.com/Awhalen1999/moobie))


## Running on a server

The poll runs **inside the bot process** on a `setInterval`, not as a separate
cron job or a second container — `notify()` needs the logged-in Discord client,
so a cron invocation would have to open a fresh gateway connection every 15
minutes just to send one message. So there is one long-running container, and
Docker's restart policy keeps it alive.

Polling starts on `ClientReady` and runs immediately, then every
`POLL_INTERVAL_MINUTES` (default 15). Ticks are serialised — if a cycle runs
long, the next one is skipped rather than stacking.

### Setup

```sh
git clone https://github.com/amye-rose/goobie && cd goobie

cp .env.example .env
$EDITOR .env            # fill in DISCORD_TOKEN and CHANNEL_ID
chmod 600 .env          # it holds the bot token

# the container runs as uid 1000; make sure it can write the database
mkdir -p db && sudo chown 1000:1000 db

docker compose up -d --build
```

### Operating it

```sh
docker compose logs -f
docker compose ps
docker compose restart
docker compose down

docker compose up -d --build    # after pulling changes
```

### Notes

- **Only `db/` is a volume.** It mounts to `/data`, and `DB_PATH` points the bot
  at `/data/goobie.db`. `schema.sql` is baked into the image at `/app/db/`, so
  the data mount can't shadow it.
- **`node --env-file`, not compose's `env_file:`.** Node strips trailing
  `# comments` from values; Compose's handling of them has varied across
  versions, and `.env.example` puts one on `CHANNEL_ID`. `.env` is bind-mounted
  read-only and parsed by node instead.
- **`init: true`** gives the container a real PID 1, so `docker compose stop`
  delivers SIGTERM to node and the shutdown handler closes the database instead
  of being killed after the grace period.
- **Native module.** `better-sqlite3` is compiled in a separate build stage.
  Prebuilds cover linux/amd64; on arm64 it compiles from source, which is why
  the build stage installs `python3`/`make`/`g++`. Neither reaches the runtime
  image.
- **Back up `db/goobie.db`.** It holds which updates have already been
  announced; losing it means the next poll re-announces everything in the feeds.
