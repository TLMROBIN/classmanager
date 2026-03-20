import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildExportOutputPath, readExportManifest, writeExportManifest } from "./service.js";

function withTempExportPaths(fn: (tempDir: string) => void | Promise<void>) {
  return async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmanager-export-test-"));
    const manifestPath = path.join(tempDir, "manifest.json");
    const previousOutputDir = process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
    const previousManifestPath = process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH;

    process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = tempDir;
    process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH = manifestPath;

    try {
      await fn(tempDir);
    } finally {
      if (previousOutputDir == null) {
        delete process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR;
      } else {
        process.env.CLASSMANAGER_EXPORT_OUTPUT_DIR = previousOutputDir;
      }

      if (previousManifestPath == null) {
        delete process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH;
      } else {
        process.env.CLASSMANAGER_EXPORT_MANIFEST_PATH = previousManifestPath;
      }

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

test(
  "buildExportOutputPath uses export type and date range in filename",
  withTempExportPaths((tempDir) => {
    const outputPath = buildExportOutputPath("class-1", "points", {
      dateFrom: "2026-03-08",
      dateTo: "2026-03-09"
    });

    assert.equal(outputPath, path.join(tempDir, "class-1-points-2026-03-08-2026-03-09.json"));
  })
);

test(
  "writeExportManifest deduplicates by output path and keeps latest by class summary",
  withTempExportPaths(() => {
    writeExportManifest({
      exportedAt: "2026-03-09T10:00:00.000Z",
      outputPath: "/tmp/a.json",
      classId: "class-1",
      exportType: "points",
      counts: { pointTransactions: 10 },
      filters: { dateFrom: "2026-03-08", dateTo: "2026-03-09" }
    });

    writeExportManifest({
      exportedAt: "2026-03-09T11:00:00.000Z",
      outputPath: "/tmp/b.json",
      classId: "class-1",
      exportType: "attendance",
      counts: { attendanceSessions: 3, attendanceRecords: 84 },
      filters: { dateFrom: "2026-03-05", dateTo: "2026-03-05" }
    });

    writeExportManifest({
      exportedAt: "2026-03-09T09:00:00.000Z",
      outputPath: "/tmp/a.json",
      classId: "class-1",
      exportType: "points",
      counts: { pointTransactions: 9 },
      filters: { dateFrom: "2026-03-07", dateTo: "2026-03-08" }
    });

    const manifest = readExportManifest();
    assert.equal(manifest.items.length, 2);
    assert.equal(manifest.byClass.length, 1);
    assert.equal(manifest.byClass[0].classId, "class-1");
    assert.equal(manifest.byClass[0].latestOutputPath, "/tmp/b.json");
    assert.equal(manifest.byClass[0].latestExportType, "attendance");
    assert.equal(manifest.byClass[0].totalExports, 2);
    assert.deepEqual(manifest.byClass[0].exportTypes, {
      attendance: 1,
      points: 1
    });
  })
);
