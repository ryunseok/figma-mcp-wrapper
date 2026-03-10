#!/bin/bash
# Figma MCP Wrapper — HTTP 데몬 시작 스크립트
# Usage: ./scripts/start-server.sh [start|stop|restart|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.server.pid"
LOG_FILE="$PROJECT_DIR/.server.log"
SERVER_JS="$PROJECT_DIR/dist/server.js"

# Load environment
if [ -f "$HOME/.envs/claude-tools.env" ]; then
  source "$HOME/.envs/claude-tools.env"
fi

export FIGMA_ACCESS_TOKEN="${FIGMA_TOKEN:-$FIGMA_ACCESS_TOKEN}"
export MCP_MODE="http"
export DEBUG="${DEBUG:-1}"

start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server already running (PID: $(cat "$PID_FILE"))"
    status
    return 0
  fi

  echo "Starting figma-mcp-wrapper (HTTP mode)..."
  nohup node "$SERVER_JS" --mode=http > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1

  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server started (PID: $(cat "$PID_FILE"))"
    status
  else
    echo "Failed to start server. Check log: $LOG_FILE"
    cat "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
}

stop() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "Stopping server (PID: $PID)..."
      kill "$PID"
      rm -f "$PID_FILE"
      echo "Server stopped."
    else
      echo "Server not running (stale PID file). Cleaning up."
      rm -f "$PID_FILE"
    fi
  else
    echo "Server not running."
  fi
}

status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server running (PID: $(cat "$PID_FILE"))"
    curl -s http://localhost:3056/health 2>/dev/null || echo "Health check failed"
  else
    echo "Server not running."
  fi
}

case "${1:-start}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  *)       echo "Usage: $0 {start|stop|restart|status}" ;;
esac
