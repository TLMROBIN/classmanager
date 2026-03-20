import { useState } from "react";

import type { ExportHistoryResponse, ExportSummaryResponse } from "../types";

type ExportPanelProps = {
  summary: ExportSummaryResponse | null;
  history: ExportHistoryResponse | null;
  currentUserId: string;
  canManageExports: boolean;
  creatingExportJob: boolean;
  downloadingExportJobId: string;
  exportMessage: string;
  onCreateExportJob: (input: {
    exportType: "full" | "settings" | "students" | "points" | "attendance" | "homework";
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  onDownloadExportJob: (jobId: string) => void;
};

type ExportType = "full" | "settings" | "students" | "points" | "attendance" | "homework";

const exportTypeLabels: Record<string, string> = {
  full: "全量",
  settings: "设置",
  students: "学生",
  points: "积分",
  attendance: "考勤",
  homework: "作业"
};

const statusLabels: Record<string, string> = {
  queued: "排队中",
  running: "执行中",
  succeeded: "成功",
  failed: "失败",
  expired: "已过期"
};

const auditActionLabels: Record<string, string> = {
  "export.structured": "导出",
  "export.cleanup": "清理"
};

function formatFilters(filters: Record<string, unknown> | null | undefined) {
  if (!filters) return "全量范围";
  const dateFrom = typeof filters.dateFrom === "string" ? filters.dateFrom : "";
  const dateTo = typeof filters.dateTo === "string" ? filters.dateTo : "";
  if (!dateFrom && !dateTo) return "全量范围";
  return `${dateFrom || "最早"} 至 ${dateTo || "最新"}`;
}

function formatCounts(counts: Record<string, unknown> | null | undefined) {
  if (!counts) return "暂无计数";
  const parts = Object.entries(counts)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length ? parts.join(" / ") : "暂无计数";
}

function formatAuditSummary(audit: {
  action?: string;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (audit.action === "export.cleanup") {
    const cleanupMode =
      typeof audit.afterData?.cleanupMode === "string" ? audit.afterData.cleanupMode : "";
    return cleanupMode === "expire_and_remove_file" ? "过期并删文件" : "仅标记过期";
  }

  const exportType = typeof audit.afterData?.exportType === "string" ? audit.afterData.exportType : "structured";
  return exportTypeLabels[exportType] || exportType;
}

function formatRequestedBy(job: {
  requestedByUser?: {
    username: string;
    displayName: string | null;
  } | null;
}) {
  const displayName = job.requestedByUser?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  if (job.requestedByUser?.username) {
    return job.requestedByUser.username;
  }

  return "未知创建人";
}

function getDownloadHint(
  job: {
    requestedByUserId?: string | null;
    status: string;
    fileAvailable?: boolean;
    fileState?: "pending" | "available" | "expired" | "missing" | "invalid_path" | "unavailable" | "manifest_only";
    expiresAt?: string | null;
  },
  currentUserId: string,
  canManageExports: boolean
) {
  if (job.fileState === "expired") {
    return "文件已过期";
  }

  if (job.fileState === "pending") {
    return "等待生成";
  }

  if (job.fileState === "missing") {
    return "文件已清理";
  }

  if (job.fileState === "invalid_path") {
    return "文件路径异常";
  }

  if (job.fileState === "manifest_only") {
    return "仅保留清单";
  }

  if (job.status === "failed" || job.fileState === "unavailable") {
    return "任务失败或无文件";
  }

  if (job.requestedByUserId && job.requestedByUserId !== currentUserId && !canManageExports) {
    return "仅创建人或管理员可下载";
  }

  return "可下载";
}

function canDownloadJob(
  job: {
    requestedByUserId?: string | null;
    requestedByUser?: {
      username: string;
      displayName: string | null;
    } | null;
    status: string;
    outputPath: string | null;
    fileAvailable?: boolean;
    fileState?: "pending" | "available" | "expired" | "missing" | "invalid_path" | "unavailable" | "manifest_only";
    expiresAt?: string | null;
  },
  currentUserId: string,
  canManageExports: boolean
) {
  if (job.status !== "succeeded") return false;
  if (job.fileState !== "available") return false;
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) return false;
  if (job.requestedByUserId && job.requestedByUserId !== currentUserId && !canManageExports) return false;
  return true;
}

export function ExportPanel({
  summary,
  history,
  currentUserId,
  canManageExports,
  creatingExportJob,
  downloadingExportJobId,
  exportMessage,
  onCreateExportJob,
  onDownloadExportJob
}: ExportPanelProps) {
  const [exportType, setExportType] = useState<ExportType>("points");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recentJobTypeFilter, setRecentJobTypeFilter] = useState<"" | ExportType>("");
  const [recentJobStatusFilter, setRecentJobStatusFilter] = useState<"" | "queued" | "running" | "succeeded" | "failed" | "expired">("");
  const [recentJobScopeFilter, setRecentJobScopeFilter] = useState<"" | "mine" | "others">("");
  const [recentJobSearch, setRecentJobSearch] = useState("");
  const [recentJobDateFrom, setRecentJobDateFrom] = useState("");
  const [recentJobDateTo, setRecentJobDateTo] = useState("");
  const [historySourceFilter, setHistorySourceFilter] = useState<"" | "job" | "manifest">("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"" | ExportType>("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<"" | "export.structured" | "export.cleanup">("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  function matchesDateRange(value: string, dateFrom: string, dateTo: string) {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  }

  const filteredRecentJobs = (summary?.recentJobs || []).filter((job) => {
    const matchesType = !recentJobTypeFilter || job.exportType === recentJobTypeFilter;
    const matchesStatus = !recentJobStatusFilter || job.status === recentJobStatusFilter;
    const isMine = job.requestedByUserId === currentUserId;
    const matchesScope = !recentJobScopeFilter || (recentJobScopeFilter === "mine" ? isMine : !isMine);
    const matchesDate = matchesDateRange(job.createdAt, recentJobDateFrom, recentJobDateTo);
    const keyword = recentJobSearch.trim();
    const requestedBy = formatRequestedBy(job);
    const matchesSearch =
      !keyword ||
      [exportTypeLabels[job.exportType] || job.exportType, statusLabels[job.status] || job.status, formatFilters(job.filters || null), requestedBy]
        .some((value) => value.includes(keyword));
    return matchesType && matchesStatus && matchesScope && matchesDate && matchesSearch;
  });
  const filteredRecentJobSummary = filteredRecentJobs.reduce(
    (totals, job) => {
      if (job.status === "succeeded") totals.succeeded += 1;
      if (job.status === "failed") totals.failed += 1;
      if (job.status === "expired") totals.expired += 1;
      if (job.status === "running" || job.status === "queued") totals.pending += 1;
      if (canDownloadJob(job, currentUserId, canManageExports)) totals.downloadable += 1;
      return totals;
    },
    {
      succeeded: 0,
      failed: 0,
      expired: 0,
      pending: 0,
      downloadable: 0
    }
  );

  const filteredHistoryItems = (history?.items || []).filter((item) => {
    const isJob = "status" in item;
    const matchesSource = !historySourceFilter || (historySourceFilter === "job" ? isJob : !isJob);
    const matchesType = !historyTypeFilter || item.exportType === historyTypeFilter;
    const itemDate = isJob ? item.createdAt : item.exportedAt;
    const matchesDate = matchesDateRange(itemDate, historyDateFrom, historyDateTo);
    const keyword = historySearch.trim();
    const summaryText = isJob ? formatCounts(item.summary || null) : formatCounts(item.counts || null);
    const requestedBy = isJob ? formatRequestedBy(item) : "manifest";
    const matchesSearch =
      !keyword ||
      [exportTypeLabels[item.exportType] || item.exportType, formatFilters(item.filters || null), summaryText, requestedBy]
        .some((value) => value.includes(keyword));
    return matchesSource && matchesType && matchesDate && matchesSearch;
  });
  const filteredHistorySummary = filteredHistoryItems.reduce(
    (totals, item) => {
      const isJob = "status" in item;
      if (isJob) {
        totals.jobs += 1;
        if (canDownloadJob(item, currentUserId, canManageExports)) {
          totals.downloadable += 1;
        }
      } else {
        totals.manifests += 1;
      }
      return totals;
    },
    { jobs: 0, manifests: 0, downloadable: 0 }
  );

  const filteredAudits = (summary?.recentAudits || []).filter((audit) => {
    const matchesAction = !auditActionFilter || audit.action === auditActionFilter;
    const matchesDate = matchesDateRange(audit.createdAt, auditDateFrom, auditDateTo);
    const keyword = auditSearch.trim();
    const matchesSearch =
      !keyword ||
      [auditActionLabels[audit.action || ""] || "审计", formatFilters(audit.metadata || null), formatAuditSummary(audit)]
        .some((value) => value.includes(keyword));
    return matchesAction && matchesDate && matchesSearch;
  });
  const filteredAuditSummary = filteredAudits.reduce(
    (totals, audit) => {
      if (audit.action === "export.structured") totals.structured += 1;
      if (audit.action === "export.cleanup") totals.cleanup += 1;
      return totals;
    },
    { structured: 0, cleanup: 0 }
  );

  function submitJob() {
    onCreateExportJob({
      exportType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    });
  }

  return (
    <section className="content-grid single-column">
      <section className="panel">
        <div className="panel-header">
          <h2>结构化导出</h2>
          <span>{summary?.manifestSummary?.totalExports ?? 0} 次历史导出</span>
        </div>

        <div className="attendance-summary-strip">
          <div>
            <span>最近任务</span>
            <strong>
              {summary?.latestJob ? exportTypeLabels[summary.latestJob.exportType] || summary.latestJob.exportType : "暂无"}
            </strong>
          </div>
          <div>
            <span>最近状态</span>
            <strong>{summary?.latestJob ? statusLabels[summary.latestJob.status] || summary.latestJob.status : "暂无"}</strong>
          </div>
          <div>
            <span>最近导出时间</span>
            <strong>{summary?.manifestSummary?.latestExportedAt?.slice(0, 16).replace("T", " ") || "-"}</strong>
          </div>
          <div>
            <span>清单更新时间</span>
            <strong>{summary?.manifestUpdatedAt?.slice(0, 16).replace("T", " ") || "-"}</strong>
          </div>
        </div>

        <div className="adjustment-form">
          <div className="student-filters">
            <label>
              <span>导出域</span>
              <select value={exportType} onChange={(event) => setExportType(event.target.value as typeof exportType)}>
                <option value="points">积分</option>
                <option value="attendance">考勤</option>
                <option value="homework">作业</option>
                <option value="students">学生</option>
                <option value="settings">设置</option>
                <option value="full">全量</option>
              </select>
            </label>
            <label>
              <span>开始日期</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              <span>结束日期</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
          <div className="import-footer">
            <button
              type="button"
              className="adjustment-submit"
              disabled={!canManageExports || creatingExportJob}
              onClick={submitJob}
            >
              {creatingExportJob ? "导出中..." : "创建导出任务"}
            </button>
            <span className="muted">
              {canManageExports ? "当前阶段先保留同步执行任务模型，满足切换和运维即可。" : "当前账号没有导出写权限。"}
            </span>
          </div>
          {exportMessage ? <p className="success-text">{exportMessage}</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <h3>最近任务</h3>
          <span>{filteredRecentJobs.length} / {summary?.recentJobs.length ?? 0} 条</span>
        </div>
        <div className="student-filters">
          <label>
            <span>导出域</span>
            <select value={recentJobTypeFilter} onChange={(event) => setRecentJobTypeFilter(event.target.value as typeof recentJobTypeFilter)}>
              <option value="">全部</option>
              <option value="points">积分</option>
              <option value="attendance">考勤</option>
              <option value="homework">作业</option>
              <option value="students">学生</option>
              <option value="settings">设置</option>
              <option value="full">全量</option>
            </select>
          </label>
          <label>
            <span>任务状态</span>
            <select value={recentJobStatusFilter} onChange={(event) => setRecentJobStatusFilter(event.target.value as typeof recentJobStatusFilter)}>
              <option value="">全部</option>
              <option value="queued">排队中</option>
              <option value="running">执行中</option>
              <option value="succeeded">成功</option>
              <option value="failed">失败</option>
              <option value="expired">已过期</option>
            </select>
          </label>
          <label>
            <span>任务归属</span>
            <select value={recentJobScopeFilter} onChange={(event) => setRecentJobScopeFilter(event.target.value as typeof recentJobScopeFilter)}>
              <option value="">全部</option>
              <option value="mine">我创建的</option>
              <option value="others">其他人创建</option>
            </select>
          </label>
          <label>
            <span>关键词</span>
            <input value={recentJobSearch} onChange={(event) => setRecentJobSearch(event.target.value)} placeholder="按导出域/状态/范围/创建人筛选" />
          </label>
          <label>
            <span>开始日期</span>
            <input type="date" value={recentJobDateFrom} onChange={(event) => setRecentJobDateFrom(event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={recentJobDateTo} onChange={(event) => setRecentJobDateTo(event.target.value)} />
          </label>
        </div>
        <div className="attendance-summary-strip">
          <div>
            <span>成功任务</span>
            <strong>{filteredRecentJobSummary.succeeded}</strong>
          </div>
          <div>
            <span>失败任务</span>
            <strong>{filteredRecentJobSummary.failed}</strong>
          </div>
          <div>
            <span>排队/执行中</span>
            <strong>{filteredRecentJobSummary.pending}</strong>
          </div>
          <div>
            <span>已过期</span>
            <strong>{filteredRecentJobSummary.expired}</strong>
          </div>
          <div>
            <span>当前可下载</span>
            <strong>{filteredRecentJobSummary.downloadable}</strong>
          </div>
        </div>
        <div className="transaction-list">
          {filteredRecentJobs.length ? (
            filteredRecentJobs.map((job) => (
                <div key={job.id} className="transaction-row">
                  <div>
                    <strong>{exportTypeLabels[job.exportType] || job.exportType}</strong>
                    <span>
                      {statusLabels[job.status] || job.status} · {formatFilters(job.filters || null)} · {formatRequestedBy(job)}
                    </span>
                    <span className="muted">
                      创建 {job.createdAt.slice(0, 16).replace("T", " ")}
                      {job.finishedAt ? ` · 完成 ${job.finishedAt.slice(0, 16).replace("T", " ")}` : ""}
                    </span>
                  </div>
                  <div className="transaction-actions">
                    <b>{formatCounts(job.summary || null)}</b>
                    <span className="muted">{getDownloadHint(job, currentUserId, canManageExports)}</span>
                    {canDownloadJob(job, currentUserId, canManageExports) ? (
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={downloadingExportJobId === job.id}
                        onClick={() => onDownloadExportJob(job.id)}
                      >
                        {downloadingExportJobId === job.id ? "下载中..." : "下载"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
          ) : (
            <p className="muted">{summary?.recentJobs.length ? "当前筛选条件下没有匹配的导出任务" : "当前班级还没有导出任务。"}</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <h3>导出清单与审计</h3>
          <span>{filteredHistoryItems.length} / {history?.items.length ?? 0} 条</span>
        </div>
        <div className="student-filters">
          <label>
            <span>记录来源</span>
            <select value={historySourceFilter} onChange={(event) => setHistorySourceFilter(event.target.value as typeof historySourceFilter)}>
              <option value="">全部</option>
              <option value="job">导出任务</option>
              <option value="manifest">清单记录</option>
            </select>
          </label>
          <label>
            <span>导出域</span>
            <select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value as typeof historyTypeFilter)}>
              <option value="">全部</option>
              <option value="points">积分</option>
              <option value="attendance">考勤</option>
              <option value="homework">作业</option>
              <option value="students">学生</option>
              <option value="settings">设置</option>
              <option value="full">全量</option>
            </select>
          </label>
          <label>
            <span>关键词</span>
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="按导出域/范围/计数/创建人筛选" />
          </label>
          <label>
            <span>开始日期</span>
            <input type="date" value={historyDateFrom} onChange={(event) => setHistoryDateFrom(event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={historyDateTo} onChange={(event) => setHistoryDateTo(event.target.value)} />
          </label>
        </div>
        <div className="attendance-summary-strip">
          <div>
            <span>任务记录</span>
            <strong>{filteredHistorySummary.jobs}</strong>
          </div>
          <div>
            <span>清单记录</span>
            <strong>{filteredHistorySummary.manifests}</strong>
          </div>
          <div>
            <span>当前可下载</span>
            <strong>{filteredHistorySummary.downloadable}</strong>
          </div>
        </div>
        <div className="content-grid overview-grid">
          <div className="transaction-list">
            {filteredHistoryItems.length ? (
              filteredHistoryItems.slice(0, 8).map((item, index) => {
                const isJob = "status" in item;
                return (
                  <div key={isJob ? item.id : `${item.exportedAt}-${index}`} className="transaction-row">
                    <div>
                      <strong>{exportTypeLabels[item.exportType] || item.exportType}</strong>
                      <span>
                        {isJob
                          ? `${statusLabels[item.status] || item.status} · ${formatFilters(item.filters || null)} · ${formatRequestedBy(item)}`
                          : `manifest · ${formatFilters(item.filters || null)}`}
                      </span>
                      <span className="muted">
                        {isJob ? `创建 ${item.createdAt.slice(0, 16).replace("T", " ")}` : `导出 ${item.exportedAt.slice(0, 16).replace("T", " ")}`}
                      </span>
                    </div>
                    <div className="transaction-actions">
                      <b>{isJob ? formatCounts(item.summary || null) : formatCounts(item.counts || null)}</b>
                      {isJob ? <span className="muted">{getDownloadHint(item, currentUserId, canManageExports)}</span> : null}
                      {isJob && canDownloadJob(item, currentUserId, canManageExports) ? (
                        <button
                          type="button"
                          className="inline-action-button"
                          disabled={downloadingExportJobId === item.id}
                          onClick={() => onDownloadExportJob(item.id)}
                        >
                          {downloadingExportJobId === item.id ? "下载中..." : "下载"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">{history?.items.length ? "当前筛选条件下没有匹配的导出清单" : "当前还没有导出清单。"}</p>
            )}
          </div>
          <div className="transaction-list">
            <div className="student-filters">
              <label>
                <span>审计动作</span>
                <select value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value as typeof auditActionFilter)}>
                  <option value="">全部</option>
                  <option value="export.structured">导出</option>
                  <option value="export.cleanup">清理</option>
                </select>
              </label>
              <label>
                <span>关键词</span>
                <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="按动作/范围/摘要筛选" />
              </label>
              <label>
                <span>开始日期</span>
                <input type="date" value={auditDateFrom} onChange={(event) => setAuditDateFrom(event.target.value)} />
              </label>
              <label>
                <span>结束日期</span>
                <input type="date" value={auditDateTo} onChange={(event) => setAuditDateTo(event.target.value)} />
              </label>
            </div>
            <div className="attendance-summary-strip">
              <div>
                <span>导出审计</span>
                <strong>{filteredAuditSummary.structured}</strong>
              </div>
              <div>
                <span>清理审计</span>
                <strong>{filteredAuditSummary.cleanup}</strong>
              </div>
            </div>
            {filteredAudits.length ? (
              filteredAudits.slice(0, 8).map((audit) => (
                <div key={audit.id} className="transaction-row">
                  <div>
                    <strong>{auditActionLabels[audit.action || ""] || "审计"}</strong>
                    <span>{formatFilters(audit.metadata || null)}</span>
                  </div>
                  <div className="transaction-actions">
                    <b>{formatAuditSummary(audit)}</b>
                    <span className="muted">{audit.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{summary?.recentAudits.length ? "当前筛选条件下没有匹配的导出审计" : "当前还没有导出审计。"}</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
