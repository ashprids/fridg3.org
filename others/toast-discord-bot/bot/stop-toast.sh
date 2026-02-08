#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/toast-bot.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found. Is the bot running?"
  exit 0
fi

PID="$(cat "$PID_FILE")"

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Sent stop signal to Toast bot (PID $PID)."
else
  echo "Process not running, cleaning up PID file."
fi

rm -f "$PID_FILE"