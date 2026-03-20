const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const exportDir = path.join(workspaceRoot, "out", "legacy-export");
const reviewPath = path.join(workspaceRoot, "out", "review", "attendance-name-gaps.json");
const mappingPath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = { scope: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--scope") {
      args.scope = argv[i + 1] || "";
      i += 1;
    }
  }
  return args;
}

function getExportSources() {
  return fs
    .readdirSync(exportDir)
    .filter((name) => /^\d{4}-.*\.json$/.test(name))
    .map((name) => readJson(path.join(exportDir, name)));
}

function buildScopeStudentRefs(source) {
  const students = Array.isArray(source.data?.students?.value) ? source.data.students.value : [];
  const refs = new Set();
  const names = new Set();
  for (const student of students) {
    refs.add(`student:${student.id}`);
    names.add(student.name);
  }
  return { refs, names };
}

function collectIssuesForScope(scope, rules, reviewSummary, exportIndex) {
  const issues = [];
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    issues.push({ severity: "error", message: `Scope ${scope} must be an object` });
    return issues;
  }

  const reviewScope = reviewSummary[scope];
  const exportScope = exportIndex[scope];
  if (!reviewScope) {
    issues.push({ severity: "warn", message: `Scope ${scope} not found in review summary` });
  }
  if (!exportScope) {
    issues.push({ severity: "error", message: `Scope ${scope} not found in legacy export` });
    return issues;
  }

  const unresolvedNames = new Set((reviewScope?.names || []).map((item) => item.name));
  const { refs, names } = exportScope;

  for (const [name, rule] of Object.entries(rules)) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      issues.push({ severity: "error", message: `Scope ${scope} name ${name} must map to an object rule` });
      continue;
    }

    if (!unresolvedNames.has(name)) {
      issues.push({ severity: "warn", message: `Scope ${scope} name ${name} is not in unresolved review list` });
    }

    if (!["skip", "map"].includes(rule.action)) {
      issues.push({ severity: "error", message: `Scope ${scope} name ${name} has invalid action ${String(rule.action)}` });
      continue;
    }

    if (rule.action === "skip") {
      if (rule.studentLegacyRef != null) {
        issues.push({ severity: "warn", message: `Scope ${scope} name ${name} is skip but still provides studentLegacyRef` });
      }
      continue;
    }

    if (typeof rule.studentLegacyRef !== "string" || rule.studentLegacyRef.length === 0) {
      issues.push({ severity: "error", message: `Scope ${scope} name ${name} uses map but studentLegacyRef is missing` });
      continue;
    }

    if (!refs.has(rule.studentLegacyRef)) {
      issues.push({ severity: "error", message: `Scope ${scope} name ${name} maps to unknown ${rule.studentLegacyRef}` });
    }

    if (names.has(name)) {
      issues.push({ severity: "warn", message: `Scope ${scope} name ${name} already exists in student roster; mapping may be unnecessary` });
    }
  }

  return issues;
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(mappingPath)) {
    throw new Error(`Mapping file not found: ${mappingPath}`);
  }
  if (!fs.existsSync(reviewPath)) {
    throw new Error(`Review summary not found: ${reviewPath}`);
  }

  const mapping = readJson(mappingPath);
  const reviewSummary = readJson(reviewPath);
  const exportIndex = {};
  for (const source of getExportSources()) {
    const scope = source.user?.username || `user-${source.user?.id ?? "unknown"}`;
    exportIndex[scope] = buildScopeStudentRefs(source);
  }

  const scopes = args.scope ? [args.scope] : Object.keys(mapping);
  const allIssues = [];
  for (const scope of scopes) {
    if (!(scope in mapping)) {
      allIssues.push({ severity: "error", message: `Scope ${scope} not found in mapping file` });
      continue;
    }
    allIssues.push(...collectIssuesForScope(scope, mapping[scope], reviewSummary, exportIndex));
  }

  const summary = {
    scopesChecked: scopes.length,
    errors: allIssues.filter((item) => item.severity === "error").length,
    warnings: allIssues.filter((item) => item.severity === "warn").length
  };

  console.log(JSON.stringify(summary, null, 2));
  if (allIssues.length > 0) {
    console.log(allIssues.map((item) => `[${item.severity}] ${item.message}`).join("\n"));
  }

  process.exitCode = summary.errors > 0 ? 1 : 0;
}

main();
