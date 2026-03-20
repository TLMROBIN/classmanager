import fs from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { canManagePoints } from "../../lib/permissions.js";
import { buildStructuredExportBody } from "./builder.js";
import { createQueuedStructuredExportJob, runStructuredExportJob } from "./executor.js";
import {
  assertStructuredFullBackup,
  buildStructuredFullRestorePlan,
  restoreStructuredFullBackup
} from "./restore.js";
import {
  buildExportOutputPath,
  ensureExportOutputDir,
  loadExportHistory,
  loadExportJobDetail,
  loadExportJobList,
  loadRawExportJobDetail,
  loadExportSummary,
  requireExportClassAccess,
  validateExportDownloadPath,
  writeExportManifest,
  writeExportDownloadAuditLog,
  writeStructuredExportAuditLog
} from "./service.js";

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const exportQuerySchema = z.object({
  domain: z
    .enum(["full", "settings", "students", "points", "attendance", "homework"])
    .optional()
    .default("full"),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional()
});

const exportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

const exportJobBodySchema = z.object({
  exportType: z.enum(["full", "settings", "students", "points", "attendance", "homework"]).optional().default("full"),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional()
});

const exportJobParamsSchema = z.object({
  jobId: z.string().uuid()
});

const structuredFullRestoreBodySchema = z
  .object({
    exportType: z.literal("full"),
    schemaVersion: z.string().optional(),
    exportedAt: z.string().optional(),
    class: z.record(z.string(), z.unknown()),
    tenant: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()),
    students: z.array(z.record(z.string(), z.unknown())),
    points: z.object({
      transactions: z.array(z.record(z.string(), z.unknown()))
    }),
    attendance: z.object({
      sessions: z.array(z.record(z.string(), z.unknown())),
      records: z.array(z.record(z.string(), z.unknown()))
    }),
    filters: z
      .object({
        dateFrom: z.string().nullable().optional(),
        dateTo: z.string().nullable().optional()
      })
      .nullable()
      .optional()
  })
  .passthrough();

