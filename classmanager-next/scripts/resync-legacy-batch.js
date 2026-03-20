const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const workspaceRoot = path.resolve(__dirname, "..");
const exportDir = path.join(workspaceRoot, "out", "legacy-export");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");

function parseArgs(argv) {
  const args = {
    userIds: [],
    usernames: [],
    apply: false,
    allowReview: false,
    skipAttendancePhase2: false,
    continueOnError: false,
    skipExport: false,
    skipTransform: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--user") {
      const value = argv[index + 1] || "";
      if (value) {
        args.userIds.push(value);
      }
      index += 1;
      continue;
    }

    if (token === "--username") {
      const value = argv[index + 1] || "";
      if (value) {
        args.usernames.push(value);
      }
      index += 1;
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

    if (token === "--continue-on-error") {
      args.continueOnError = true;
      continue;
    }

    if (token === "--skip-export") {
      args.skipExport = true;
      continue;
    }

    if (token === "--skip-transform") {
      args.skipTransform = true;
      continue;
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

function buildExportArgs(args) {
  if (args.userIds.length === 1 && args.usernames.length === 0) {
    return ["--user", args.userIds[0]];
  }

  if (args.usernames.length === 1 && args.userIds.length === 0) {
    return ["--username", args.usernames[0]];
  }

  return [];
}

function resolveSelectedEntries(args) {
  const summaryPath = path.join(exportDir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Legacy export summary not found: ${summaryPath}`);
  }

  const summary = readJson(summaryPath);
  const userIdFilter = new Set(args.userIds.map((item) => String(item)));
  const usernameFilter = new Set(args.usernames.map((item) => String(item)));
  const hasFilter = userIdFilter.size > 0 || usernameFilter.size > 0;
  const exportedUsers = Array.isArray(summary.users) ? summary.users : [];
  const users = exportedUsers.filter((user) => {
    if (!hasFilter) {
      return true;
    }
    if (userIdFilter.size > 0 && userIdFilter.has(String(user.id))) {
      return true;
    }
    if (usernameFilter.size > 0 && usernameFilter.has(String(user.username || ""))) {
      return true;
    }
    return false;
  });

  if (users.length === 0) {
    throw new Error("No exported users matched the requested filters");
  }

  return users.map((user) => {
    const safeUsername = sanitizeFilename(user.username || `user-${user.id}`);
    return {
      user,
      exportFile: path.join(exportDir, `${String(user.id).padStart(4, "0")}-${safeUsername}.json`),
      normalizedFile: path.join(normalizedDir, `${String(user.id).padStart(4, "0")}-${safeUsername}.normalized.json`),
      skippedNormalized: false,
      skipReason: ""
    };
  });
}

function ensureFilesExist(entries, key) {
  for (const entry of entries) {
    if (key === "normalizedFile" && entry.skippedNormalized) {
      continue;
    }
    if (!fs.existsSync(entry[key])) {
      throw new Error(`Required file not found: ${entry[key]}`);
    }
  }
}

function readTransformSummary() {
  const summaryPath = path.join(normalizedDir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    return null;
  }
  return readJson(summaryPath);
}

function buildTransformSummaryByUserId() {
  const transformSummary = readTransformSummary();
  const transformFiles = Array.isArray(transformSummary?.files) ? transformSummary.files : [];
  return new Map(
    transformFiles
      .filter((item) => item?.summary?.userId != null)
      .map((item) => [String(item.summary.userId), item.summary])
  );
}

function applyTransformSummary(entries, transformSummaryByUserId) {
  for (const entry of entries) {
    const summary = transformSummaryByUserId.get(String(entry.user.id));
    entry.skippedNormalized = Boolean(summary?.skipped);
    entry.skipReason = summary?.skipReason || "";
  }
}

function refreshMissingNormalizedEntries(entries) {
  const pendingEntries = entries.filter((entry) => !entry.skippedNormalized && !fs.existsSync(entry.normalizedFile));

  for (const entry of pendingEntries) {
    console.log(
      `Normalized snapshot missing for user ${entry.user.id} (${entry.user.username || "unknown"}); refreshing transform output`
    );
    runNodeScript("transform-legacy-user.js", ["--input", entry.exportFile]);

    if (fs.existsSync(entry.normalizedFile)) {
      continue;
    }

    const summary = buildTransformSummaryByUserId().get(String(entry.user.id));
    if (summary?.skipped) {
      entry.skippedNormalized = true;
      entry.skipReason = summary.skipReason || "no importable class data";
      continue;
    }

    throw new Error(`Required file not found: ${entry.normalizedFile}`);
  }
}

function createStepLogger(args) {
  const total = (args.skipExport ? 0 : 1) + (args.skipTransform ? 0 : 1) + 1;
  let current = 0;

  return (label) => {
    current += 1;
    console.log(`[${current}/${total}] ${label}`);
  };
}

function main() {
  const args = parseArgs(process.argv);
  const logStep = createStepLogger(args);

  if (!args.skipExport) {
    const exportArgs = buildExportArgs(args);
    logStep("Exporting legacy data");
    runNodeScript("export-legacy-data.js", exportArgs);
  }

  const entries = resolveSelectedEntries(args);
  ensureFilesExist(entries, "exportFile");

  if (!args.skipTransform) {
    logStep("Transforming legacy exports");
    if (entries.length === 1) {
      runNodeScript("transform-legacy-user.js", ["--input", entries[0].exportFile]);
    } else {
      runNodeScript("transform-legacy-user.js", ["--all"]);
    }
  }

  applyTransformSummary(entries, buildTransformSummaryByUserId());

  if (args.skipTransform) {
    refreshMissingNormalizedEntries(entries);
  }

  ensureFilesExist(entries, "normalizedFile");

  logStep("Loading normalized data");
  const results = [];

  for (const entry of entries) {
    if (entry.skippedNormalized) {
      results.push({
        user: {
          id: entry.user.id,
          username: entry.user.username || null
        },
        tenantSlug: null,
        normalizedFile: null,
        safeSubset: "skipped_shell_only",
        attendancePhase2: "skipped_shell_only",
        error: null,
        skipReason: entry.skipReason
      });
      continue;
    }

    const normalized = readJson(entry.normalizedFile);
    const tenantSlug = normalized?.tenant?.slug;
    if (!tenantSlug) {
      throw new Error(`Normalized file is missing tenant.slug: ${entry.normalizedFile}`);
    }

    const result = {
      user: {
        id: entry.user.id,
        username: entry.user.username || null
      },
      tenantSlug,
      normalizedFile: entry.normalizedFile,
      safeSubset: "pending",
      attendancePhase2: args.skipAttendancePhase2 ? "skipped" : "pending",
      error: null
    };

    try {
      const safeSubsetArgs = ["--input", entry.normalizedFile];
      if (args.allowReview) {
        safeSubsetArgs.push("--allow-review");
      }
      if (args.apply) {
        safeSubsetArgs.push("--apply", "--confirm", `SAFE_SUBSET:${tenantSlug}`);
      }
      runNodeScript("load-safe-subset.js", safeSubsetArgs);
      result.safeSubset = args.apply ? "applied" : "dry-run";

      if (!args.skipAttendancePhase2) {
        const attendanceArgs = ["--input", entry.normalizedFile];
        if (args.apply) {
          attendanceArgs.push("--apply", "--confirm", `ATTENDANCE_PHASE2:${tenantSlug}`);
        }
        runNodeScript("load-attendance-phase2.js", attendanceArgs);
        result.attendancePhase2 = args.apply ? "applied" : "dry-run";
      }
    } catch (error) {
      result.safeSubset = result.safeSubset === "pending" ? "failed" : result.safeSubset;
      if (!args.skipAttendancePhase2 && result.attendancePhase2 === "pending") {
        result.attendancePhase2 = "failed";
      }
      result.error = error instanceof Error ? error.message : String(error);
      results.push(result);

      if (!args.continueOnError) {
        console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", results }, null, 2));
        throw error;
      }
      continue;
    }

    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        filters: {
          userIds: args.userIds,
          usernames: args.usernames
        },
        options: {
          allowReview: args.allowReview,
          skipAttendancePhase2: args.skipAttendancePhase2,
          continueOnError: args.continueOnError,
          skipExport: args.skipExport,
          skipTransform: args.skipTransform
        },
        results
      },
      null,
      2
    )
  );
}

main();
