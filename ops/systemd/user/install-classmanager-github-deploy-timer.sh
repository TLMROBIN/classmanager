#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

mkdir -p "$SYSTEMD_USER_DIR"

for unit in classmanager-github-deploy.service classmanager-github-deploy.timer; do
    sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        "$PROJECT_DIR/ops/systemd/user/$unit" \
        > "$SYSTEMD_USER_DIR/$unit"
done

chmod +x "$PROJECT_DIR/scripts/deploy_from_github.sh"

systemctl --user daemon-reload
systemctl --user enable --now classmanager-github-deploy.timer

echo "GitHub deploy timer installed under: $SYSTEMD_USER_DIR"
echo "Enabled timer:"
echo "  - classmanager-github-deploy.timer"
echo "Check status with:"
echo "  systemctl --user list-timers | rg classmanager-github-deploy"
