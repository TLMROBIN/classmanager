#!/bin/bash

set -euo pipefail

PROJECT_ROOT="${CLASSMANAGER_PROJECT_ROOT:-/home/yub/文档/trae_projects/classmanager/classmanager-multi}"
BRANCH="${CLASSMANAGER_DEPLOY_BRANCH:-main}"
REMOTE="${CLASSMANAGER_DEPLOY_REMOTE:-origin}"
STATE_ROOT="${CLASSMANAGER_DEPLOY_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/classmanager-multi}"
LOCK_FILE="${CLASSMANAGER_DEPLOY_LOCK:-$STATE_ROOT/runtime/github-deploy.lock}"
PORT="${PORT:-3002}"
NODE_BIN_DIR="${CLASSMANAGER_NODE_BIN_DIR:-/opt/node-current/bin}"

export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "Project root is not a Git checkout: $PROJECT_ROOT" >&2
    exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another classmanager GitHub deploy is already running."
    exit 0
fi

cd "$PROJECT_ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Refusing to deploy over tracked local changes in $PROJECT_ROOT." >&2
    git status --short >&2
    exit 1
fi

echo "[1/6] Fetch $REMOTE/$BRANCH"
git fetch --prune "$REMOTE" "$BRANCH"

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH")"

if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
    echo "Already up to date: ${LOCAL_HEAD:0:7}"
    exit 0
fi

echo "[2/6] Fast-forward ${LOCAL_HEAD:0:7} -> ${REMOTE_HEAD:0:7}"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "[3/6] Install dependencies"
npm ci

echo "[4/6] Build web assets"
npm run build:web-assets

echo "[5/6] Restart classmanager app"
systemctl --user restart classmanager-app.service

echo "[6/6] Verify health"
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if node -e "fetch('http://127.0.0.1:${PORT}/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
        echo "Health check passed on port $PORT."
        echo "Deployed ${REMOTE_HEAD:0:7} from GitHub."
        exit 0
    fi
    sleep 1
done

echo "Health check failed after deploy." >&2
systemctl --user status classmanager-app.service --no-pager >&2 || true
exit 1
