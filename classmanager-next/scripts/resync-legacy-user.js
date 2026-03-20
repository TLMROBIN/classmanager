const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const workspaceRoot = path.resolve(__dirname, "..");
const exportDir = path.join(workspaceRoot, "out", "legacy-export");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");

function parseArgs(argv) {
  const args = {
    userId: "",
    username: "",
    apply: false,
    allowReview: false,
    skipAttendancePhase2: false,
    skipExport: false,
    skipTransform: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--user") {
      args.userId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--username") {
      args.username = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--allow-review") {
      args.allowReview = true;
      continue;
    }
    if (token === "--skip-attendance-phase2") {
      args.skipAttendancePhase2 = true;
      continue;
    }
    if (token === "--skip-export") {
      args.skipExport = true;
      continue;
    }
    if (token === "--skip-transform") {
      args.skipTransform = true;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sanitizeFilename(input) {
  return String(input || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function runNodeScript(scriptName, scriptArgs) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}

function resolveExportedEntry(args) {
  const summaryPath = path.join(exportDir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Legacy export summary not found: ${summaryPath}`);
  }

  const summary = readJson(summaryPath);
  const exportedUsers = Array.isArray(summary.users) ? summary.users : [];
  const users = exportedUsers.filter((user) => {
    if (args.userId && String(user.id) !== String(args.userId)) {
      return false;
    }
    if (args.username && String(user.username || "") !== String(args.username)) {
      return false;
    }
    return true;
  });

  if (users.length === 0) {
    throw new Error("No exported user matched the requested --user/--username filter");
  }
  if (users.length > 1) {
    throw new Error("Resync requires exactly one exported user after filtering");
  }

  const user = users[0];
  const safeUsername = sanitizeFilename(user.username || `user-${user.id}`);
  return {
    user,
    exportFile: path.join(exportDir, `${String(user.id).padStart(4, "0")}-${safeUsername}.json`),
    normalizedFile: path.join(normalizedDir, `${String(user.id).padStart(4, "0")}-${safeUsername}.normalized.json`)
  };
}

function readTransformSummary() {
  const summaryPath = path.join(normalizedDir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    return null;
  }
  return readJson(summaryPath);
}

function resolveTransformSummaryEntry(userId) {
  const summary = readTransformSummary();
  const files = Array.isArray(summary?.files) ? summary.files : [];
  return files.find((item) => String(item?.summary?.userId) === String(userId)) || null;
}

function createStepLogger(args) {
  const total =
    (args.skipExport ? 0 : 1) +
    (args.skipTransform ? 0 : 1) +
    1 +
    (args.skipAttendancePhase2 ? 0 : 1);
  let current = 0;

  return (label) => {
    current += 1;
    console.log(`[${current}/${total}] ${label}`);
  };
}

function printSkippedResult(args, entry, reason) {
  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        user: {
          id: entry.user.id,
          username: entry.user.username || null
        },
        files: {
          exportFile: entry.exportFile,
          normalizedFile: null
        },
        skipped: {
          shellOnly: true,
          reason
        },
        skipExport: args.skipExport,
        skipTransform: args.skipTransform,
        skipAttendancePhase2: true
      },
      null,
      2
    )
  );
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.userId && !args.username) {
    throw new Error("Use --user <legacyId> or --username <legacyUsername>");
  }

  const exportArgs = [];
  if (args.userId) {
    exportArgs.push("--user", args.userId);
  }
  if (args.username) {
    exportArgs.push("--username", args.username);
  }

  const logStep = createStepLogger(args);

  if (!args.skipExport) {
    logStep("Exporting legacy data");
    runNodeScript("export-legacy-data.js", exportArgs);
  }

  const entry = resolveExportedEntry(args);
  if (!fs.existsSync(entry.exportFile)) {
    throw new Error(`Export file not found: ${entry.exportFile}`);
  }

  if (!args.skipTransform) {
    logStep("Transforming legacy export");
    runNodeScript("transform-legacy-user.js", ["--input", entry.exportFile]);
  }

  if (!fs.existsSync(entry.normalizedFile)) {
    let transformEntry = resolveTransformSummaryEntry(entry.user.id);
    if (transformEntry?.summary?.skipped) {
      printSkippedResult(args, entry, transformEntry.summary.skipReason || "no importable class data");
      return;
    }

    if (args.skipTransform) {
      console.log("Normalized snapshot missing; refreshing transform output for requested user");
      runNodeScript("transform-legacy-user.js", ["--input", entry.exportFile]);
      transformEntry = resolveTransformSummaryEntry(entry.user.id);
      if (transformEntry?.summary?.skipped) {
        printSkippedResult(args, entry, transformEntry.summary.skipReason || "no importable class data");
        return;
      }
    }

    if (!fs.existsSync(entry.normalizedFile)) {
      throw new Error(`Normalized file not found: ${entry.normalizedFile}`);
    }
  }

  const normalized = readJson(entry.normalizedFile);
  const tenantSlug = normalized?.tenant?.slug;
  if (!tenantSlug) {
    throw new Error("Normalized file is missing tenant.slug");
  }

  const safeSubsetArgs = ["--input", entry.normalizedFile];
  if (args.allowReview) {
    safeSubsetArgs.push("--allow-review");
  }
  if (args.apply) {
    safeSubsetArgs.push("--apply", "--confirm", `SAFE_SUBSET:${tenantSlug}`);
  }

  logStep("Loading safe subset");
  runNodeScript("load-safe-subset.js", safeSubsetArgs);

  if (!args.skipAttendancePhase2) {
    const attendanceArgs = ["--input", entry.normalizedFile];
    if (args.apply) {
      attendanceArgs.push("--apply", "--confirm", `ATTENDANCE_PHASE2:${tenantSlug}`);
    }

    logStep("Loading attendance phase2");
    runNodeScript("load-attendance-phase2.js", attendanceArgs);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        user: {
          id: entry.user.id,
          username: entry.user.username || null
        },
        files: {
          exportFile: entry.exportFile,
          normalizedFile: entry.normalizedFile
        },
        skipExport: args.skipExport,
        skipTransform: args.skipTransform,
        skipAttendancePhase2: args.skipAttendancePhase2
      },
      null,
      2
    )
  );
}

main();
