#!/bin/bash
# READ_ONLY 모드 검증 (LRD-4670) — 도구 표면 5종 + REST 읽기 + 기존 모드 회귀
# 사용법: FIGMA_RO_TOKEN=<read-only PAT> bash scripts/verify_readonly.sh [fileKey]
#        fileKey는 인자 또는 FIGMA_FILE_KEY 환경변수로 전달 (레포에 하드코딩 금지 — public repo)
set -euo pipefail
K="${1:-${FIGMA_FILE_KEY:?fileKey 필요 — 인자 또는 FIGMA_FILE_KEY env}}"
PORT="${PORT:-3066}"
BASE="http://localhost:$PORT/mcp"

docker build -q -t figma-mcp-ro:verify . > /dev/null
docker rm -f figma-mcp-ro-verify 2>/dev/null || true
docker run -d --name figma-mcp-ro-verify -p "127.0.0.1:$PORT:3056" \
  -e MCP_MODE=http -e READ_ONLY=1 -e FIGMA_ACCESS_TOKEN="$FIGMA_RO_TOKEN" \
  figma-mcp-ro:verify > /dev/null
trap 'docker rm -f figma-mcp-ro-verify > /dev/null' EXIT
sleep 2

H=$(mktemp)
curl -s -D "$H" -o /dev/null -X POST "$BASE" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"verify","version":"0"}}}'
SID=$(grep -i '^mcp-session-id:' "$H" | tr -d '\r' | awk '{print $2}'); rm -f "$H"
curl -s -o /dev/null -X POST "$BASE" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
rpc() { curl -s -X POST "$BASE" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" -H "mcp-session-id: $SID" -d "$1" \
  | grep '^data: ' | sed 's/^data: //' | head -1; }

echo "== 1. 도구 표면 =="
NAMES=$(rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | python3 -c "import sys,json; print('\n'.join(t['name'] for t in json.load(sys.stdin)['result']['tools']))")
[ "$(echo "$NAMES" | grep -c .)" = 5 ] || { echo "❌ 도구 수 != 5: $NAMES"; exit 1; }
echo "$NAMES" | grep -qE 'create|set_|delete|move|resize|clone|batch|join_channel|bind' \
  && { echo "❌ 쓰기/플러그인 도구 노출"; exit 1; }
echo "✅ 도구 5종: $(echo $NAMES | tr '\n' ' ')"

echo "== 2. REST 읽기 =="
rpc "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"get_file\",\"arguments\":{\"fileKey\":\"$K\",\"depth\":1}}}" \
  | python3 -c "
import sys,json
d=json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
assert d.get('name'), d
print('✅ get_file:', d['name'])"
rpc "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"get_images\",\"arguments\":{\"fileKey\":\"$K\",\"nodeIds\":[\"0:1\"],\"scale\":0.1}}}" \
  | python3 -c "
import sys,json
d=json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
assert d.get('images'), d
print('✅ get_images:', len(d['images']), '건')"

echo "== 3. health =="
curl -s "http://localhost:$PORT/health" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['tools']==5, d
print('✅ health tools=5')"

echo ""
echo "전 항목 통과 — READ_ONLY 모드 정상"
