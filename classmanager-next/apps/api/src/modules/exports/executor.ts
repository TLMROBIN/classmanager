import fs from "node:fs";

export type ExportExecutionFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type StructuredExportType = "full" | "settings" | "students" | "points" | "attendance" | "homework";

type ExportJobIdentity = {
  id: string;
};

type CreateStructuredExportJobInput = {
  prisma: any;
  tenantId: string;
  classId: string;
  userId: string;
  membershipId: string;
  exportType: StructuredExportType;
  filters: ExportExecutionFilters;
};

type RunStructuredExportJobInput = {
  prisma: any;
  queuedJob: ExportJobIdentity;
  tenantId: string;
  classId: string;
  userId: string;
  membershipId: string;
  exportType: StructuredExportType;
  filters: ExportExecutionFilters;
  buildExportBody: () => Promise<any>;
  buildOutputPath: (classId: string, exportType: StructuredExportType, filters: ExportExecutionFilters) => string;
  ensureOutputDir: () => void;
  writeManifest: (entry: {
    exportedAt: string;
    outputPath: string;
    classId: string;
    exportType: string;
    counts: Record<string, unknown>;
    filters: Record<string, unknown> | null;
  }) => void;
  writeAuditLog: (input: {
    tenantId: string;
    classId: string;
    actorUserId: string;
    actorMembershipId: string;
    domain: StructuredExportType;
    dateFrom?: string;
    dateTo?: string;
    counts: Record<string, unknown>;
  }) => Promise<void>;
};

export async function createQueuedStructuredExportJob(input: CreateStructuredExportJobInput) {
  return input.prisma.exportJob.create({
    data: {
      tenantId: input.tenantId,
      classId: input.classId,
      requestedByUserId: input.userId,
      requestedByMembershipId: input.membershipId,
      jobType: "structured_export",
      exportType: input.exportType,
      filters: input.filters,
      status: "queued"
    },
    select: { id: true }
  });
}

export async function runStructuredExportJob(input: RunStructuredExportJobInput) {
  try {
    await input.prisma.exportJob.update({
      where: { id: input.queuedJob.id },
      data: {
        status: "running",
        startedAt: new Date()
      }
    });

    const exportBody = await input.buildExportBody();
    const outputPath = input.buildOutputPath(input.classId, input.exportType, input.filters);
    const manifestEntry = {
      exportedAt: exportBody.exportedAt,
      outputPath,
      classId: input.classId,
      exportType: exportBody.exportType,
      counts: exportBody.counts,
      filters: exportBody.filters || null
    };

    input.ensureOutputDir();
    fs.writeFileSync(outputPath, JSON.stringify(exportBody, null, 2));
    input.writeManifest(manifestEntry);

    const finishedJob = await input.prisma.exportJob.update({
      where: { id: input.queuedJob.id },
      data: {
        status: "succeeded",
        outputPath,
        manifestEntry,
        summary: exportBody.counts,
        finishedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      select: {
        id: true,
        status: true,
        outputPath: true,
        summary: true,
        finishedAt: true
      }
    });

    await input.writeAuditLog({
      tenantId: input.tenantId,
      classId: input.classId,
      actorUserId: input.userId,
      actorMembershipId: input.membershipId,
      domain: input.exportType,
      dateFrom: input.filters.dateFrom,
      dateTo: input.filters.dateTo,
      counts: exportBody.counts as Record<string, unknown>
    });

    return finishedJob;
  } catch (error) {
    await input.prisma.exportJob.update({
      where: { id: input.queuedJob.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Export job failed",
        finishedAt: new Date()
      }
    });
    throw error;
  }
}
