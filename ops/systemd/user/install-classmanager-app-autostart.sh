#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
TEMPLATE_PATH="$PROJECT_DIR/ops/systemd/user/classmanager-app.service"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
TARGET_PATH="$SYSTEMD_USER_DIR/classmanager-app.service"

mkdir -p "$SYSTEMD_USER_DIR"

sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE_PATH" > "$TARGET_PATH"

systemctl --user daemon-reload
systemctl --user enable classmanager-app.service
systemctl --user restart classmanager-app.service

echo "User service installed: $TARGET_PATH"
echo "Service status: systemctl --user status classmanager-app.service"
echo "Boot autostart note: if you need the service to start before login, run as root once:"
echo "  loginctl enable-linger $USER"