function canManageExports(membership: { roles?: Array<{ role: { code: string } }> } | null | undefined) {
  return canManagePoints(membership || null);
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/classes/:classId/export-jobs", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = exportListQuerySchema.parse(request.query);
    const { classRecord } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);
    const items = await loadExportJobList(app.prisma, classRecord.id, query.limit);

    return { items };
  });

  app.get("/export-jobs/:jobId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = exportJobParamsSchema.parse(request.params);
    const rawJob = await loadRawExportJobDetail(app.prisma, params.jobId);

    if (!rawJob || !rawJob.classId) {
      throw reply.notFound("Export job not found");
    }

    await requireExportClassAccess(app.prisma, auth.sub, rawJob.classId, reply);
    const job = await loadExportJobDetail(app.prisma, params.jobId);
    return job;
  });

  app.get("/export-jobs/:jobId/download", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = exportJobParamsSchema.parse(request.params);
    const job = await loadRawExportJobDetail(app.prisma, params.jobId);

    if (!job || !job.classId) {
      throw reply.notFound("Export job not found");
    }

    const { classRecord, membership } = await requireExportClassAccess(app.prisma, auth.sub, job.classId, reply);

    if (job.status === "expired") {
      throw reply.gone("Export job expired");
    }

    if (job.requestedByUserId && job.requestedByUserId !== auth.sub && !canManageExports(membership)) {
      throw reply.forbidden("Export download permission denied");
    }

    if (job.status !== "succeeded" || !job.outputPath) {
      throw reply.badRequest("Export job file unavailable");
    }

    if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
      throw reply.gone("Export job expired");
    }

    if (!validateExportDownloadPath(job.outputPath)) {
      throw reply.badRequest("Export job path invalid");
    }

    if (!fs.existsSync(job.outputPath)) {
      throw reply.notFound("Export file not found");
    }

    await writeExportDownloadAuditLog(app.prisma, {
      tenantId: classRecord.tenantId,
      classId: classRecord.id,
      actorUserId: auth.sub,
      actorMembershipId: membership.id,
      exportJobId: job.id,
      exportType: job.exportType
    });

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename=\"${path.basename(job.outputPath)}\"`);
    return reply.send(fs.createReadStream(job.outputPath));
  });

  app.post("/classes/:classId/export-jobs", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = exportJobBodySchema.parse(request.body);
    const { classRecord, membership } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);

    if (!canManageExports(membership)) {
      throw reply.forbidden("Export job permission denied");
    }

    const filters = {
      dateFrom: body.dateFrom,
      dateTo: body.dateTo
    };
    const queuedJob = await createQueuedStructuredExportJob({
      prisma: app.prisma,
      tenantId: classRecord.tenantId,
      classId: classRecord.id,
      userId: auth.sub,
      membershipId: membership.id,
      exportType: body.exportType,
      filters
    });

    return runStructuredExportJob({
      prisma: app.prisma,
      queuedJob,
      tenantId: classRecord.tenantId,
      classId: classRecord.id,
      userId: auth.sub,
      membershipId: membership.id,
      exportType: body.exportType,
      filters,
      buildExportBody: () => buildStructuredExportBody(app, classRecord, body.exportType, filters),
      buildOutputPath: buildExportOutputPath,
      ensureOutputDir: ensureExportOutputDir,
      writeManifest: writeExportManifest,
      writeAuditLog: (input) => writeStructuredExportAuditLog(app.prisma, input)
    });
  });

  app.get("/classes/:classId/exports/summary", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = exportListQuerySchema.parse(request.query);
    const { classRecord } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);
    const summary = await loadExportSummary(app.prisma, classRecord.id, query.limit);

    return {
      classId: classRecord.id,
      ...summary
    };
  });

  app.get("/classes/:classId/exports/history", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = exportListQuerySchema.parse(request.query);
    const { classRecord } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);
    const history = await loadExportHistory(app.prisma, classRecord.id, query.limit);

    return {
      classId: classRecord.id,
      ...history
    };
  });

  app.get("/classes/:classId/exports/structured", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = exportQuerySchema.parse(request.query);
    const { classRecord, membership } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);

    if (!canManageExports(membership)) {
      throw reply.forbidden("Structured export permission denied");
    }

    const filters = {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo
    };

    const body = await buildStructuredExportBody(app, classRecord, query.domain, filters);

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename=\"class-export-${query.domain}-${classRecord.tenant.slug}-${params.classId}.json\"`
    );

    await writeStructuredExportAuditLog(app.prisma, {
      tenantId: classRecord.tenantId,
      classId: classRecord.id,
      actorUserId: auth.sub,
      actorMembershipId: membership.id,
      domain: query.domain,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      counts: body.counts as Record<string, unknown>
    });

    return body;
  });

  app.post("/classes/:classId/exports/structured-full/restore", { preHandler: app.authenticate, bodyLimit: 20 * 1024 * 1024 }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = structuredFullRestoreBodySchema.parse(request.body);
    const { classRecord, membership } = await requireExportClassAccess(app.prisma, auth.sub, params.classId, reply);

    if (!canManageExports(membership)) {
      throw reply.forbidden("Structured full restore permission denied");
    }

    try {
      assertStructuredFullBackup(body);
    } catch (error) {
      throw reply.badRequest(error instanceof Error ? error.message : "Structured full restore payload invalid");
    }

    try {
      const result = await restoreStructuredFullBackup(app.prisma, {
        backup: body,
        classRecord,
        actorUserId: auth.sub,
        actorMembershipId: membership.id,
        sourceFilename: "structured-full-api-restore.json"
      });

      return {
        classId: classRecord.id,
        importJobId: result.importJobId,
        exportedAt: body.exportedAt || null,
        counts: result.counts,
        limitations: buildStructuredFullRestorePlan(body).limitations
      };
    } catch (error) {
      throw reply.badRequest(error instanceof Error ? error.message : "Structured full restore failed");
    }
  });
};
