(function () {
    const MAINTENANCE_PASSWORD_MIN_LENGTH = 6;

    const parseJsonResponse = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    };

    const createCell = (text, className) => {
        const cell = document.createElement('td');
        cell.className = className;
        cell.textContent = text;
        return cell;
    };

    const createUserRow = (user) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        row.appendChild(createCell(String(user.id ?? '-'), 'px-4 py-3 text-sm text-gray-600'));
        row.appendChild(createCell(user.username || '-', 'px-4 py-3 text-sm font-medium text-gray-800'));
        row.appendChild(createCell(user.email || '-', 'px-4 py-3 text-sm text-gray-500'));

        const roleCell = document.createElement('td');
        roleCell.className = 'px-4 py-3 text-sm';
        const roleBadge = document.createElement('span');
        roleBadge.className = user.role === 'admin'
            ? 'px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700'
            : 'px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600';
        roleBadge.textContent = user.role === 'admin' ? '管理员' : '用户';
        roleCell.appendChild(roleBadge);
        row.appendChild(roleCell);

        row.appendChild(createCell(String(user.data_count ?? 0), 'px-4 py-3 text-sm text-gray-600'));
        row.appendChild(createCell(
            user.created_at ? new Date(user.created_at).toLocaleDateString() : '-',
            'px-4 py-3 text-sm text-gray-500'
        ));

        const actionCell = document.createElement('td');
        actionCell.className = 'px-4 py-3 text-sm';

        const roleButton = document.createElement('button');
        roleButton.type = 'button';
        roleButton.className = 'text-blue-600 hover:text-blue-800 mr-3';
        roleButton.textContent = user.role === 'admin' ? '设为用户' : '设为管理员';
        roleButton.addEventListener('click', () => {
            void toggleRole(user.id, user.role);
        });
        actionCell.appendChild(roleButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'text-red-600 hover:text-red-800';
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', () => {
            void deleteUser(user.id);
        });
        actionCell.appendChild(deleteButton);

        if (user.role !== 'admin') {
            const resetPasswordButton = document.createElement('button');
            resetPasswordButton.type = 'button';
            resetPasswordButton.className = 'text-orange-600 hover:text-orange-800 mr-3';
            resetPasswordButton.textContent = '重置密码';
            resetPasswordButton.addEventListener('click', () => {
                showResetModal(user.id, user.username, 'password');
            });
            actionCell.insertBefore(resetPasswordButton, deleteButton);

            const resetMaintButton = document.createElement('button');
            resetMaintButton.type = 'button';
            resetMaintButton.className = 'text-amber-600 hover:text-amber-800 mr-3';
            resetMaintButton.textContent = '重置维护密码';
            resetMaintButton.addEventListener('click', () => {
                showResetModal(user.id, user.username, 'maintenance');
            });
            actionCell.insertBefore(resetMaintButton, deleteButton);
        }

        row.appendChild(actionCell);
        return row;
    };

    const fetchWithAuth = async (url, options) => {
        const res = await fetch(url, options || {});

        if (res.status === 401) {
            window.__clearAuthAndRedirect__();
            return null;
        }

        if (res.status === 403) {
            alert('当前账户没有管理员权限');
            window.location.replace('/');
            return null;
        }

        return res;
    };

    const loadStats = async () => {
        const res = await fetchWithAuth('/api/admin/stats');
        if (!res) return;

        const data = await parseJsonResponse(res);
        if (!data || !data.success) {
            alert((data && data.error) || '获取统计失败');
            return;
        }

        document.getElementById('totalUsers').textContent = data.stats.totalUsers;
        document.getElementById('totalData').textContent = data.stats.totalDataRecords;
    };

    const loadUsers = async () => {
        const res = await fetchWithAuth('/api/admin/users');
        if (!res) return;

        const data = await parseJsonResponse(res);
        if (!data || !data.success) {
            alert((data && data.error) || '获取用户列表失败');
            return;
        }

        const adminCount = data.users.filter((user) => user.role === 'admin').length;
        document.getElementById('adminCount').textContent = adminCount;

        const tbody = document.getElementById('userList');
        tbody.replaceChildren(...data.users.map(createUserRow));
    };

    const toggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const nextRoleLabel = newRole === 'admin' ? '管理员' : '普通用户';

        if (!window.confirm(`确定要将该用户角色改为"${nextRoleLabel}"吗？`)) {
            return;
        }

        const res = await fetchWithAuth(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        if (!res) return;

        const data = await parseJsonResponse(res);
        if (!data || !data.success) {
            alert((data && data.error) || '操作失败');
            return;
        }

        await loadUsers();
    };

    const deleteUser = async (userId) => {
        if (!window.confirm('确定要删除该用户及其所有数据吗？此操作不可恢复！')) {
            return;
        }

        const res = await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (!res) return;

        const data = await parseJsonResponse(res);
        if (!data || !data.success) {
            alert((data && data.error) || '删除失败');
            return;
        }

        await Promise.all([loadUsers(), loadStats()]);
    };

    const resetModal = document.getElementById('resetPasswordModal');
    const resetModalTitle = document.getElementById('resetModalTitle');
    const resetModalUser = document.getElementById('resetModalUser');
    const resetNewPassword = document.getElementById('resetNewPassword');
    const resetNewPasswordConfirm = document.getElementById('resetNewPasswordConfirm');
    const resetModalError = document.getElementById('resetModalError');
    const resetModalCancel = document.getElementById('resetModalCancel');
    const resetModalConfirm = document.getElementById('resetModalConfirm');

    let currentResetTarget = null;

    const showResetModal = (userId, username, type) => {
        currentResetTarget = { userId, username, type };
        resetModalTitle.textContent = type === 'password' ? '重置登录密码' : '重置维护密码';
        resetModalUser.textContent = '用户: ' + username;
        resetNewPassword.value = '';
        resetNewPasswordConfirm.value = '';
        resetModalError.classList.add('hidden');
        resetModalError.textContent = '';
        resetModal.classList.remove('hidden');
        resetModal.classList.add('flex');
        resetNewPassword.focus();
    };

    const hideResetModal = () => {
        currentResetTarget = null;
        resetModal.classList.add('hidden');
        resetModal.classList.remove('flex');
    };

    const handleResetConfirm = async () => {
        if (!currentResetTarget) return;

        const { userId, type } = currentResetTarget;
        const newPasswordVal = resetNewPassword.value;
        const confirmPasswordVal = resetNewPasswordConfirm.value;

        if (!newPasswordVal) {
            resetModalError.textContent = '请输入新密码';
            resetModalError.classList.remove('hidden');
            return;
        }

        if (newPasswordVal.length < MAINTENANCE_PASSWORD_MIN_LENGTH) {
            resetModalError.textContent = '密码长度至少' + MAINTENANCE_PASSWORD_MIN_LENGTH + '个字符';
            resetModalError.classList.remove('hidden');
            return;
        }

        if (newPasswordVal !== confirmPasswordVal) {
            resetModalError.textContent = '两次输入的密码不一致';
            resetModalError.classList.remove('hidden');
            return;
        }

        const endpoint = type === 'password'
            ? '/api/admin/users/' + userId + '/password'
            : '/api/admin/users/' + userId + '/maintenance-password';

        const res = await fetchWithAuth(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPasswordVal })
        });
        if (!res) { hideResetModal(); return; }

        const data = await parseJsonResponse(res);
        if (!data || !data.success) {
            resetModalError.textContent = (data && data.error) || '重置失败';
            resetModalError.classList.remove('hidden');
            return;
        }

        hideResetModal();
        alert((type === 'password' ? '登录密码' : '维护密码') + '已重置');
    };

    resetModalCancel.addEventListener('click', hideResetModal);
    resetModalConfirm.addEventListener('click', () => { void handleResetConfirm(); });
    resetModal.addEventListener('click', (e) => {
        if (e.target === resetModal) hideResetModal();
    });
    resetNewPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') resetNewPasswordConfirm.focus();
    });
    resetNewPasswordConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void handleResetConfirm();
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        void window.__logout__();
    });

    void (async () => {
        try {
            const user = await window.__verifySession__();
            if (!user) {
                window.location.replace('/login.html');
                return;
            }

            if (user.role !== 'admin') {
                alert('当前账户没有管理员权限');
                window.location.replace('/');
                return;
            }

            await Promise.all([loadStats(), loadUsers()]);
        } catch (error) {
            console.error('初始化管理员后台失败:', error);
            alert(error.message || '无法验证登录状态，请刷新重试');
        }
    })();
})();
