#!/usr/bin/env bash
# Prints the MCP server's usage summary from the live database: the queries in
# scripts/mcp-stats.sql, run on the host over scripts/pfg-ssh.sh.
#
#   bash scripts/mcp-stats.sh [days]      (make mcp-stats days=30)
#
# The database credentials stay on the host: the remote shell reads them from
# the release's .env and hands the password to the client through MYSQL_PWD,
# never on a command line.

set -euo pipefail

days="${1:-7}"
if ! [[ "$days" =~ ^[1-9][0-9]{0,3}$ ]]; then
  echo "mcp-stats: days must be a whole number from 1 to 9999, got '$days'" >&2
  exit 2
fi

here="$(cd "$(dirname "$0")" && pwd)"

{
  printf 'SET @days = %d;\n' "$days"
  cat "$here/mcp-stats.sql"
} | bash "$here/pfg-ssh.sh" 'set -a && . /var/www/pfg-current/.env && set +a && MYSQL_PWD="$DB_PASS" mysql --default-character-set=utf8mb4 -t -h"$DB_HOST" -u"$DB_USER" "$DB_NAME"'
