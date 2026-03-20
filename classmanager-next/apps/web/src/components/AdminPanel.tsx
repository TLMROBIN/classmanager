import { useEffect, useState } from "react";

import type { AdminAudit, AdminMember, AdminRole, AdminSummaryResponse } from "../types";

const adminAuditActionLabels: Record<string, string> = {
  "membership.roles.update": "角色调整",
  "membership.status.disable": "停用成员",
  "membership.status.enable": "恢复成员",
  "membership.invite.create": "创建邀请",
  "membership.password.set": "设置密码",
  "membership.delete": "删除成员"
};

const memberStatusLabels: Record<string, string> = {
  active: "正常",
  disabled: "已停用",
  invited: "待激活"
};

type AdminPanelProps = {
  summary: AdminSummaryResponse | null;
  members: AdminMember[];
  roles: AdminRole[];
  audits: AdminAudit[];
  selectedMembershipId: string;
  selectedMemberDetail: {
    item: AdminMember;
    recentAudits: AdminAudit[];
  } | null;
  activeMembershipId: string;
  updatingRoles: boolean;
  updatingStatus: boolean;
  updatingPassword: boolean;
  deletingMember: boolean;
  creatingInvitation: boolean;
  loadingAdminData: boolean;
  adminErrorMessage: string;
  lastAdminMessage: string;
  memberSearch: string;
  memberStatus: "" | "active" | "disabled" | "invited";
  memberRoleCode: string;
  memberSortBy: "status" | "joinedAt" | "lastLoginAt";
  auditAction:
    | ""
    | "membership.roles.update"
    | "membership.status.disable"
    | "membership.status.enable"
    | "membership.invite.create"
    | "membership.password.set"
    | "membership.delete";
  onMemberSearchChange: (value: string) => void;
  onMemberStatusChange: (value: "" | "active" | "disabled" | "invited") => void;
  onMemberRoleCodeChange: (value: string) => void;
  onMemberSortByChange: (value: "status" | "joinedAt" | "lastLoginAt") => void;
  onAuditActionChange: (
    value:
      | ""
      | "membership.roles.update"
      | "membership.status.disable"
      | "membership.status.enable"
      | "membership.invite.create"
      | "membership.password.set"
      | "membership.delete"
  ) => void;
  onSelectMembership: (membershipId: string) => void;
  onUpdateRoles: (roleCodes: string[]) => void;
  onUpdateStatus: (status: "active" | "disabled") => void;
  onUpdatePassword: (password: string) => void;
  onDeleteMember: () => void;
  onCreateInvitation: (input: {
    username: string;
    displayName: string;
    email?: string;
    roleCodes: string[];
  }) => void;
};

