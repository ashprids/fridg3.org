#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/toast-bot.pid"
LOG_FILE="$SCRIPT_DIR/toast-bot.log"
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python venv not found at $PYTHON_BIN"
  exit 1
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Toast bot already running (PID $(cat "$PID_FILE"))."
  exit 0
fi

nohup "$PYTHON_BIN" "$SCRIPT_DIR/main.py" > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"

echo "Toast bot started (PID $(cat "$PID_FILE"))"