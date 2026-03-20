#!/bin/bash
# 自动提交并推送到 GitHub 的脚本 (classmanager-multi)
cd /home/binyu/文档/trae_projects/classmanager/classmanager-multi || exit 1

# 禁用凭据助手以避免命令行挂起
export GIT_ASKPASS=
git config --local credential.helper ""

# 重置并且确保 remote 设置正确（包括 token）
# 这里只设置一次，后面就可以无密码推送
REMOTE_EXIST=$(git remote -v | grep origin)
if [ -z "$REMOTE_EXIST" ]; then
    git remote add origin https://TLMROBIN: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@github.com/TLMROBIN/classmanager.git
else
    git remote set-url origin https://TLMROBIN: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@github.com/TLMROBIN/classmanager.git
fi

# 确保配置了用户名和邮箱
git config user.name "TLMROBIN"
git config user.email "tlmrobin@163.com"

# 添加所有允许的变更
git add .

# 检查是否有变更需要提交
if git status --porcelain | grep -q .; then
    COMMIT_MSG="Auto commit: $(date '+%Y-%m-%d %H:%M:%S')"
    if [ ! -z "$1" ]; then
        COMMIT_MSG="$1"
    fi
    
    echo "正在提交 classmanager-multi 的变更: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
    
    echo "正在推送到 GitHub..."
    git branch -M main
    git push origin main
    echo "推送成功！"
else
    echo "没有需要提交的变更。"
fi
