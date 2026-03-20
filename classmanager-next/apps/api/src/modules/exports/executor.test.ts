import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createQueuedStructuredExportJob, runStructuredExportJob } from "./executor.js";

function createPrismaStub() {
  const created: any[] = [];
  const updated: any[] = [];

  return {
    created,
    updated,
    prisma: {
      exportJob: {
        async create(input: any) {
          created.push(input);
          return { id: "job-1" };
        },
        async update(input: any) {
          updated.push(input);
          return {
            id: input.where.id,
            status: input.data.status,
            outputPath: input.data.outputPath || null,
            summary: input.data.summary || null,
            finishedAt: input.data.finishedAt || null
          };
        }
      }
    }
  };
}

test("createQueuedStructuredExportJob writes a queued structured export request", async () => {
  const stub = createPrismaStub();
  const queuedJob = await createQueuedStructuredExportJob({
    prisma: stub.prisma,
    tenantId: "tenant-1",
    classId: "class-1",
    userId: "user-1",
    membershipId: "membership-1",
    exportType: "points",
    filters: {
      dateFrom: "2026-03-08",
      dateTo: "2026-03-09"
    }
  });

  assert.deepEqual(queuedJob, { id: "job-1" });
  assert.equal(stub.created.length, 1);
  assert.equal(stub.created[0].data.status, "queued");
  assert.equal(stub.created[0].data.jobType, "structured_export");
  assert.equal(stub.created[0].data.exportType, "points");
});

test("runStructuredExportJob marks job as running then succeeded and writes output side effects", async () => {
  const stub = createPrismaStub();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-executor-test-"));
  const outputPath = path.join(tempDir, "export.json");
  const manifestEntries: any[] = [];
  const auditEntries: any[] = [];

  try {
    const result = await runStructuredExportJob({
      prisma: stub.prisma,
      queuedJob: { id: "job-1" },
      tenantId: "tenant-1",
      classId: "class-1",
      userId: "user-1",
      membershipId: "membership-1",
      exportType: "attendance",
      filters: {
        dateFrom: "2026-03-05",
        dateTo: "2026-03-05"
      },
      buildExportBody: async () => ({
        exportedAt: "2026-03-10T00:00:00.000Z",
        exportType: "attendance",
        counts: {
          attendanceSessions: 3,
          attendanceRecords: 84
        },
        filters: {
          dateFrom: "2026-03-05",
          dateTo: "2026-03-05"
        }
      }),
      buildOutputPath: () => outputPath,
      ensureOutputDir: () => {
        fs.mkdirSync(tempDir, { recursive: true });
      },
      writeManifest: (entry) => {
        manifestEntries.push(entry);
      },
      writeAuditLog: async (entry) => {
        auditEntries.push(entry);
      }
    });

    assert.equal(stub.updated.length, 2);
    assert.equal(stub.updated[0].data.status, "running");
    assert.equal(stub.updated[1].data.status, "succeeded");
    assert.equal(result.status, "succeeded");
    assert.equal(result.outputPath, outputPath);
    assert.deepEqual(result.summary, {
      attendanceSessions: 3,
      attendanceRecords: 84
    });
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(manifestEntries.length, 1);
    assert.equal(manifestEntries[0].classId, "class-1");
    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0].domain, "attendance");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runStructuredExportJob marks job as failed when export body creation throws", async () => {
  const stub = createPrismaStub();
  const manifestEntries: any[] = [];
  const auditEntries: any[] = [];

  await assert.rejects(
    () =>
      runStructuredExportJob({
        prisma: stub.prisma,
        queuedJob: { id: "job-1" },
        tenantId: "tenant-1",
        classId: "class-1",
        userId: "user-1",
        membershipId: "membership-1",
        exportType: "points",
        filters: {},
        buildExportBody: async () => {
          throw new Error("boom");
        },
        buildOutputPath: () => "/tmp/unused.json",
        ensureOutputDir: () => {},
        writeManifest: (entry) => {
          manifestEntries.push(entry);
        },
        writeAuditLog: async (entry) => {
          auditEntries.push(entry);
        }
      }),
    /boom/
  );

  assert.equal(stub.updated.length, 2);
  assert.equal(stub.updated[0].data.status, "running");
  assert.equal(stub.updated[1].data.status, "failed");
  assert.equal(stub.updated[1].data.errorMessage, "boom");
  assert.equal(manifestEntries.length, 0);
  assert.equal(auditEntries.length, 0);
});
