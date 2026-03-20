import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../../../../../");

function getExportOutputDir() {
  return process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR || path.join(workspaceRoot, "out", "structured-exports");
}

function getManifestPath() {
  return process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH || path.join(getExportOutputDir(), "manifest.json");
}

export type StructuredExportType = "full" | "settings" | "students" | "points" | "attendance" | "homework";

export type ExportFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type ExportManifestEntry = {
  exportedAt: string;
  outputPath: string;
  classId: string;
  exportType: string;
  counts: Record<string, unknown>;
  filters: Record<string, unknown> | null;
};

export type ExportFileState = "pending" | "available" | "expired" | "missing" | "invalid_path" | "unavailable" | "manifest_only";

function getExportDownloadName(outputPath: string | null | undefined) {
  if (!outputPath) return null;
  return path.basename(outputPath);
}

function getExportJobFileState(job: {
  status: string;
  outputPath: string | null;
  expiresAt?: string | Date | null;
}) {
  if (job.status === "queued" || job.status === "running") {
    return "pending" satisfies ExportFileState;
  }

  if (job.status === "expired") {
    return "expired" satisfies ExportFileState;
  }

  if (job.status !== "succeeded" || !job.outputPath) {
    return "unavailable" satisfies ExportFileState;
  }

  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    return "expired" satisfies ExportFileState;
  }

  if (!validateExportDownloadPath(job.outputPath)) {
    return "invalid_path" satisfies ExportFileState;
  }

  if (!fs.existsSync(job.outputPath)) {
    return "missing" satisfies ExportFileState;
  }

  return "available" satisfies ExportFileState;
}

function sanitizeManifestEntry(entry: any) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    outputPath: null,
    downloadName: getExportDownloadName(entry.outputPath)
  };
}

function serializeExportJob(job: any) {
  const downloadName = getExportDownloadName(job.outputPath);
  const fileState = getExportJobFileState(job);
  const fileAvailable = fileState === "available";

  return {
    ...job,
    outputPath: null,
    downloadName,
    fileAvailable,
    fileState,
    requestedByUser: job.requestedByUser
      ? {
          id: job.requestedByUser.id,
          username: job.requestedByUser.username,
          displayName: job.requestedByUser.displayName
        }
      : null,
    manifestEntry: sanitizeManifestEntry(job.manifestEntry)
  };
}

function serializeManifestItem(item: any) {
  return {
    ...item,
    outputPath: null,
    downloadName: getExportDownloadName(item.outputPath),
    fileAvailable: false,
    fileState: "manifest_only" satisfies ExportFileState
  };
}

function serializeManifestSummary(summary: any) {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    latestOutputPath: null,
    latestDownloadName: getExportDownloadName(summary.latestOutputPath)
  };
}

export async function requireExportClassAccess(prisma: any, userId: string, classId: string, reply: any) {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      code: true,
      timezone: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!classRecord) {
    throw reply.notFound("Class not found");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: classRecord.tenantId,
        userId
      }
    },
    select: {
      id: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              code: true
            }
          }
        }
      }
    }
  });

  if (!membership || membership.status !== "active") {
    throw reply.forbidden("Class access denied");
  }

  return {
    classRecord,
    membership
  };
}

export function ensureExportOutputDir() {
  fs.mkdirSync(getExportOutputDir(), { recursive: true });
}

export function readExportManifest() {
  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return {
      schemaVersion: "classmanager.export.manifest.v1",
      updatedAt: null,
      byClass: [],
      items: []
    };
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

export function writeExportManifest(entry: ExportManifestEntry) {
  const manifest = readExportManifest();
  const nextItems = [entry, ...(manifest.items || [])]
    .filter((item, index, list) => index === list.findIndex((candidate) => candidate.outputPath === item.outputPath))
    .slice(0, 200);

  const byClassMap = new Map();
  for (const item of nextItems) {
    const current = byClassMap.get(item.classId) || {
      classId: item.classId,
      latestExportedAt: item.exportedAt,
      latestOutputPath: item.outputPath,
      latestExportType: item.exportType,
      totalExports: 0,
      exportTypes: {}
    };

    current.totalExports += 1;
    current.exportTypes[item.exportType] = (current.exportTypes[item.exportType] || 0) + 1;

    if (!current.latestExportedAt || new Date(item.exportedAt).getTime() > new Date(current.latestExportedAt).getTime()) {
      current.latestExportedAt = item.exportedAt;
      current.latestOutputPath = item.outputPath;
      current.latestExportType = item.exportType;
    }

    byClassMap.set(item.classId, current);
  }

  const nextManifest = {
    schemaVersion: "classmanager.export.manifest.v1",
    updatedAt: new Date().toISOString(),
    byClass: Array.from(byClassMap.values()).sort((left, right) => {
      return new Date(right.latestExportedAt).getTime() - new Date(left.latestExportedAt).getTime();
    }),
    items: nextItems
  };

  ensureExportOutputDir();
  const manifestPath = getManifestPath();
  fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
}

export function buildExportOutputPath(classId: string, exportType: StructuredExportType, filters: ExportFilters) {
  const exportOutputDir = getExportOutputDir();
  const suffix = [exportType, filters.dateFrom || "all", filters.dateTo || "all"].join("-");
  return path.join(exportOutputDir, `${classId}-${suffix}.json`);
}

export async function writeStructuredExportAuditLog(
  prisma: any,
  input: {
    tenantId: string;
    classId: string;
    actorUserId: string;
    actorMembershipId: string;
    domain: StructuredExportType;
    dateFrom?: string;
    dateTo?: string;
    counts: Record<string, unknown>;
  }
) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      classId: input.classId,
      actorUserId: input.actorUserId,
      actorMembershipId: input.actorMembershipId,
      action: "export.structured",
      targetType: "class_export",
      targetId: input.classId,
      afterData: {
        exportType: input.domain,
        counts: input.counts
      },
      metadata: {
        dateFrom: input.dateFrom || null,
        dateTo: input.dateTo || null
      }
    }
  });
}

