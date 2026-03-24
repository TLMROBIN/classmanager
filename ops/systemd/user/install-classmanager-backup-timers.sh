#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

UNITS=(
    classmanager-backup.service
    classmanager-backup.timer
    classmanager-backup-verify.service
    classmanager-backup-verify.timer
    classmanager-backup-freshness.service
    classmanager-backup-freshness.timer
    classmanager-backup-alert.service
    classmanager-backup-verify-alert.service
)

mkdir -p "$SYSTEMD_USER_DIR"

for unit in "${UNITS[@]}"; do
    template_path="$PROJECT_DIR/ops/systemd/user/$unit"
    target_path="$SYSTEMD_USER_DIR/$unit"
    sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$template_path" > "$target_path"
done

systemctl --user daemon-reload
systemctl --user enable --now classmanager-backup.timer
systemctl --user enable --now classmanager-backup-verify.timer
systemctl --user enable --now classmanager-backup-freshness.timer

echo "Backup timers installed under: $SYSTEMD_USER_DIR"
echo "Enabled timers:"
echo "  - classmanager-backup.timer"
echo "  - classmanager-backup-verify.timer"
echo "  - classmanager-backup-freshness.timer"
echo "Check status with:"
echo "  systemctl --user list-timers | rg classmanager-backup"
