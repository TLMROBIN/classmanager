const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const exportDir = path.join(workspaceRoot, "out", "legacy-export");
const outputDir = path.join(workspaceRoot, "out", "review");
const mappingPath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.json");
const mappingTemplatePath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.template.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readOptionalJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return readJson(filePath);
}

function getExportFiles() {
  return fs
    .readdirSync(exportDir)
    .filter((name) => /^\d{4}-.*\.json$/.test(name))
    .map((name) => path.join(exportDir, name));
}

function getScope(user) {
  if (user?.username) return user.username;
  return `user-${user?.id ?? "unknown"}`;
}

function collectUnknownAttendanceNames(source, scopeRules) {
  const students = Array.isArray(source.data?.students?.value) ? source.data.students.value : [];
  const knownNames = new Set(students.map((student) => student.name));
  const attendance = source.data?.attendanceRecords?.value || {};
  const unknownCounts = new Map();

  for (const studentMap of Object.values(attendance)) {
    for (const studentName of Object.keys(studentMap || {})) {
      if (!knownNames.has(studentName)) {
        unknownCounts.set(studentName, (unknownCounts.get(studentName) || 0) + 1);
      }
    }
  }

  return Array.from(unknownCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
    .map(([name, count]) => ({
      name,
      action:
        scopeRules?.[name]?.action === "skip" || scopeRules?.[name]?.action === "map"
          ? scopeRules[name].action
          : "review",
      occurrences: count,
      studentLegacyRef:
        typeof scopeRules?.[name]?.studentLegacyRef === "string" ? scopeRules[name].studentLegacyRef : null,
      note: typeof scopeRules?.[name]?.note === "string" ? scopeRules[name].note : ""
    }));
}

function main() {
  ensureDir(outputDir);

  const files = getExportFiles();
  const mapping = readOptionalJson(mappingPath, {});
  const reviewSummary = {};
  for (const filePath of files) {
    const source = readJson(filePath);
    const scope = getScope(source.user);
    const unknownEntries = collectUnknownAttendanceNames(source, mapping[scope]);
    reviewSummary[scope] = {
      sourceFile: filePath,
      unresolvedCount: unknownEntries.filter((item) => item.action === "review").length,
      names: unknownEntries
    };
  }

  const cleanedTemplate = {};
  for (const [scope, details] of Object.entries(reviewSummary)) {
    const unresolvedItems = details.names.filter((item) => item.action === "review");
    if (unresolvedItems.length === 0) {
      continue;
    }

    cleanedTemplate[scope] = {};
    for (const item of unresolvedItems) {
      cleanedTemplate[scope][item.name] = {
        action: "skip",
        studentLegacyRef: null,
        note: "set action to map and provide studentLegacyRef if this should map to an existing student"
      };
    }
  }

  writeJson(path.join(outputDir, "attendance-name-gaps.json"), reviewSummary);
  writeJson(mappingTemplatePath, cleanedTemplate);

  console.log(`Attendance name gap review written to ${path.join(outputDir, "attendance-name-gaps.json")}`);
  console.log(`Attendance name mapping template written to ${mappingTemplatePath}`);
}

main();
