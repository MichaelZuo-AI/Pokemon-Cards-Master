#!/usr/bin/env bash
# ============================================================================
# E2E Smoke Tests — Pokemon Cards Master
#
# Automated curl-based checks for the production user flow.
# Covers auth gate, login, OAuth, manifest, SW, and API protection.
#
# Usage:
#   ./scripts/e2e-smoke.sh                          # default: michaelzuo.vip
#   ./scripts/e2e-smoke.sh https://custom-domain.com
# ============================================================================

set -euo pipefail

BASE_URL="${1:-https://michaelzuo.vip}"
APP_PATH="/Pokemon/cardsmaster"
APP_URL="${BASE_URL}${APP_PATH}"
COOKIE_JAR=$(mktemp)
PASSED=0
FAILED=0

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

# --- helpers ----------------------------------------------------------------

pass() { PASSED=$((PASSED + 1)); printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { FAILED=$((FAILED + 1)); printf "  \033[31m✗\033[0m %s — got: %s\n" "$1" "$2"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then pass "$label"; else fail "$label" "$actual"; fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then pass "$label"; else fail "$label" "missing '$needle'"; fi
}

# --- 1. Auth Gate (Unauthenticated) -----------------------------------------

echo ""
echo "1. Auth Gate"

# 1.1 Main page redirects to login
RESULT=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "$APP_URL")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
REDIR=$(echo "$RESULT" | cut -d'|' -f2)
assert_eq "1.1 Main page returns 307" "307" "$HTTP"
assert_eq "1.1 Redirects to login" "${APP_URL}/login" "$REDIR"

# 1.2 Protected page redirects to login
RESULT=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "${APP_URL}/tts-debug")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
REDIR=$(echo "$RESULT" | cut -d'|' -f2)
assert_eq "1.2 tts-debug returns 307" "307" "$HTTP"
assert_eq "1.2 Redirects to login" "${APP_URL}/login" "$REDIR"

# 1.3 Login page loads without redirect
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/login")
BODY=$(curl -s "${APP_URL}/login")
assert_eq "1.3 Login page returns 200" "200" "$HTTP"
assert_contains "1.3 Has Google sign-in button" "使用 Google 账号登录" "$BODY"

# --- 2. Login / OAuth Flow --------------------------------------------------

echo ""
echo "2. Login / OAuth Flow"

# 2.1 CSRF endpoint works
CSRF_RESP=$(curl -s -c "$COOKIE_JAR" "${APP_URL}/api/auth/csrf")
assert_contains "2.1 CSRF endpoint returns token" "csrfToken" "$CSRF_RESP"
CSRF=$(echo "$CSRF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null || echo "")

# 2.2 POST signin redirects to Google
if [ -n "$CSRF" ]; then
  RESULT=$(curl -s -b "$COOKIE_JAR" -X POST "${APP_URL}/api/auth/signin/google" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=${CSRF}&callbackUrl=${APP_URL}" \
    -o /dev/null -w "%{http_code}|%{redirect_url}")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  REDIR=$(echo "$RESULT" | cut -d'|' -f2)
  assert_eq "2.2 Sign-in POST returns 302" "302" "$HTTP"
  assert_contains "2.2 Redirects to Google OAuth" "accounts.google.com" "$REDIR"
  assert_contains "2.2 redirect_uri includes basePath" "Pokemon%2Fcardsmaster%2Fapi%2Fauth%2Fcallback%2Fgoogle" "$REDIR"
else
  fail "2.2 Sign-in POST" "no CSRF token"
fi

# 2.3 Providers endpoint returns Google with correct callback
PROVIDERS=$(curl -s "${APP_URL}/api/auth/providers")
assert_contains "2.3 Google provider configured" '"google"' "$PROVIDERS"
assert_contains "2.3 Callback URL has basePath" "${APP_PATH}/api/auth/callback/google" "$PROVIDERS"

# --- 3. API Auth Protection -------------------------------------------------

echo ""
echo "3. API Auth Protection"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/quota")
assert_eq "3.1 /api/quota requires auth (307)" "307" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${APP_URL}/api/recognize-card")
assert_eq "3.2 /api/recognize-card requires auth (307)" "307" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${APP_URL}/api/tts")
assert_eq "3.3 /api/tts requires auth (307)" "307" "$HTTP"

# --- 4. PWA Manifest --------------------------------------------------------

echo ""
echo "4. PWA Manifest"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/manifest.webmanifest")
assert_eq "4.1 Manifest returns 200" "200" "$HTTP"

MANIFEST=$(curl -s "${APP_URL}/manifest.webmanifest")
assert_contains "4.1 Manifest has app name" '宝可梦卡牌大师' "$MANIFEST"
assert_contains "4.2 start_url has basePath" "${APP_PATH}" "$MANIFEST"
assert_contains "4.3 Icon 192 has basePath" "${APP_PATH}/icons/icon-192.png" "$MANIFEST"
assert_contains "4.4 Icon 512 has basePath" "${APP_PATH}/icons/icon-512.png" "$MANIFEST"

# --- 5. HTML Meta / SW -------------------------------------------------------

echo ""
echo "5. HTML Meta & Service Worker"

LOGIN_HTML=$(curl -s "${APP_URL}/login")
assert_contains "5.1 Manifest link has basePath" "href=\"${APP_PATH}/manifest.webmanifest\"" "$LOGIN_HTML"
assert_contains "5.2 SW register has basePath" "register('${APP_PATH}/sw.js')" "$LOGIN_HTML"
assert_contains "5.3 SessionProvider basePath" "${APP_PATH}/api/auth" "$LOGIN_HTML"

# --- 6. Static Assets -------------------------------------------------------

echo ""
echo "6. Static Assets"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/sw.js")
assert_eq "6.1 sw.js returns 200" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/icons/icon-192.png")
assert_eq "6.2 icon-192.png returns 200" "200" "$HTTP"

# --- Summary -----------------------------------------------------------------

echo ""
echo "============================================"
TOTAL=$((PASSED + FAILED))
if [ "$FAILED" -eq 0 ]; then
  printf "\033[32m  All %d checks passed\033[0m\n" "$TOTAL"
else
  printf "\033[31m  %d/%d failed\033[0m\n" "$FAILED" "$TOTAL"
fi
echo "============================================"
echo ""

exit "$FAILED"