export async function writeExportDownloadAuditLog(
  prisma: any,
  input: {
    tenantId: string;
    classId: string;
    actorUserId: string;
    actorMembershipId: string;
    exportJobId: string;
    exportType: StructuredExportType;
  }
) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      classId: input.classId,
      actorUserId: input.actorUserId,
      actorMembershipId: input.actorMembershipId,
      action: "export.download",
      targetType: "export_job",
      targetId: input.exportJobId,
      afterData: {
        exportType: input.exportType
      }
    }
  });
}

export function getExportOutputDirPath() {
  return getExportOutputDir();
}

export function validateExportDownloadPath(outputPath: string) {
  const resolvedOutputDir = path.resolve(getExportOutputDir());
  const resolvedOutputPath = path.resolve(outputPath);
  return resolvedOutputPath.startsWith(`${resolvedOutputDir}${path.sep}`) || resolvedOutputPath === resolvedOutputDir;
}

export async function loadExportJobList(prisma: any, classId: string, limit: number) {
  const items = await prisma.exportJob.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      requestedByUserId: true,
      requestedByUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      },
      jobType: true,
      exportType: true,
      filters: true,
      status: true,
      outputPath: true,
      summary: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return items.map((item: any) => serializeExportJob(item));
}

export async function loadRawExportJobDetail(prisma: any, jobId: string) {
  return prisma.exportJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      tenantId: true,
      classId: true,
      requestedByUserId: true,
      requestedByUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      },
      requestedByMembershipId: true,
      jobType: true,
      exportType: true,
      filters: true,
      status: true,
      outputPath: true,
      manifestEntry: true,
      summary: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function loadExportJobDetail(prisma: any, jobId: string) {
  const item = await loadRawExportJobDetail(prisma, jobId);
  return item ? serializeExportJob(item) : null;
}

export async function loadExportSummary(prisma: any, classId: string, limit: number) {
  const manifest = readExportManifest();
  const manifestSummary = (manifest.byClass || []).find((item: any) => item.classId === classId) || null;

  const [jobItems, auditItems, latestAudit] = await Promise.all([
    prisma.exportJob.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        requestedByUserId: true,
        requestedByUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        },
        exportType: true,
        filters: true,
        status: true,
        outputPath: true,
        summary: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        expiresAt: true,
        createdAt: true
      }
    }),
    prisma.auditLog.findMany({
      where: { classId, action: { in: ["export.structured", "export.cleanup"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        targetType: true,
        metadata: true,
        afterData: true,
        createdAt: true
      }
    }),
    prisma.auditLog.findFirst({
      where: { classId, action: { in: ["export.structured", "export.cleanup"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        afterData: true
      }
    })
  ]);

  const serializedJobItems = jobItems.map((item: any) => serializeExportJob(item));
  const latestJob = serializedJobItems[0] || null;
  const effectiveSummary =
    latestJob
      ? {
          classId,
          latestExportedAt: latestJob.finishedAt || latestJob.createdAt,
          latestOutputPath: latestJob.outputPath,
          latestDownloadName: latestJob.downloadName,
          latestExportType: latestJob.exportType,
          totalExports: serializedJobItems.length,
          exportTypes: serializedJobItems.reduce((acc: Record<string, number>, item: any) => {
            acc[item.exportType] = (acc[item.exportType] || 0) + 1;
            return acc;
          }, {})
        }
      : serializeManifestSummary(manifestSummary);

  return {
    manifestUpdatedAt: manifest.updatedAt || null,
    latestJob,
    latestAudit,
    manifestSummary: effectiveSummary,
    recentJobs: serializedJobItems,
    recentAudits: auditItems
  };
}

export async function loadExportHistory(prisma: any, classId: string, limit: number) {
  const manifest = readExportManifest();
  const manifestItems = (manifest.items || [])
    .filter((item: any) => item.classId === classId)
    .slice(0, limit)
    .map((item: any) => serializeManifestItem(item));

  const [jobItems, auditItems] = await Promise.all([
    prisma.exportJob.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        requestedByUserId: true,
        requestedByUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        },
        exportType: true,
        filters: true,
        status: true,
        outputPath: true,
        manifestEntry: true,
        summary: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.auditLog.findMany({
      where: { classId, action: { in: ["export.structured", "export.cleanup"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        afterData: true
      }
    })
  ]);

  const serializedJobItems = jobItems.map((item: any) => serializeExportJob(item));

  return {
    manifestUpdatedAt: manifest.updatedAt || null,
    items: serializedJobItems.length
      ? serializedJobItems.map((item: any) => ({
          source: "export_job",
          ...item
        }))
      : manifestItems,
    manifestItems,
    audits: auditItems
  };
}
