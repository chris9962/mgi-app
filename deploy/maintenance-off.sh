#!/usr/bin/env bash
# Tắt trang bảo trì: xoá file đánh dấu là request kế tiếp vào lại app.
set -euo pipefail
rm -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/maintenance" && pwd)/on"
echo "Đã tắt bảo trì."
