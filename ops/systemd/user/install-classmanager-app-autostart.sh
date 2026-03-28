#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
TEMPLATE_PATH="$PROJECT_DIR/ops/systemd/user/classmanager-app.service"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
TARGET_PATH="$SYSTEMD_USER_DIR/classmanager-app.service"
RUNTIME_ENV_FILE="$PROJECT_DIR/.env.runtime"
STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/classmanager-multi"
RECOMMENDED_DB_PATH="$STATE_ROOT/database/classmanager.db"
RECOMMENDED_BACKUP_DIR="$STATE_ROOT/backups/sqlite"
RECOMMENDED_RUNTIME_DIR="$STATE_ROOT/runtime"
RECOMMENDED_ALERT_DIR="$STATE_ROOT/alerts"
RECOMMENDED_RECOVERY_DIR="$STATE_ROOT/recovery"

mkdir -p "$SYSTEMD_USER_DIR"

sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE_PATH" > "$TARGET_PATH"

systemctl --user daemon-reload
systemctl --user enable classmanager-app.service
systemctl --user restart classmanager-app.service

echo "User service installed: $TARGET_PATH"
echo "Service status: systemctl --user status classmanager-app.service"
echo "Recommended runtime data paths (add to $RUNTIME_ENV_FILE if you want code/data separation):"
echo "  CLASSMANAGER_DB_PATH=$RECOMMENDED_DB_PATH"
echo "  CLASSMANAGER_BACKUP_DIR=$RECOMMENDED_BACKUP_DIR"
echo "  CLASSMANAGER_RUNTIME_DIR=$RECOMMENDED_RUNTIME_DIR"
echo "  CLASSMANAGER_ALERT_DIR=$RECOMMENDED_ALERT_DIR"
echo "  CLASSMANAGER_RECOVERY_DIR=$RECOMMENDED_RECOVERY_DIR"
echo "Existing repository data is not migrated automatically; copy it first before switching paths."
echo "Boot autostart note: if you need the service to start before login, run as root once:"
echo "  loginctl enable-linger $USER"
