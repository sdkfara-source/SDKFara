#!/usr/bin/env bash
set -euo pipefail

# install.sh — يُشغَّل مرة واحدة على خادم Oracle Cloud (Ubuntu)
# تشغيل: sudo bash deploy/install.sh

APP_USER="hakeem"
APP_DIR="/home/${APP_USER}/hakeem-center"
ROOT="$(cd "$(dirname "$(dirname "${BASH_SOURCE[0]}")")" && pwd)"

echo "[1/4] تثبيت Node.js (LTS 20) إن لم يكن موجوداً..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    node: $(node -v)  |  npm: $(npm -v || true)"

echo "[2/4] إنشاء المستخدم ونقل ملفات المشروع..."
sudo useradd -m -s /bin/bash "${APP_USER}" 2>/dev/null || true
sudo mkdir -p "${APP_DIR}"
sudo cp -r "${ROOT}/." "${APP_DIR}/"

echo "[3/4] صلاحيات الكتابة (المحتوى + الدراسة + الشعار)..."
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
sudo chmod -R u+rwX "${APP_DIR}/data" "${APP_DIR}/studies"

echo "[4/4] تفعيل خدمة systemd..."
sudo cp "${APP_DIR}/deploy/hakeem.service" /etc/systemd/system/hakeem.service
sudo systemctl daemon-reload
sudo systemctl enable --now hakeem
sleep 2

echo ""
sudo systemctl status hakeem --no-pager | head -n 8
echo ""
echo "اختبار محلي:"
curl -s http://localhost:3000/api/status && echo "" && echo "التثبيت اكتمل ✓"