function formatRoleCodes(roleCodes: string[]) {
  return roleCodes.length ? roleCodes.join(" / ") : "未分配角色";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

function formatAdminAuditSummary(audit: AdminAudit) {
  const beforeStatus = typeof audit.beforeData?.status === "string" ? audit.beforeData.status : "";
  const afterStatus = typeof audit.afterData?.status === "string" ? audit.afterData.status : "";
  const beforeRoleCodes = Array.isArray(audit.beforeData?.roleCodes)
    ? (audit.beforeData?.roleCodes as string[])
    : [];
  const afterRoleCodes = Array.isArray(audit.afterData?.roleCodes)
    ? (audit.afterData?.roleCodes as string[])
    : [];

  if (audit.action === "membership.roles.update") {
    return `${formatRoleCodes(beforeRoleCodes)} -> ${formatRoleCodes(afterRoleCodes)}`;
  }

  if (audit.action === "membership.status.disable" || audit.action === "membership.status.enable") {
    return `${beforeStatus || "-"} -> ${afterStatus || "-"}`;
  }

  if (audit.action === "membership.invite.create") {
    const username = typeof audit.afterData?.username === "string" ? audit.afterData.username : "unknown";
    return `invited ${username}`;
  }

  if (audit.action === "membership.password.set") {
    const username = typeof audit.afterData?.username === "string" ? audit.afterData.username : "unknown";
    return `reset ${username}`;
  }

  if (audit.action === "membership.delete") {
    const username = typeof audit.beforeData?.username === "string" ? audit.beforeData.username : "unknown";
    return `delete ${username}`;
  }

  return audit.action;
}

function formatRolePreview(roleCodes: string[], roles: AdminRole[]) {
  if (!roleCodes.length) return "未分配角色";
  return roleCodes
    .map((code) => roles.find((role) => role.code === code)?.name || code)
    .join(" / ");
}

function formatMemberStatus(status: string) {
  return memberStatusLabels[status] || status;
}

export function AdminPanel({
  summary,
  members,
  roles,
  audits,
  selectedMembershipId,
  selectedMemberDetail,
  activeMembershipId,
  updatingRoles,
  updatingStatus,
  updatingPassword,
  deletingMember,
  creatingInvitation,
  loadingAdminData,
  adminErrorMessage,
  lastAdminMessage,
  memberSearch,
  memberStatus,
  memberRoleCode,
  memberSortBy,
  auditAction,
  onMemberSearchChange,
  onMemberStatusChange,
  onMemberRoleCodeChange,
  onMemberSortByChange,
  onAuditActionChange,
  onSelectMembership,
  onUpdateRoles,
  onUpdateStatus,
  onUpdatePassword,
  onDeleteMember,
  onCreateInvitation
}: AdminPanelProps) {
  const selectedRoleCodes = selectedMemberDetail?.item.roleCodes || [];
  const canEditSelectedMember = selectedMemberDetail && selectedMemberDetail.item.id !== activeMembershipId;
  const canUpdateSelectedStatus = Boolean(canEditSelectedMember && selectedMemberDetail);
  const [draftRoleCodes, setDraftRoleCodes] = useState<string[]>(selectedRoleCodes);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleCodes, setInviteRoleCodes] = useState<string[]>(["tenant_member"]);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [memberOperationScope, setMemberOperationScope] = useState<"" | "editable" | "restricted" | "activatable" | "deletable">("");
  const [memberAuditSearch, setMemberAuditSearch] = useState("");
  const [memberAuditDateFrom, setMemberAuditDateFrom] = useState("");
  const [memberAuditDateTo, setMemberAuditDateTo] = useState("");
  const [tenantAuditSearch, setTenantAuditSearch] = useState("");
  const [tenantAuditDateFrom, setTenantAuditDateFrom] = useState("");
  const [tenantAuditDateTo, setTenantAuditDateTo] = useState("");
  const isOnlyMember = members.length <= 1;
  const matchesDateRange = (value: string, dateFrom: string, dateTo: string) => {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  };
  const filteredMembers = members.filter((member) => {
    if (!memberOperationScope) return true;
    const isSelf = member.id === activeMembershipId;
    if (memberOperationScope === "editable") {
      return !isSelf;
    }
    if (memberOperationScope === "restricted") {
      return isSelf;
    }
    if (memberOperationScope === "activatable") {
      return member.status === "invited" || member.status === "disabled";
    }
    if (memberOperationScope === "deletable") {
      return !isSelf && (member.status === "invited" || member.status === "disabled");
    }
    return true;
  });
  const filteredMemberSummary = filteredMembers.reduce(
    (totals, member) => {
      if (member.status === "active") totals.active += 1;
      if (member.status === "disabled") totals.disabled += 1;
      if (member.status === "invited") totals.invited += 1;
      if (member.id !== activeMembershipId && (member.status === "disabled" || member.status === "invited")) {
        totals.deletable += 1;
      }
      return totals;
    },
    {
      active: 0,
      disabled: 0,
      invited: 0,
      deletable: 0
    }
  );
  const filteredMemberAudits = (selectedMemberDetail?.recentAudits || []).filter((audit) => {
    const keyword = memberAuditSearch.trim();
    const matchesDate = matchesDateRange(audit.createdAt, memberAuditDateFrom, memberAuditDateTo);
    if (!matchesDate) return false;
    if (!keyword) return true;
    const actorName = audit.actorUser?.displayName || audit.actorUser?.username || audit.actorUserId || "系统";
    return [actorName, adminAuditActionLabels[audit.action] || audit.action, formatAdminAuditSummary(audit)].some((value) => value.includes(keyword));
  });
  const filteredTenantAudits = audits.filter((audit) => {
    const keyword = tenantAuditSearch.trim();
    const matchesDate = matchesDateRange(audit.createdAt, tenantAuditDateFrom, tenantAuditDateTo);
    if (!matchesDate) return false;
    if (!keyword) return true;
    const actorName = audit.actorUser?.displayName || audit.actorUser?.username || audit.actorUserId || "系统";
    return [actorName, adminAuditActionLabels[audit.action] || audit.action, formatAdminAuditSummary(audit)].some((value) => value.includes(keyword));
  });
  const tenantAuditSummary = filteredTenantAudits.reduce(
    (totals, audit) => {
      if (audit.action === "membership.roles.update") totals.roles += 1;
      if (audit.action === "membership.status.disable" || audit.action === "membership.status.enable") totals.status += 1;
      if (audit.action === "membership.invite.create") totals.invite += 1;
      if (audit.action === "membership.password.set") totals.password += 1;
      if (audit.action === "membership.delete") totals.delete += 1;
      return totals;
    },
    {
      roles: 0,
      status: 0,
      invite: 0,
      password: 0,
      delete: 0
    }
  );

  useEffect(() => {
    setDraftRoleCodes(selectedRoleCodes);
  }, [selectedRoleCodes]);

  useEffect(() => {
    setPasswordDraft("");
  }, [selectedMembershipId]);

  function toggleRole(code: string) {
    setDraftRoleCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  function toggleInviteRole(code: string) {
    setInviteRoleCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  function submitInvitation() {
    if (!inviteUsername.trim() || !inviteDisplayName.trim() || inviteRoleCodes.length === 0) return;
    onCreateInvitation({
      username: inviteUsername.trim(),
      displayName: inviteDisplayName.trim(),
      email: inviteEmail.trim() || undefined,
      roleCodes: inviteRoleCodes
    });
    setInviteUsername("");
    setInviteDisplayName("");
    setInviteEmail("");
    setInviteRoleCodes(["tenant_member"]);
  }

  return (
    <section className="content-grid admin-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>成员列表</h2>
          <span>{loadingAdminData ? "刷新中..." : `${filteredMembers.length} / ${members.length} 人`}</span>
        </div>

        {summary ? (
          <div className="attendance-summary-strip">
            <div>
              <span>成员总数</span>
              <strong>{summary.totals.members}</strong>
            </div>
            <div>
              <span>活跃成员</span>
              <strong>{summary.totals.activeMembers}</strong>
            </div>
            <div>
              <span>停用成员</span>
              <strong>{summary.totals.disabledMembers}</strong>
            </div>
            <div>
              <span>邀请成员</span>
              <strong>{summary.totals.invitedMembers}</strong>
            </div>
            <div>
              <span>租户角色</span>
              <strong>{summary.totals.roles}</strong>
            </div>
            <div>
              <span>角色审计</span>
              <strong>{summary.totals.roleAuditLogs}</strong>
            </div>
          </div>
        ) : null}

        <div className="attendance-summary-strip">
          <div>
            <span>当前筛选正常</span>
            <strong>{filteredMemberSummary.active}</strong>
          </div>
          <div>
            <span>当前筛选停用</span>
            <strong>{filteredMemberSummary.disabled}</strong>
          </div>
          <div>
            <span>当前筛选待激活</span>
            <strong>{filteredMemberSummary.invited}</strong>
          </div>
          <div>
            <span>当前可删除</span>
            <strong>{filteredMemberSummary.deletable}</strong>
          </div>
        </div>

        <div className="student-filters">
          <label>
            <span>搜索成员</span>
            <input value={memberSearch} onChange={(event) => onMemberSearchChange(event.target.value)} placeholder="用户名或显示名" />
          </label>
          <label>
            <span>成员状态</span>
            <select value={memberStatus} onChange={(event) => onMemberStatusChange(event.target.value as "" | "active" | "disabled" | "invited")}>
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">已停用</option>
              <option value="invited">待激活</option>
            </select>
          </label>
          <label>
            <span>成员角色</span>
            <select value={memberRoleCode} onChange={(event) => onMemberRoleCodeChange(event.target.value)}>
              <option value="">全部角色</option>
              {roles.map((role) => (
                <option key={`filter-role-${role.id}`} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>排序方式</span>
            <select
              value={memberSortBy}
              onChange={(event) => onMemberSortByChange(event.target.value as "status" | "joinedAt" | "lastLoginAt")}
            >
              <option value="status">状态优先</option>
              <option value="joinedAt">最近加入</option>
              <option value="lastLoginAt">最近登录</option>
            </select>
          </label>
          <label>
            <span>操作视角</span>
            <select
              value={memberOperationScope}
              onChange={(event) =>
                setMemberOperationScope(event.target.value as "" | "editable" | "restricted" | "activatable" | "deletable")
              }
            >
              <option value="">全部成员</option>
              <option value="editable">可编辑</option>
              <option value="restricted">本人受限</option>
              <option value="activatable">待激活/可恢复</option>
              <option value="deletable">可删除</option>
            </select>
          </label>
        </div>
        {adminErrorMessage ? <p className="warning-text">{adminErrorMessage}</p> : null}
        {lastAdminMessage ? <p className="success-text">{lastAdminMessage}</p> : null}

        <div className="panel-header compact">
          <h3>新增 invited 成员</h3>
          <span>最小邀请链路</span>
        </div>
        <div className="adjustment-form">
          <label>
            <span>用户名</span>
            <input value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} placeholder="teacher-a" />
          </label>
          <label>
            <span>显示名</span>
            <input value={inviteDisplayName} onChange={(event) => setInviteDisplayName(event.target.value)} placeholder="Teacher A" />
          </label>
          <label>
            <span>邮箱</span>
            <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teacher-a@example.com" />
          </label>
          <div className="detail-grid">
            <div>
              <span>邀请状态</span>
              <strong>invited</strong>
            </div>
            <div>
              <span>分配角色</span>
              <strong>{formatRolePreview(inviteRoleCodes, roles)}</strong>
            </div>
          </div>
          <div className="admin-role-grid">
            {roles.map((role) => {
              const checked = inviteRoleCodes.includes(role.code);
              return (
                <label key={`invite-${role.id}`} className="admin-role-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={creatingInvitation}
                    onChange={() => toggleInviteRole(role.code)}
                  />
                  <div>
                    <strong>{role.name}</strong>
                    <span>{role.code} · {role.scope}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="import-footer">
            <button
              type="button"
              className="adjustment-submit"
              disabled={creatingInvitation || !inviteUsername.trim() || !inviteDisplayName.trim() || inviteRoleCodes.length === 0}
              onClick={submitInvitation}
            >
              {creatingInvitation ? "创建中..." : "创建 invited 成员"}
            </button>
            <span className="muted">当前阶段只在租户内创建 invited 成员，不发送外部通知。</span>
          </div>
        </div>

        {members.length <= 1 ? (
          <p className="muted">当前租户只有 1 个成员，后台角色变更更适合在后续补入更多成员样本后演练。</p>
        ) : null}

        <div className="student-list">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`student-row ${member.id === selectedMembershipId ? "active" : ""}`}
              onClick={() => onSelectMembership(member.id)}
            >
              <div>
                <strong>{member.displayName || member.user.displayName || member.user.username}</strong>
                <span>{member.user.username} · {formatMemberStatus(member.status)}</span>
                <span>{formatRoleCodes(member.roleCodes)}</span>
                <span>加入时间 · {formatDateTime(member.joinedAt)}</span>
                <span>最近登录 · {formatDateTime(member.user.lastLoginAt)}</span>
                <span>
                  {member.id === activeMembershipId
                    ? "本人受限"
                    : member.status === "invited"
                      ? "可激活"
                      : member.status === "disabled"
                        ? "可恢复/可删除"
                        : "可编辑"}
                </span>
              </div>
              <b>{member.roleCodes.length} 角</b>
            </button>
          ))}
          {!filteredMembers.length ? <p className="muted">当前筛选条件下没有成员</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>成员详情</h2>
          <span>{selectedMemberDetail?.item.user.username || "未选择成员"}</span>
        </div>

        {selectedMemberDetail ? (
          <>
            <div className="attendance-summary-strip">
              <div>
                <span>当前状态</span>
                <strong>{formatMemberStatus(selectedMemberDetail.item.status)}</strong>
              </div>
              <div>
                <span>角色数量</span>
                <strong>{selectedMemberDetail.item.roleCodes.length}</strong>
              </div>
              <div>
                <span>状态操作</span>
                <strong>
                  {!canEditSelectedMember
                    ? "本人受限"
                    : selectedMemberDetail.item.status === "active"
                      ? "可停用"
                      : "可恢复"}
                </strong>
              </div>
              <div>
                <span>删除权限</span>
                <strong>
                  canEditSelectedMember && selectedMemberDetail.item.status !== "active" ? "可删除" : "受限"
                </strong>
              </div>
              <div>
                <span>密码操作</span>
                <strong>
                  canEditSelectedMember && selectedMemberDetail.item.status !== "disabled" ? "可设置" : "受限"
                </strong>
              </div>
              <div>
                <span>角色编辑</span>
                <strong>{canEditSelectedMember ? "可编辑" : "本人受限"}</strong>
              </div>
            </div>

            <div className="detail-grid">
              <div>
                <span>显示名</span>
                <strong>{selectedMemberDetail.item.displayName || selectedMemberDetail.item.user.displayName || "-"}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{formatMemberStatus(selectedMemberDetail.item.status)}</strong>
              </div>
              <div>
                <span>邮箱</span>
                <strong>{selectedMemberDetail.item.user.email || "-"}</strong>
              </div>
              <div>
                <span>最近登录</span>
                <strong>{formatDateTime(selectedMemberDetail.item.user.lastLoginAt)}</strong>
              </div>
              <div>
                <span>加入租户</span>
                <strong>{formatDateTime(selectedMemberDetail.item.joinedAt)}</strong>
              </div>
              <div>
                <span>账号创建</span>
                <strong>{formatDateTime(selectedMemberDetail.item.user.createdAt)}</strong>
              </div>
              <div>
                <span>账号更新</span>
                <strong>{formatDateTime(selectedMemberDetail.item.user.updatedAt)}</strong>
              </div>
            </div>

            <div className="panel-header compact">
              <h3>当前角色</h3>
              <span>{selectedMemberDetail.item.roles.length} 项</span>
            </div>
            <div className="transaction-list">
              {selectedMemberDetail.item.roles.map((role) => (
                <div key={role.id} className="transaction-row">
                  <div>
                    <strong>{role.name}</strong>
                    <span>{role.code} · {role.scope}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-header compact">
              <h3>成员状态</h3>
              <span>{canUpdateSelectedStatus ? "可编辑" : "当前阶段限制"}</span>
            </div>
            <div className="adjustment-form">
              {!canEditSelectedMember ? (
                <p className="warning-text">当前选中成员就是你自己。为避免误锁后台权限，这一阶段禁止本人自改成员状态。</p>
              ) : null}
              {selectedMemberDetail.item.status === "invited" ? (
                <p className="muted">当前阶段支持将 invited 成员激活为 active，但不支持直接停用 invited 成员。</p>
              ) : null}
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={
                    !canUpdateSelectedStatus ||
                    updatingStatus ||
                    selectedMemberDetail.item.status === "disabled" ||
                    selectedMemberDetail.item.status === "invited"
                  }
                  onClick={() => onUpdateStatus("disabled")}
                >
                  {updatingStatus && selectedMemberDetail.item.status !== "disabled" ? "提交中..." : "停用成员"}
                </button>
                <button
                  type="button"
                  className="inline-action"
                  disabled={!canUpdateSelectedStatus || updatingStatus || selectedMemberDetail.item.status === "active"}
                  onClick={() => onUpdateStatus("active")}
                >
                  {selectedMemberDetail.item.status === "invited" ? "激活成员" : "恢复成员"}
                </button>
              </div>
            </div>

            <div className="panel-header compact">
              <h3>成员密码</h3>
              <span>{canEditSelectedMember ? "可设置" : "当前阶段限制"}</span>
            </div>
            <div className="adjustment-form">
              {!canEditSelectedMember ? (
                <p className="warning-text">当前阶段禁止给自己直接改密码，请选择其他成员。</p>
              ) : null}
              {selectedMemberDetail.item.status === "disabled" ? (
                <p className="muted">disabled 成员当前阶段不支持直接设置密码，请先恢复成员状态。</p>
              ) : null}
              <label>
                <span>新密码</span>
                <input
                  type="password"
                  value={passwordDraft}
                  onChange={(event) => setPasswordDraft(event.target.value)}
                  placeholder="至少 8 位"
                />
              </label>
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={
                    !canEditSelectedMember ||
                    updatingPassword ||
                    selectedMemberDetail.item.status === "disabled" ||
                    passwordDraft.trim().length < 8
                  }
                  onClick={() => onUpdatePassword(passwordDraft.trim())}
                >
                  {updatingPassword ? "提交中..." : "设置新密码"}
                </button>
                <span className="muted">当前阶段只支持后台直接设置新密码，不做邮件或短信重置。</span>
              </div>
            </div>

            <div className="panel-header compact">
              <h3>成员删除</h3>
              <span>{canEditSelectedMember ? "受限开放" : "当前阶段限制"}</span>
            </div>
            <div className="adjustment-form">
              {!canEditSelectedMember ? (
                <p className="warning-text">当前阶段禁止删除自己，请选择其他成员。</p>
              ) : null}
              <p className="muted">当前阶段只允许删除 invited 或 disabled 成员，不支持直接删除 active 成员。</p>
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={!canEditSelectedMember || deletingMember || selectedMemberDetail.item.status === "active"}
                  onClick={onDeleteMember}
                >
                  {deletingMember ? "提交中..." : "删除成员"}
                </button>
              </div>
            </div>

            <div className="panel-header compact">
              <h3>角色分配</h3>
              <span>{canEditSelectedMember ? "可编辑" : "当前阶段禁止修改本人角色"}</span>
            </div>
            <div className="adjustment-form">
              {!canEditSelectedMember ? (
                <p className="warning-text">
                  当前选中成员就是你自己。为避免误锁后台权限，这一阶段禁止本人自改角色。
                </p>
              ) : null}
              {isOnlyMember ? (
                <p className="muted">
                  当前租户只有 1 个成员，暂时无法在不新增成员的前提下完整演练后台角色分配。
                </p>
              ) : null}
              <div className="detail-grid">
                <div>
                  <span>当前角色</span>
                  <strong>{formatRolePreview(selectedMemberDetail.item.roleCodes, roles)}</strong>
                </div>
                <div>
                  <span>保存后角色</span>
                  <strong>{formatRolePreview(draftRoleCodes, roles)}</strong>
                </div>
              </div>
              <div className="admin-role-grid">
                {roles.map((role) => {
                  const checked = draftRoleCodes.includes(role.code);
                  return (
                    <label key={role.id} className="admin-role-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEditSelectedMember || updatingRoles}
                        onChange={() => toggleRole(role.code)}
                      />
                      <div>
                        <strong>{role.name}</strong>
                        <span>{role.code} · {role.scope}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={!canEditSelectedMember || updatingRoles || draftRoleCodes.length === 0}
                  onClick={() => onUpdateRoles(draftRoleCodes)}
                >
                  {updatingRoles ? "提交中..." : "保存角色分配"}
                </button>
                <span className="muted">
                  仍受后端保护限制：不能修改本人角色，也不能移除最后一个 tenant owner。
                </span>
              </div>
            </div>

            <div className="panel-header compact">
              <h3>最近成员审计</h3>
              <span>{filteredMemberAudits.length} / {selectedMemberDetail.recentAudits.length} 条</span>
            </div>
            <div className="student-filters">
              <label>
                <span>关键词</span>
                <input
                  value={memberAuditSearch}
                  onChange={(event) => setMemberAuditSearch(event.target.value)}
                  placeholder="按操作者/动作/摘要筛选"
                />
              </label>
              <label>
                <span>开始日期</span>
                <input type="date" value={memberAuditDateFrom} onChange={(event) => setMemberAuditDateFrom(event.target.value)} />
              </label>
              <label>
                <span>结束日期</span>
                <input type="date" value={memberAuditDateTo} onChange={(event) => setMemberAuditDateTo(event.target.value)} />
              </label>
            </div>
            <div className="transaction-list">
              {filteredMemberAudits.length ? (
                filteredMemberAudits.map((audit) => (
                  <div key={audit.id} className="transaction-row">
                    <div>
                      <strong>{audit.actorUser?.displayName || audit.actorUser?.username || audit.actorUserId || "系统"}</strong>
                      <span>{adminAuditActionLabels[audit.action] || audit.action} · {formatAdminAuditSummary(audit)}</span>
                    </div>
                    <b>{formatDateTime(audit.createdAt)}</b>
                  </div>
                ))
              ) : (
                <p className="muted">{selectedMemberDetail.recentAudits.length ? "当前筛选条件下没有匹配的成员审计" : "该成员暂无后台审计"}</p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">请选择左侧成员查看详情</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>角色与审计</h2>
          <span>{roles.length} 个角色</span>
        </div>

        <div className="panel-header compact">
          <h3>租户角色</h3>
          <span>{roles.length} 项</span>
        </div>
        <div className="transaction-list">
          {roles.map((role) => (
            <div key={role.id} className="transaction-row">
              <div>
                <strong>{role.name}</strong>
                <span>{role.code} · {role.scope}</span>
              </div>
              <b>{role.assignedMembershipCount}</b>
            </div>
          ))}
        </div>

        <div className="panel-header compact">
          <h3>最近后台审计</h3>
          <span>{selectedMemberDetail ? `当前成员 ${filteredTenantAudits.length} / ${audits.length} 条` : `${filteredTenantAudits.length} / ${audits.length} 条`}</span>
        </div>
        <div className="student-filters">
          <label>
            <span>审计动作</span>
            <select
              value={auditAction}
              onChange={(event) =>
                onAuditActionChange(
                  event.target.value as
                    | ""
                    | "membership.roles.update"
                    | "membership.status.disable"
                    | "membership.status.enable"
                    | "membership.invite.create"
                    | "membership.password.set"
                    | "membership.delete"
                )
              }
            >
              <option value="">全部动作</option>
              <option value="membership.roles.update">角色调整</option>
              <option value="membership.status.disable">停用成员</option>
              <option value="membership.status.enable">恢复成员</option>
              <option value="membership.invite.create">创建邀请</option>
              <option value="membership.password.set">设置密码</option>
              <option value="membership.delete">删除成员</option>
            </select>
          </label>
          <label>
            <span>关键词</span>
            <input value={tenantAuditSearch} onChange={(event) => setTenantAuditSearch(event.target.value)} placeholder="按操作者/动作/摘要筛选" />
          </label>
          <label>
            <span>开始日期</span>
            <input type="date" value={tenantAuditDateFrom} onChange={(event) => setTenantAuditDateFrom(event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={tenantAuditDateTo} onChange={(event) => setTenantAuditDateTo(event.target.value)} />
          </label>
        </div>
        {selectedMemberDetail ? (
          <p className="muted">
            当前只展示成员 {selectedMemberDetail.item.user.username} 的后台审计记录。
          </p>
        ) : null}
        <div className="attendance-summary-strip">
          <div>
            <span>角色调整</span>
            <strong>{tenantAuditSummary.roles}</strong>
          </div>
          <div>
            <span>状态变更</span>
            <strong>{tenantAuditSummary.status}</strong>
          </div>
          <div>
            <span>成员邀请</span>
            <strong>{tenantAuditSummary.invite}</strong>
          </div>
          <div>
            <span>密码设置</span>
            <strong>{tenantAuditSummary.password}</strong>
          </div>
          <div>
            <span>成员删除</span>
            <strong>{tenantAuditSummary.delete}</strong>
          </div>
        </div>
        <div className="transaction-list">
          {filteredTenantAudits.length ? (
            filteredTenantAudits.map((audit) => (
              <div key={audit.id} className="transaction-row">
                <div>
                  <strong>{audit.actorUser?.displayName || audit.actorUser?.username || audit.actorUserId || "系统"}</strong>
                  <span>{adminAuditActionLabels[audit.action] || audit.action} · {formatAdminAuditSummary(audit)}</span>
                </div>
                <b>{formatDateTime(audit.createdAt)}</b>
              </div>
            ))
          ) : (
            <p className="muted">{audits.length ? "当前筛选条件下没有匹配的后台审计记录" : selectedMemberDetail ? "该成员暂无后台审计记录" : "当前暂无后台审计记录"}</p>
          )}
        </div>
      </section>
    </section>
  );
}
