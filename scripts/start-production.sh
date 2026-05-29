#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-1988}"

if [[ -z "${DATABASE_URL:-}" ]] && command -v docker >/dev/null 2>&1 && docker inspect supabase-db >/dev/null 2>&1; then
  DB_IP="$(docker inspect supabase-db --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
  DB_PASSWORD="$(docker inspect supabase-db --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '/^PGPASSWORD=/{print $2; exit}')"
  DB_PASSWORD_ENCODED="$(PW="$DB_PASSWORD" node -e 'console.log(encodeURIComponent(process.env.PW))')"
  export DATABASE_URL="postgresql://supabase_admin:${DB_PASSWORD_ENCODED}@${DB_IP}:5432/postgres"
fi

exec /usr/bin/node src/server.js
