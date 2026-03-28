#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
RUNTIME_ENV_FILE="$PROJECT_DIR/.env.runtime"
STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/classmanager-multi"
RECOMMENDED_DB_PATH="$STATE_ROOT/database/classmanager.db"
RECOMMENDED_BACKUP_DIR="$STATE_ROOT/backups/sqlite"
RECOMMENDED_RUNTIME_DIR="$STATE_ROOT/runtime"
RECOMMENDED_ALERT_DIR="$STATE_ROOT/alerts"
RECOMMENDED_RECOVERY_DIR="$STATE_ROOT/recovery"

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
echo "These units also read: $RUNTIME_ENV_FILE"
echo "Recommended runtime data paths:"
echo "  CLASSMANAGER_DB_PATH=$RECOMMENDED_DB_PATH"
echo "  CLASSMANAGER_BACKUP_DIR=$RECOMMENDED_BACKUP_DIR"
echo "  CLASSMANAGER_RUNTIME_DIR=$RECOMMENDED_RUNTIME_DIR"
echo "  CLASSMANAGER_ALERT_DIR=$RECOMMENDED_ALERT_DIR"
echo "  CLASSMANAGER_RECOVERY_DIR=$RECOMMENDED_RECOVERY_DIR"
echo "Check status with:"
echo "  systemctl --user list-timers | rg classmanager-backup"
