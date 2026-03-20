const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const workspaceRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(workspaceRoot, "out", "structured-exports", "manifest.json");

function parseArgs(argv) {
  const args = {
    apply: false,
    removeFiles: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--remove-files") {
      args.removeFiles = true;
    }
  }

  return args;
}

function readManifest() {
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

function rebuildManifest(items) {
  const byClassMap = new Map();
  for (const item of items) {
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

  return {
    schemaVersion: "classmanager.export.manifest.v1",
    updatedAt: new Date().toISOString(),
    byClass: Array.from(byClassMap.values()).sort((left, right) => {
      return new Date(right.latestExportedAt).getTime() - new Date(left.latestExportedAt).getTime();
    }),
    items
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const prisma = new PrismaClient();

  try {
    const now = new Date();
    const expiredJobs = await prisma.exportJob.findMany({
      where: {
        status: "succeeded",
        expiresAt: {
          lt: now
        }
      },
      orderBy: {
        expiresAt: "asc"
      },
      select: {
        id: true,
        tenantId: true,
        classId: true,
        exportType: true,
        outputPath: true,
        expiresAt: true
      }
    });

    const manifest = readManifest();
    const expiredPaths = new Set(expiredJobs.map((item) => item.outputPath).filter(Boolean));
    const nextManifestItems = (manifest.items || []).filter((item) => !expiredPaths.has(item.outputPath));

    if (args.apply) {
      if (expiredJobs.length > 0) {
        await prisma.exportJob.updateMany({
          where: {
            id: {
              in: expiredJobs.map((item) => item.id)
            }
          },
          data: {
            status: "expired"
          }
        });

        for (const job of expiredJobs) {
          await prisma.auditLog.create({
            data: {
              tenantId: job.tenantId,
              classId: job.classId,
              action: "export.cleanup",
              targetType: "export_job",
              targetId: job.id,
              afterData: {
                exportType: job.exportType,
                cleanupMode: args.removeFiles ? "expire_and_remove_file" : "expire_only"
              },
              metadata: {
                outputPath: job.outputPath,
                expiresAt: job.expiresAt,
                removeFiles: args.removeFiles
              }
            }
          });
        }
      }

      if (args.removeFiles) {
        for (const job of expiredJobs) {
          if (job.outputPath && fs.existsSync(job.outputPath)) {
            fs.unlinkSync(job.outputPath);
          }
        }
      }

      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(rebuildManifest(nextManifestItems), null, 2));
    }

    console.log(
      JSON.stringify(
        {
          mode: args.apply ? "apply" : "dry-run",
          removeFiles: args.removeFiles,
          expiredJobs: expiredJobs.map((item) => ({
            id: item.id,
            classId: item.classId,
            exportType: item.exportType,
            outputPath: item.outputPath,
            expiresAt: item.expiresAt
          })),
          manifestItemsBefore: (manifest.items || []).length,
          manifestItemsAfter: nextManifestItems.length
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
