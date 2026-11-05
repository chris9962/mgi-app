#!/usr/bin/env bash
# Cài hoặc cập nhật job chạy thẳng trên máy chủ bằng systemd: ops-watch, dọn ảnh mồ côi, sao lưu, kiểm sao lưu.
# Chạy sau app và worker, mỗi lần deploy/systemd/ có thay đổi:
#   cd /opt/mgi-bank && ./deploy/jobs.sh
set -euo pipefail
GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"

cp deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable mgi-bank-ops-watch.service >/dev/null
# restart chứ không chỉ enable --now: ops-watch đang chạy phải nạp lại code mới.
systemctl restart mgi-bank-ops-watch.service
systemctl enable --now mgi-bank-s3-orphans.timer >/dev/null
# Thiếu .env.backup thì unit sao lưu hỏng ngay ở EnvironmentFile: chưa có bucket sao lưu thì chưa bật.
if [ -f "$GOC/.env.backup" ]; then
  systemctl enable --now mgi-bank-backup.timer mgi-bank-backup-check.timer >/dev/null
else
  echo "Chưa có $GOC/.env.backup: bỏ qua timer sao lưu (docs/deploy.md mục 8)."
fi
systemctl --no-pager status mgi-bank-ops-watch.service | head -5 || true
systemctl --no-pager list-timers 'mgi-bank-*' || true
