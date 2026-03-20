import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { exportRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const JOB_ID = "55555555-5555-4555-8555-555555555555";

async function createTestApp(prisma: any) {
  const app = Fastify();
  await app.register(sensible);
  app.decorate("prisma", prisma);
  app.decorate("authenticate", async (request: any) => {
    request.auth = {
      sub: USER_ID
    };
  });
  await app.register(exportRoutes, { prefix: "/api" });
  return app;
}

function createPrismaForDownload(job: any, auditCreates: any[]) {
  return {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          name: "Class 1",
          code: "c1",
          timezone: "Asia/Shanghai",
          tenant: {
            id: TENANT_ID,
            name: "Tenant 1",
            slug: "tenant-1"
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active",
          roles: []
        };
      }
    },
    exportJob: {
      async findUnique() {
        return job;
      }
    },
    auditLog: {
      async create(input: any) {
        auditCreates.push(input);
      }
    }
  };
}

function createPrismaForDownloadWithMembership(job: any, auditCreates: any[], membership: any) {
  const prisma = createPrismaForDownload(job, auditCreates);
  prisma.membership.findUnique = async () => membership;
  return prisma;
}

function createClassRecord() {
  return {
    id: CLASS_ID,
    tenantId: TENANT_ID,
    name: "Class 1",
    code: "c1",
    timezone: "Asia/Shanghai",
    tenant: {
      id: TENANT_ID,
      name: "Tenant 1",
      slug: "tenant-1"
    }
  };
}

function createStructuredFullBackupPayload(overrides: Record<string, unknown> = {}) {
  return {
    exportType: "full",
    schemaVersion: "classmanager.structured-export.v1",
    exportedAt: new Date().toISOString(),
    class: {
      id: CLASS_ID,
      name: "Class 1",
      code: "c1",
      timezone: "Asia/Shanghai"
    },
    tenant: {
      id: TENANT_ID,
      name: "Tenant 1"
    },
    settings: {},
    students: [],
    points: {
      transactions: []
    },
    attendance: {
      sessions: [],
      records: []
    },
    ...overrides
  };
}

test("GET /export-jobs/:jobId/download streams succeeded export file and writes audit log", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-download-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  const auditCreates: any[] = [];
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");

    const prisma = createPrismaForDownload(
      {
        id: JOB_ID,
        tenantId: TENANT_ID,
        classId: CLASS_ID,
        outputPath,
        exportType: "points",
        status: "succeeded",
        expiresAt: new Date(Date.now() + 60_000)
      },
      auditCreates
    );

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}/download`
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
    assert.match(String(response.headers["content-disposition"]), /filename=/);
    assert.equal(response.body, JSON.stringify({ ok: true }));
    assert.equal(auditCreates.length, 1);
    assert.equal(auditCreates[0].data.action, "export.download");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /export-jobs/:jobId/download rejects expired export job", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-download-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");
    const prisma = createPrismaForDownload(
      {
        id: JOB_ID,
        tenantId: TENANT_ID,
        classId: CLASS_ID,
        outputPath,
        exportType: "points",
        status: "succeeded",
        expiresAt: new Date(Date.now() - 60_000)
      },
      []
    );

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}/download`
    });

    assert.equal(response.statusCode, 410);
    assert.equal(response.json().message, "Export job expired");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /export-jobs/:jobId/download rejects missing export file", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-download-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    const prisma = createPrismaForDownload(
      {
        id: JOB_ID,
        tenantId: TENANT_ID,
        classId: CLASS_ID,
        outputPath,
        exportType: "points",
        status: "succeeded",
        expiresAt: new Date(Date.now() + 60_000)
      },
      []
    );

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}/download`
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().message, "Export file not found");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /export-jobs/:jobId/download rejects expired export job status", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-download-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");
    const prisma = createPrismaForDownload(
      {
        id: JOB_ID,
        tenantId: TENANT_ID,
        classId: CLASS_ID,
        outputPath,
        exportType: "points",
        status: "expired",
        expiresAt: new Date(Date.now() - 60_000)
      },
      []
    );

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}/download`
    });

    assert.equal(response.statusCode, 410);
    assert.equal(response.json().message, "Export job expired");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /export-jobs/:jobId/download rejects other user's export for non-manager membership", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-download-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");
    const prisma = createPrismaForDownloadWithMembership(
      {
        id: JOB_ID,
        tenantId: TENANT_ID,
        classId: CLASS_ID,
        requestedByUserId: "99999999-9999-4999-8999-999999999999",
        outputPath,
        exportType: "points",
        status: "succeeded",
        expiresAt: new Date(Date.now() + 60_000)
      },
      [],
      {
        id: MEMBERSHIP_ID,
        status: "active",
        roles: [
          {
            role: {
              code: "viewer"
            }
          }
        ]
      }
    );

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}/download`
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().message, "Export download permission denied");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("POST /classes/:classId/export-jobs rejects non-manager membership", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          name: "Class 1",
          code: "c1",
          timezone: "Asia/Shanghai",
          tenant: {
            id: TENANT_ID,
            name: "Tenant 1",
            slug: "tenant-1"
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active",
          roles: [
            {
              role: {
                code: "viewer"
              }
            }
          ]
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/export-jobs`,
    payload: {
      exportType: "points"
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Export job permission denied");
  await app.close();
});

