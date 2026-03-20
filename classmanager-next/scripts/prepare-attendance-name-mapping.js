const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const templatePath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.template.json");
const mappingPath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function parseArgs(argv) {
  const args = {
    scope: "",
    write: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--scope") {
      args.scope = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--write") {
      args.write = true;
    }
  }

  return args;
}

function cloneRule(rule) {
  return {
    action: rule.action,
    studentLegacyRef: rule.studentLegacyRef ?? null,
    note: rule.note || ""
  };
}

function mergeTemplateIntoMapping(template, mapping, scopeFilter) {
  const nextMapping = JSON.parse(JSON.stringify(mapping || {}));
  const report = [];

  const scopes = scopeFilter ? [scopeFilter] : Object.keys(template);
  for (const scope of scopes) {
    const templateScope = template[scope];
    if (!templateScope) {
      throw new Error(`Scope not found in template: ${scope}`);
    }

    if (!nextMapping[scope] || typeof nextMapping[scope] !== "object" || Array.isArray(nextMapping[scope])) {
      nextMapping[scope] = {};
    }

    let added = 0;
    let preserved = 0;
    for (const [name, rule] of Object.entries(templateScope)) {
      if (nextMapping[scope][name]) {
        preserved += 1;
        continue;
      }
      nextMapping[scope][name] = cloneRule(rule);
      added += 1;
    }

    report.push({
      scope,
      totalTemplateEntries: Object.keys(templateScope).length,
      added,
      preserved,
      finalCount: Object.keys(nextMapping[scope]).length
    });
  }

  return { nextMapping, report };
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  const template = readJson(templatePath);
  const mapping = fs.existsSync(mappingPath) ? readJson(mappingPath) : {};
  const { nextMapping, report } = mergeTemplateIntoMapping(template, mapping, args.scope);

  if (args.write) {
    writeJson(mappingPath, nextMapping);
    console.log(`Attendance name mapping updated: ${mappingPath}`);
  } else {
    console.log("Dry-run only. Re-run with --write to persist changes.");
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
