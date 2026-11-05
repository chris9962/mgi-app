#!/usr/bin/env bash
# Bật trang bảo trì cho cả hai tên miền. Nginx kiểm file deploy/maintenance/on ở từng request, không cần reload.
set -euo pipefail
touch "$(cd "$(dirname "${BASH_SOURCE[0]}")/maintenance" && pwd)/on"
echo "Đã bật bảo trì. Tắt bằng: $(dirname "${BASH_SOURCE[0]}")/maintenance-off.sh"
