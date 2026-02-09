#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/toast-bot.log"
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
SCREEN_SESSION="toast"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python venv not found at $PYTHON_BIN"
  exit 1
fi

if screen -list | grep -q "\.${SCREEN_SESSION}\s"; then
  echo "Toast bot already running in screen session '$SCREEN_SESSION'."
  exit 0
fi

screen -dmS "$SCREEN_SESSION" bash -c "cd '$SCRIPT_DIR' && exec '$PYTHON_BIN' '$SCRIPT_DIR/main.py' >> '$LOG_FILE' 2>&1"

if screen -list | grep -q "\.${SCREEN_SESSION}\s"; then
  echo "Toast bot started in screen session '$SCREEN_SESSION'. Attach with: screen -r $SCREEN_SESSION"
else
  echo "Failed to start toast bot in screen session '$SCREEN_SESSION'."
  exit 1
fi