test("POST /classes/:classId/exports/structured-full/restore rejects non-manager membership", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active",
          roles: [
            {
              role: {
                code: "viewer"
              }
            }
          ]
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/exports/structured-full/restore`,
    payload: createStructuredFullBackupPayload()
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Structured full restore permission denied");
  await app.close();
});

test("POST /classes/:classId/exports/structured-full/restore rejects filtered full backup payload", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active",
          roles: [
            {
              role: {
                code: "class_admin"
              }
            }
          ]
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/exports/structured-full/restore`,
    payload: createStructuredFullBackupPayload({
      filters: {
        dateFrom: "2026-03-01",
        dateTo: null
      }
    })
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Filtered full export cannot be used as full restore backup");
  await app.close();
});

test("GET /classes/:classId/exports/summary sanitizes output path and exposes file availability", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-summary-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");
    const prisma = {
      class: {
        async findUnique() {
          return createClassRecord();
        }
      },
      membership: {
        async findUnique() {
          return {
            id: MEMBERSHIP_ID,
            status: "active",
            roles: []
          };
        }
      },
      exportJob: {
        async findMany() {
          return [
            {
              id: JOB_ID,
              requestedByUserId: USER_ID,
              requestedByUser: {
                id: USER_ID,
                username: "14ban",
                displayName: "14班"
              },
              exportType: "points",
              filters: {},
              status: "succeeded",
              outputPath,
              summary: { pointTransactions: 1 },
              errorMessage: null,
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              createdAt: new Date().toISOString()
            }
          ];
        }
      },
      auditLog: {
        async findMany() {
          return [
            {
              id: "audit-cleanup-1",
              action: "export.cleanup",
              targetType: "export_job",
              metadata: {
                removeFiles: true
              },
              afterData: {
                exportType: "points",
                cleanupMode: "expire_and_remove_file"
              },
              createdAt: new Date().toISOString()
            }
          ];
        },
        async findFirst() {
          return {
            id: "audit-cleanup-1",
            action: "export.cleanup",
            metadata: {
              removeFiles: true
            },
            afterData: {
              exportType: "points",
              cleanupMode: "expire_and_remove_file"
            },
            createdAt: new Date().toISOString()
          };
        }
      }
    };

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/classes/${CLASS_ID}/exports/summary`
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.latestJob.outputPath, null);
    assert.equal(payload.latestJob.downloadName, path.basename(outputPath));
    assert.equal(payload.latestJob.fileAvailable, true);
    assert.equal(payload.latestJob.fileState, "available");
    assert.equal(payload.latestJob.requestedByUser.displayName, "14班");
    assert.equal(payload.manifestSummary.latestOutputPath, null);
    assert.equal(payload.manifestSummary.latestDownloadName, path.basename(outputPath));
    assert.equal(payload.latestAudit.action, "export.cleanup");
    assert.equal(payload.recentAudits[0].action, "export.cleanup");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /classes/:classId/exports/history sanitizes manifest fallback output path", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-history-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  const manifestPath = path.join(tempDir, "manifest.json");
  const previousManifestPath = process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH;
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;
  process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH = manifestPath;

  try {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        schemaVersion: "classmanager.export.manifest.v1",
        updatedAt: new Date().toISOString(),
        byClass: [],
        items: [
          {
            exportedAt: new Date().toISOString(),
            outputPath,
            classId: CLASS_ID,
            exportType: "points",
            counts: { pointTransactions: 1 },
            filters: null
          }
        ]
      }),
      "utf8"
    );

    const prisma = {
      class: {
        async findUnique() {
          return createClassRecord();
        }
      },
      membership: {
        async findUnique() {
          return {
            id: MEMBERSHIP_ID,
            status: "active",
            roles: []
          };
        }
      },
      exportJob: {
        async findMany() {
          return [];
        }
      },
      auditLog: {
        async findMany() {
          return [];
        }
      }
    };

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/classes/${CLASS_ID}/exports/history`
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.items[0].outputPath, null);
    assert.equal(payload.items[0].downloadName, path.basename(outputPath));
    assert.equal(payload.items[0].fileState, "manifest_only");
    assert.equal(payload.manifestItems[0].outputPath, null);
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    if (previousManifestPath == null) {
      delete process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH;
    } else {
      process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH = previousManifestPath;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /export-jobs/:jobId returns sanitized detail with file state", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-detail-"));
  const outputPath = path.join(tempDir, `${CLASS_ID}-points-all-all.json`);
  process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;

  try {
    fs.writeFileSync(outputPath, JSON.stringify({ ok: true }), "utf8");
    const prisma = {
      class: {
        async findUnique() {
          return createClassRecord();
        }
      },
      membership: {
        async findUnique() {
          return {
            id: MEMBERSHIP_ID,
            status: "active",
            roles: []
          };
        }
      },
      exportJob: {
        async findUnique() {
          return {
            id: JOB_ID,
            tenantId: TENANT_ID,
            classId: CLASS_ID,
            requestedByUserId: USER_ID,
            requestedByMembershipId: MEMBERSHIP_ID,
            requestedByUser: {
              id: USER_ID,
              username: "14ban",
              displayName: "14班"
            },
            jobType: "structured_export",
            exportType: "points",
            filters: {},
            status: "succeeded",
            outputPath,
            manifestEntry: null,
            summary: { pointTransactions: 1 },
            errorMessage: null,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
      }
    };

    const app = await createTestApp(prisma);
    const response = await app.inject({
      method: "GET",
      url: `/api/export-jobs/${JOB_ID}`
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.outputPath, null);
    assert.equal(payload.downloadName, path.basename(outputPath));
    assert.equal(payload.fileState, "available");
    await app.close();
  } finally {
    delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
