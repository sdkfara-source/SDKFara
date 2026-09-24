#!/usr/bin/env bash
set -euo pipefail
# Serv00 — إعداد المشروع وتشغيله عبر Phusion Passenger
# الاستخدام بعد فك حزمة ~/serv00-app:
#   bash ~/serv00-app/deploy/serv00_setup.sh USERNAME DOMAIN [NODE_BIN]
# مثال:
#   bash ~/serv00-app/deploy/serv00_setup.sh hakeem hakeem.serv00.net /usr/local/bin/node22

U="${1:?يُمرَّر اسم مستخدم Serv00}"
D="${2:?يُمرَّر اسم النطاق، مثال: hakeem.serv00.net}"
NODE="${3:-/usr/local/bin/node22}"

SRC="$HOME/serv00-app"
BASE="$HOME/domains/$D"
WEB="$BASE/public_nodejs"

echo "[1/5] إنشاء مساحة النطاق..."
mkdir -p "$BASE" "$WEB/data/backups" "$WEB/studies"

echo "[2/5] نسخ ملفات المشروع (مع الحفاظ على data/ و studies/ الموجودة)..."
for f in "$SRC"/*; do
  b="$(basename "$f")"
  case "$b" in
    data|studies) ;;
    *) [ -e "$f" ] && cp -rT "$f" "$WEB/$b" ;;
  esac
done
[ -f "$WEB/data/cms_default.json" ] || cp "$SRC/data/cms_default.json" "$WEB/data/" 2>/dev/null || true
[ -f "$WEB/data/cms.json" ]          || cp "$SRC/data/cms.json"          "$WEB/data/" 2>/dev/null || true
[ -f "$WEB/data/config.json" ]       || cp "$SRC/data/config.json"       "$WEB/data/" 2>/dev/null || true
cp -n "$SRC"/studies/* "$WEB/studies/" 2>/dev/null || true

echo "[3/5] إعادة تسمية مجلد الواجهة public -> web (لتجنّب أولوية المستضيف الثابت)"
if [ -d "$WEB/public" ] && [ ! -d "$WEB/web" ]; then
  mv "$WEB/public" "$WEB/web"
fi
grep -q 'export STATIC_DIR=web' "$HOME/.bash_profile" 2>/dev/null || \
  echo 'export STATIC_DIR=web' >> "$HOME/.bash_profile"

echo "[4/5] التأكد من وجود موقع Node.js (Passenger)..."
if ! devil www list 2>/dev/null | grep -q "$D"; then
  devil www add "$D" nodejs "$NODE" production
else
  devil www options "$D" processes 1 2>/dev/null || true
fi

echo "[5/5] إعادة تشغيل الموقع والفحص..."
devil www restart "$D" || true
sleep 3
LOG="$BASE/logs/error.log"
[ -f "$LOG" ] && tail -n 15 "$LOG" || true
echo ""
echo "فحص مباشر:"
curl -sk "https://$D/api/status" && echo ""
echo "اكتمل الإعداد ✓ (أعد فتح جلسة SSH أو نفّذ: source ~/.bash_profile)"