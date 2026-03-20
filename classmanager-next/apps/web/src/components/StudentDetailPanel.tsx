import { useEffect, useState } from "react";

import { getStudentStatusLabel, isStudentDailyParticipant } from "../lib/studentStatus";
import type { SettingsOverview, StudentDetail, StudentItem, StudentStatusOptionItem } from "../types";

function formatOrganizationName(value: string, items: Array<{ id: string; name: string }>) {
  if (!value) return "未设置";
  return items.find((item) => item.id === value)?.name || "未设置";
}

function formatPositionNames(value: string[], items: Array<{ id: string; name: string }>) {
  if (!value.length) return "未设置";
  return value.map((id) => items.find((item) => item.id === id)?.name || id).join(" / ");
}

type AvatarDraftKey = "avatarHappyData" | "avatarNormalData" | "avatarSadData";

const avatarFieldItems: Array<{ key: AvatarDraftKey; label: string }> = [
  { key: "avatarHappyData", label: "笑脸头像" },
  { key: "avatarNormalData", label: "普通头像" },
  { key: "avatarSadData", label: "鬼脸头像" }
];

function compressAvatarFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("读取头像文件失败"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("读取头像文件失败"));
        return;
      }

      const image = new Image();
      image.onerror = () => reject(new Error("解析头像图片失败"));
      image.onload = () => {
        const maxSide = 150;
        const scale = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
        const width = Math.max(1, Math.round((image.width || 1) * scale));
        const height = Math.max(1, Math.round((image.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("当前浏览器不支持头像压缩"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

type StudentDetailPanelProps = {
  selectedStudent: StudentItem | null;
  studentDetail: StudentDetail | null;
  settings: SettingsOverview | null;
  adjusting: boolean;
  updatingStudent: boolean;
  updatingStudentProfile: boolean;
  updatingStudentOrganization: boolean;
  deletingStudent: boolean;
  lastAdjustmentMessage: string;
  lastStudentUpdateMessage: string;
  lastStudentProfileMessage: string;
  lastStudentOrganizationMessage: string;
  revertingTransactionId: string;
  canManagePoints: boolean;
  classFrozen: boolean;
  statusOptions: StudentStatusOptionItem[];
  onAdjust: (input: {
    studentId: string;
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }) => Promise<void>;
  onRevert: (transactionId: string) => Promise<void>;
  onUpdateStudent: (input: {
    studentNo: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder: number;
  }) => Promise<void>;
  onUpdateStudentProfile: (input: {
    titleLeft?: string | null;
    titleRight?: string | null;
    notes?: string | null;
    avatarHappyData?: string | null;
    avatarNormalData?: string | null;
    avatarSadData?: string | null;
  }) => Promise<void>;
  onUpdateStudentOrganization: (input: {
    groupId?: string | null;
    dormitoryId?: string | null;
    positionIds?: string[];
  }) => Promise<void>;
  onDeleteStudent: () => Promise<void>;
};

export function StudentDetailPanel(props: StudentDetailPanelProps) {
  const {
    selectedStudent,
    studentDetail,
    settings,
    adjusting,
    updatingStudent,
    updatingStudentProfile,
    updatingStudentOrganization,
    deletingStudent,
    lastAdjustmentMessage,
    lastStudentUpdateMessage,
    lastStudentProfileMessage,
    lastStudentOrganizationMessage,
    revertingTransactionId,
    canManagePoints,
    classFrozen,
    statusOptions,
    onAdjust,
    onRevert,
    onUpdateStudent,
    onUpdateStudentProfile,
    onUpdateStudentOrganization,
    onDeleteStudent
  } = props;
  const reasonTemplates = (settings?.reasonTemplates || []).filter((item) => item.isActive);
  const availableGroups = (settings?.groups || []).filter((item) => item.isActive);
  const availableDormitories = (settings?.dormitories || []).filter((item) => item.isActive);
  const availablePositions = (settings?.positions || []).filter((item) => item.isActive);
  const [formError, setFormError] = useState("");
  const [studentFormError, setStudentFormError] = useState("");
  const [profileFormError, setProfileFormError] = useState("");
  const [organizationFormError, setOrganizationFormError] = useState("");
  const [studentNoDraft, setStudentNoDraft] = useState("");
  const [studentNameDraft, setStudentNameDraft] = useState("");
  const [studentGenderDraft, setStudentGenderDraft] = useState("");
  const [studentStatusDraft, setStudentStatusDraft] = useState("");
  const [studentSortOrderDraft, setStudentSortOrderDraft] = useState("0");
  const [titleLeftDraft, setTitleLeftDraft] = useState("");
  const [titleRightDraft, setTitleRightDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [avatarHappyDraft, setAvatarHappyDraft] = useState("");
  const [avatarNormalDraft, setAvatarNormalDraft] = useState("");
  const [avatarSadDraft, setAvatarSadDraft] = useState("");
  const [groupIdDraft, setGroupIdDraft] = useState("");
  const [dormitoryIdDraft, setDormitoryIdDraft] = useState("");
  const [positionIdsDraft, setPositionIdsDraft] = useState<string[]>([]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"" | "bonus" | "penalty">("");
  const [transactionRevertFilter, setTransactionRevertFilter] = useState<"" | "reverted" | "active">("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionDateFrom, setTransactionDateFrom] = useState("");
  const [transactionDateTo, setTransactionDateTo] = useState("");

  useEffect(() => {
    setStudentNoDraft(studentDetail?.student.studentNo || "");
    setStudentNameDraft(studentDetail?.student.name || "");
    setStudentGenderDraft(studentDetail?.student.gender || "");
    setStudentStatusDraft(studentDetail?.student.status || "active");
    setStudentSortOrderDraft(String(studentDetail?.student.sortOrder ?? 0));
    setStudentFormError("");
    setTitleLeftDraft(studentDetail?.student.profile?.titleLeft || "");
    setTitleRightDraft(studentDetail?.student.profile?.titleRight || "");
    setNotesDraft(studentDetail?.student.profile?.notes || "");
    setAvatarHappyDraft(studentDetail?.student.profile?.avatarHappyData || "");
    setAvatarNormalDraft(studentDetail?.student.profile?.avatarNormalData || "");
    setAvatarSadDraft(studentDetail?.student.profile?.avatarSadData || "");
    setProfileFormError("");
    setGroupIdDraft(studentDetail?.student.groups[0]?.group.id || "");
    setDormitoryIdDraft(studentDetail?.student.dorms[0]?.dormitory.id || "");
    setPositionIdsDraft(studentDetail?.student.positions.map((item) => item.position.id) || []);
    setOrganizationFormError("");
  }, [studentDetail]);

  const togglePositionSelection = (positionId: string) => {
    setPositionIdsDraft((current) =>
      current.includes(positionId) ? current.filter((item) => item !== positionId) : [...current, positionId]
    );
  };
  const matchesDateRange = (value: string, dateFrom: string, dateTo: string) => {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  };
  const filteredRecentTransactions = (studentDetail?.recentTransactions || []).filter((item) => {
    const matchesType = !transactionTypeFilter || item.transactionType === transactionTypeFilter;
    const matchesRevert =
      !transactionRevertFilter || (transactionRevertFilter === "reverted" ? item.isReverted : !item.isReverted);
    const keyword = transactionSearch.trim();
    const matchesSearch =
      !keyword ||
      [item.reason, item.scene, item.category, item.sourceModule || "", item.value].some((value) => value.includes(keyword));
    const matchesDate = matchesDateRange(item.occurredAt, transactionDateFrom, transactionDateTo);
    return matchesType && matchesRevert && matchesSearch && matchesDate;
  });
  const filteredTransactionSummary = filteredRecentTransactions.reduce(
    (totals, item) => {
      if (item.transactionType === "bonus") totals.bonus += 1;
      if (item.transactionType === "penalty") totals.penalty += 1;
      if (item.isReverted) totals.reverted += 1;
      return totals;
    },
    { bonus: 0, penalty: 0, reverted: 0 }
  );
  const currentStudentStatusLabel = getStudentStatusLabel(studentDetail?.student.status || "", statusOptions);
  const currentStudentDailyParticipation = isStudentDailyParticipant(studentDetail?.student.status || "", statusOptions);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentDetail) return;
    const form = new FormData(event.currentTarget);
    const transactionType = String(form.get("transactionType") || "bonus") as "bonus" | "penalty";
    const value = Number(form.get("value") || 0);
    const reason = String(form.get("reason") || "").trim();
    const scene = String(form.get("scene") || "班级").trim();
    const category = String(form.get("category") || "班务").trim();
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("分值必须大于 0");
      return;
    }
    if (!reason) {
      setFormError("理由不能为空");
      return;
    }
    if (!scene) {
      setFormError("场景不能为空");
      return;
    }
    if (!category) {
      setFormError("类别不能为空");
      return;
    }
    const currentBalance = Number(studentDetail.student.account?.balancePoints ?? 0);
    const nextBalance = transactionType === "penalty" ? currentBalance - value : currentBalance + value;
    const confirmed = window.confirm(
      `确认对 ${studentDetail.student.name}${transactionType === "penalty" ? "扣除" : "增加"} ${value} 分？\n类型：${
        transactionType === "penalty" ? "扣分" : "加分"
      }\n理由：${reason}\n场景：${scene} · ${category}\n当前余额：${currentBalance}\n提交后余额：${nextBalance}`
    );
    if (!confirmed) return;
    setFormError("");
    await onAdjust({
      studentId: studentDetail.student.id,
      transactionType,
      value,
      reason,
      scene,
      category
    });
    event.currentTarget.reset();
  }

  function handleReasonTemplateChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const form = event.currentTarget.form;
    if (!form || !value) return;
    const template = reasonTemplates.find((item) => item.id === value);
    if (!template) return;
    const reasonInput = form.elements.namedItem("reason") as HTMLInputElement | null;
    const sceneInput = form.elements.namedItem("scene") as HTMLInputElement | null;
    const categoryInput = form.elements.namedItem("category") as HTMLInputElement | null;
    const valueInput = form.elements.namedItem("value") as HTMLInputElement | null;
    const typeSelect = form.elements.namedItem("transactionType") as HTMLSelectElement | null;
    if (reasonInput) reasonInput.value = template.name;
    if (sceneInput) sceneInput.value = template.scene;
    if (categoryInput) categoryInput.value = template.category;
    if (valueInput) valueInput.value = String(Math.abs(Number(template.value)));
    if (typeSelect) typeSelect.value = template.transactionType === "penalty" ? "penalty" : "bonus";
  }

  async function handleRevertClick(
    transactionId: string,
    reason: string,
    value: string,
    transactionType: string,
    occurredAt: string,
    scene: string,
    category: string,
    sourceModule: string | null
  ) {
    const actionLabel = transactionType === "penalty" ? "扣分" : "加分";
    const numericValue = Number(value);
    const displayValue = Number.isFinite(numericValue) ? String(Math.abs(numericValue)) : value.replace(/^-/, "");
    const confirmed = window.confirm(
      `确认撤销这笔手工积分调整？\n学生：${studentDetail?.student.name || "-"}\n类型：${actionLabel}\n分值：${displayValue}\n理由：${reason}\n场景：${scene} · ${category}\n来源：${
        sourceModule || "-"
      }\n发生时间：${new Date(occurredAt).toLocaleString("zh-CN")}\n这会回退这笔调整对应的账户分值。`
    );
    if (!confirmed) return;
    setFormError("");
    await onRevert(transactionId);
  }

  async function handleUpdateStudentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentDetail) return;
    const trimmedName = studentNameDraft.trim();
    const trimmedStudentNo = studentNoDraft.trim();
    const trimmedGender = studentGenderDraft.trim();
    const trimmedStatus = studentStatusDraft.trim();
    const sortOrder = Number(studentSortOrderDraft);

    if (!trimmedName) {
      setStudentFormError("姓名不能为空");
      return;
    }
    if (!trimmedStatus) {
      setStudentFormError("状态不能为空");
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setStudentFormError("排序必须是大于等于 0 的整数");
      return;
    }

    const confirmed = window.confirm(`确认保存 ${studentDetail.student.name} 的基础资料修改？`);
    if (!confirmed) return;

    setStudentFormError("");
    await onUpdateStudent({
      studentNo: trimmedStudentNo || null,
      name: trimmedName,
      gender: trimmedGender || null,
      status: trimmedStatus,
      sortOrder
    });
  }

  async function handleUpdateStudentOrganizationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentDetail) return;
    const confirmed = window.confirm(`确认更新 ${studentDetail.student.name} 的组织归属与岗位？`);
    if (!confirmed) return;
    setOrganizationFormError("");
    await onUpdateStudentOrganization({
      groupId: groupIdDraft || null,
      dormitoryId: dormitoryIdDraft || null,
      positionIds: positionIdsDraft
    });
  }

  async function handleUpdateStudentProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentDetail) return;
    const trimmedTitleLeft = titleLeftDraft.trim();
    const trimmedTitleRight = titleRightDraft.trim();
    const trimmedNotes = notesDraft.trim();
    const confirmed = window.confirm(`确认保存 ${studentDetail.student.name} 的档案资料修改？`);
    if (!confirmed) return;
    setProfileFormError("");
    await onUpdateStudentProfile({
      titleLeft: trimmedTitleLeft || null,
      titleRight: trimmedTitleRight || null,
      notes: trimmedNotes || null,
      avatarHappyData: avatarHappyDraft || null,
      avatarNormalData: avatarNormalDraft || null,
      avatarSadData: avatarSadDraft || null
    });
  }

  function updateAvatarDraft(key: AvatarDraftKey, value: string) {
    if (key === "avatarHappyData") {
      setAvatarHappyDraft(value);
      return;
    }
    if (key === "avatarNormalData") {
      setAvatarNormalDraft(value);
      return;
    }
    setAvatarSadDraft(value);
  }

  async function handleAvatarFileChange(key: AvatarDraftKey, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      updateAvatarDraft(key, dataUrl);
      setProfileFormError("");
    } catch (error) {
      setProfileFormError(error instanceof Error ? error.message : "处理头像文件失败");
    }
  }

  function handleClearAvatar(key: AvatarDraftKey) {
    updateAvatarDraft(key, "");
    setProfileFormError("");
  }

  const avatarDraftMap: Record<AvatarDraftKey, string> = {
    avatarHappyData: avatarHappyDraft,
    avatarNormalData: avatarNormalDraft,
    avatarSadData: avatarSadDraft
  };

  return (
    <article className="panel detail-panel">
      <div className="panel-header">
        <h2>学生详情</h2>
        <span>{selectedStudent?.name ?? "未选择"}</span>
      </div>

      {studentDetail ? (
        <>
          <div className="detail-grid">
            <div>
              <span>总积分</span>
              <strong>{studentDetail.student.account?.totalPoints ?? "0"}</strong>
            </div>
            <div>
              <span>余额</span>
              <strong>{studentDetail.student.account?.balancePoints ?? "0"}</strong>
            </div>
            <div>
              <span>主小组</span>
              <strong>{studentDetail.student.groups[0]?.group.name ?? "-"}</strong>
            </div>
            <div>
              <span>宿舍</span>
              <strong>{studentDetail.student.dorms[0]?.dormitory.name ?? "-"}</strong>
            </div>
            <div>
              <span>岗位</span>
              <strong>
                {studentDetail.student.positions.length
                  ? studentDetail.student.positions.map((item) => item.position.name).join(" / ")
                  : "-"}
              </strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{currentStudentStatusLabel}</strong>
            </div>
            <div>
              <span>左称号</span>
              <strong>{studentDetail.student.profile?.titleLeft ?? "-"}</strong>
            </div>
            <div>
              <span>右称号</span>
              <strong>{studentDetail.student.profile?.titleRight ?? "-"}</strong>
            </div>
          </div>

          <div className="transaction-list">
            <form className="adjustment-form" onSubmit={handleUpdateStudentSubmit}>
              <div className="panel-header compact">
                <h3>基础资料编辑</h3>
                <span>{updatingStudent ? "保存中" : "写入新系统"}</span>
              </div>
              <div className="student-filters">
                <label>
                  <span>姓名</span>
                  <input
                    type="text"
                    value={studentNameDraft}
                    onChange={(event) => setStudentNameDraft(event.target.value)}
                  />
                </label>
                <label>
                  <span>学号</span>
                  <input
                    type="text"
                    value={studentNoDraft}
                    onChange={(event) => setStudentNoDraft(event.target.value)}
                    placeholder="可留空"
                  />
                </label>
                <label>
                  <span>性别</span>
                  <input
                    type="text"
                    value={studentGenderDraft}
                    onChange={(event) => setStudentGenderDraft(event.target.value)}
                    placeholder="可留空"
                  />
                </label>
                <label>
                  <span>状态</span>
                  <select
                    value={studentStatusDraft}
                    onChange={(event) => setStudentStatusDraft(event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={studentSortOrderDraft}
                    onChange={(event) => setStudentSortOrderDraft(event.target.value)}
                  />
                </label>
              </div>
              <p className="muted">
                当前状态“{currentStudentStatusLabel}”
                {currentStudentDailyParticipation ? "会默认参与" : "不会默认参与"}
                日常点名、作业与全班生成。
                {canManagePoints ? "" : " 当前登录成员没有学生资料写权限。"}
                {classFrozen ? " 当前班级已冻结，学生资料写操作已暂停。" : ""}
              </p>
              {studentFormError ? <p className="warning-text">{studentFormError}</p> : null}
              {lastStudentUpdateMessage ? <p className="success-text">{lastStudentUpdateMessage}</p> : null}
              <button
                type="submit"
                disabled={updatingStudent || !studentDetail || !canManagePoints || classFrozen}
                className="adjustment-submit"
              >
                {updatingStudent ? "保存中..." : "保存学生资料"}
              </button>
            </form>

            <form className="adjustment-form" onSubmit={handleUpdateStudentProfileSubmit}>
              <div className="panel-header compact">
                <h3>档案资料</h3>
                <span>{updatingStudentProfile ? "保存中" : "写入新系统"}</span>
              </div>
              <div className="student-filters">
                <label>
                  <span>左称号</span>
                  <input
                    type="text"
                    value={titleLeftDraft}
                    onChange={(event) => setTitleLeftDraft(event.target.value)}
                    placeholder="例如：纪律标兵"
                  />
                </label>
                <label>
                  <span>右称号</span>
                  <input
                    type="text"
                    value={titleRightDraft}
                    onChange={(event) => setTitleRightDraft(event.target.value)}
                    placeholder="例如：进步之星"
                  />
                </label>
              </div>
              <label>
                <span>备注</span>
                <textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="补充学生档案备注"
                />
              </label>
              <div className="avatar-grid">
                {avatarFieldItems.map((item) => {
                  const value = avatarDraftMap[item.key];
                  return (
                    <div key={item.key} className="avatar-card">
                      <span>{item.label}</span>
                      {value ? (
                        <img
                          src={value}
                          alt={`${studentDetail.student.name}${item.label}`}
                          className="avatar-preview"
                        />
                      ) : (
                        <div className="avatar-placeholder">未设置</div>
                      )}
                      <div className="avatar-actions">
                        <label className="inline-action-button">
                          上传图片
                          <input
                            type="file"
                            accept="image/*"
                            className="avatar-file-input"
                            disabled={updatingStudentProfile || !canManagePoints || classFrozen}
                            onChange={(event) => void handleAvatarFileChange(item.key, event.currentTarget)}
                          />
                        </label>
                        <button
                          type="button"
                          className="inline-action"
                          disabled={!value || updatingStudentProfile || !canManagePoints || classFrozen}
                          onClick={() => handleClearAvatar(item.key)}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="muted">
                当前用于承接旧系统学生称号、备注和头像资料。
                {canManagePoints ? "" : " 当前登录成员没有学生档案写权限。"}
                {classFrozen ? " 当前班级已冻结，学生档案写操作已暂停。" : ""}
              </p>
              {studentDetail.student.profile?.legacyAvatarPending ? (
                <p className="warning-text">旧系统检测到头像数据，但当前库里还没回填；重新迁移后会自动补齐。</p>
              ) : null}
              {profileFormError ? <p className="warning-text">{profileFormError}</p> : null}
              {lastStudentProfileMessage ? <p className="success-text">{lastStudentProfileMessage}</p> : null}
              <button
                type="submit"
                disabled={updatingStudentProfile || !studentDetail || !canManagePoints || classFrozen}
                className="adjustment-submit"
              >
                {updatingStudentProfile ? "保存中..." : "保存档案资料"}
              </button>
            </form>

            <form className="adjustment-form" onSubmit={handleUpdateStudentOrganizationSubmit}>
              <div className="panel-header compact">
                <h3>组织归属调整</h3>
                <span>{updatingStudentOrganization ? "保存中" : "写入新系统"}</span>
              </div>
              <div className="detail-grid">
                <div>
                  <span>当前主小组</span>
                  <strong>{studentDetail.student.groups[0]?.group.name ?? "未设置"}</strong>
                </div>
                <div>
                  <span>保存后主小组</span>
                  <strong>{formatOrganizationName(groupIdDraft, availableGroups)}</strong>
                </div>
                <div>
                  <span>当前主宿舍</span>
                  <strong>{studentDetail.student.dorms[0]?.dormitory.name ?? "未设置"}</strong>
                </div>
                <div>
                  <span>保存后主宿舍</span>
                  <strong>{formatOrganizationName(dormitoryIdDraft, availableDormitories)}</strong>
                </div>
                <div>
                  <span>当前岗位</span>
                  <strong>{formatPositionNames(studentDetail.student.positions.map((item) => item.position.id), availablePositions)}</strong>
                </div>
                <div>
                  <span>保存后岗位</span>
                  <strong>{formatPositionNames(positionIdsDraft, availablePositions)}</strong>
                </div>
              </div>
              <div className="student-filters">
                <label>
                  <span>主小组</span>
                  <select value={groupIdDraft} onChange={(event) => setGroupIdDraft(event.target.value)}>
                    <option value="">不分组</option>
                    {availableGroups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>主宿舍</span>
                  <select value={dormitoryIdDraft} onChange={(event) => setDormitoryIdDraft(event.target.value)}>
                    <option value="">不分宿舍</option>
                    {availableDormitories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="attendance-batch-toolbar">
                <span>岗位</span>
                <div className="attendance-missing-list">
                  {availablePositions.length ? (
                    availablePositions.map((item) => (
                      <label key={item.id} className="selection-toggle">
                        <input
                          type="checkbox"
                          checked={positionIdsDraft.includes(item.id)}
                          onChange={() => togglePositionSelection(item.id)}
                          disabled={updatingStudentOrganization || !canManagePoints || classFrozen}
                        />
                        <span>
                          {item.name} · {item.category}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="muted">暂无启用岗位</p>
                  )}
                </div>
              </div>
              <p className="muted">
                当前只开放主小组、主宿舍与岗位调整，不做批量组织调整。
                {canManagePoints ? "" : " 当前登录成员没有组织归属写权限。"}
                {classFrozen ? " 当前班级已冻结，组织归属写操作已暂停。" : ""}
              </p>
              {organizationFormError ? <p className="warning-text">{organizationFormError}</p> : null}
              {lastStudentOrganizationMessage ? <p className="success-text">{lastStudentOrganizationMessage}</p> : null}
              <button
                type="submit"
                disabled={updatingStudentOrganization || !studentDetail || !canManagePoints || classFrozen}
                className="adjustment-submit"
              >
                {updatingStudentOrganization ? "保存中..." : "保存组织归属"}
              </button>
            </form>

            <div className="adjustment-form">
              <div className="panel-header compact">
                <h3>删除学生</h3>
                <span>
                  {deletingStudent
                    ? "删除中"
                    : studentDetail.deleteGuard.canDelete
                      ? "允许删除"
                      : "当前不可删"}
                </span>
              </div>
              <p className="muted">
                仅建议删除没有积分/考勤历史的空白学生；已有历史时请优先改为归档而不是物理删除。
                删除前会尽量自动清理低风险配置和兼容运行态引用，仍涉及历史归档数据时会继续拦截。
                {canManagePoints ? "" : " 当前登录成员没有学生删除权限。"}
                {classFrozen ? " 当前班级已冻结，学生删除已暂停。" : ""}
              </p>
              {studentDetail.deleteGuard.cleanupMessages.length ? (
                <p className="muted">删除时会自动清理：{studentDetail.deleteGuard.cleanupMessages.join("、")}。</p>
              ) : null}
              {studentDetail.deleteGuard.blockers.length ? (
                <div className="transaction-list">
                  {studentDetail.deleteGuard.blockers.map((item) => (
                    <p key={item} className="warning-text">
                      {item}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="success-text">当前学生没有阻塞删除的历史记录或高风险兼容引用，可执行物理删除。</p>
              )}
              <button
                type="button"
                className="inline-action-button"
                disabled={deletingStudent || !studentDetail.deleteGuard.canDelete || !canManagePoints || classFrozen}
                onClick={() => void onDeleteStudent()}
              >
                {deletingStudent ? "删除中..." : "删除学生"}
              </button>
            </div>

            <form className="adjustment-form" onSubmit={handleSubmit}>
              <div className="panel-header compact">
                <h3>单人加减分</h3>
                <span>{adjusting ? "提交中" : "写入新系统"}</span>
              </div>
              <div className="student-filters">
                <label>
                  <span>预设理由</span>
                  <select name="reasonTemplateId" defaultValue="" onChange={handleReasonTemplateChange}>
                    <option value="">手动填写</option>
                    {reasonTemplates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.scene}/{item.category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>类型</span>
                  <select name="transactionType" defaultValue="bonus">
                    <option value="bonus">加分</option>
                    <option value="penalty">扣分</option>
                  </select>
                </label>
                <label>
                  <span>分值</span>
                  <input name="value" type="number" step="0.5" min="0.5" defaultValue="1" />
                </label>
                <label>
                  <span>理由</span>
                  <input name="reason" type="text" placeholder="例如：课堂表现" />
                </label>
                <label>
                  <span>场景</span>
                  <input name="scene" type="text" defaultValue="班级" />
                </label>
                <label>
                  <span>类别</span>
                  <input name="category" type="text" defaultValue="班务" />
                </label>
              </div>
              <p className="muted">
                提交和撤销都会写入审计日志，当前仅作用于新系统隔离数据库。
                {canManagePoints ? "" : " 当前登录成员没有积分写权限。"}
                {classFrozen ? " 当前班级已冻结，积分写操作已暂停。" : ""}
              </p>
              {formError ? <p className="warning-text">{formError}</p> : null}
              {lastAdjustmentMessage ? <p className="success-text">{lastAdjustmentMessage}</p> : null}
              <button
                type="submit"
                disabled={adjusting || !studentDetail || !canManagePoints || classFrozen}
                className="adjustment-submit"
              >
                {adjusting ? "提交中..." : "提交积分调整"}
              </button>
            </form>

            <div className="panel-header compact">
              <h3>最近积分记录</h3>
              <span>{filteredRecentTransactions.length} / {studentDetail.recentTransactions.length} 条</span>
            </div>
            <div className="student-filters">
              <label>
                <span>记录类型</span>
                <select value={transactionTypeFilter} onChange={(event) => setTransactionTypeFilter(event.target.value as "" | "bonus" | "penalty")}>
                  <option value="">全部</option>
                  <option value="bonus">加分</option>
                  <option value="penalty">扣分</option>
                </select>
              </label>
              <label>
                <span>撤销状态</span>
                <select
                  value={transactionRevertFilter}
                  onChange={(event) => setTransactionRevertFilter(event.target.value as "" | "reverted" | "active")}
                >
                  <option value="">全部</option>
                  <option value="active">未撤销</option>
                  <option value="reverted">已撤销</option>
                </select>
              </label>
              <label>
                <span>关键词</span>
                <input
                  type="text"
                  value={transactionSearch}
                  onChange={(event) => setTransactionSearch(event.target.value)}
                  placeholder="按理由/场景/类别/来源/分值筛选"
                />
              </label>
              <label>
                <span>开始日期</span>
                <input type="date" value={transactionDateFrom} onChange={(event) => setTransactionDateFrom(event.target.value)} />
              </label>
              <label>
                <span>结束日期</span>
                <input type="date" value={transactionDateTo} onChange={(event) => setTransactionDateTo(event.target.value)} />
              </label>
            </div>
            <div className="attendance-summary-strip detail">
              <div>
                <span>加分记录</span>
                <strong>{filteredTransactionSummary.bonus}</strong>
              </div>
              <div>
                <span>扣分记录</span>
                <strong>{filteredTransactionSummary.penalty}</strong>
              </div>
              <div>
                <span>已撤销</span>
                <strong>{filteredTransactionSummary.reverted}</strong>
              </div>
            </div>
            {filteredRecentTransactions.map((item) => (
              <div key={item.id} className="transaction-row">
                <div>
                  <strong>{item.reason}</strong>
                  <span>
                    {item.category} / {item.scene} / {item.sourceModule}
                    {item.isReverted ? " / 已撤销" : ""}
                  </span>
                </div>
                <div className="transaction-actions">
                  <b>{item.value}</b>
                  {!item.isReverted && item.sourceModule === "manual_adjustment" ? (
                    <button
                      type="button"
                      className="inline-action"
                      disabled={revertingTransactionId === item.id || !canManagePoints || classFrozen}
                      onClick={() =>
                        void handleRevertClick(
                          item.id,
                          item.reason,
                          item.value,
                          item.transactionType,
                          item.occurredAt,
                          item.scene,
                          item.category,
                          item.sourceModule
                        )
                      }
                    >
                      {revertingTransactionId === item.id ? "撤销中..." : "撤销"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!filteredRecentTransactions.length ? (
              <p className="muted">{studentDetail.recentTransactions.length ? "当前筛选条件下没有匹配的积分记录" : "暂无最近积分记录"}</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="muted">选择学生后显示详情</p>
      )}
    </article>
  );
}
