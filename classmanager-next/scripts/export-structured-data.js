const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(workspaceRoot, "out", "structured-exports");
const manifestPath = path.join(outputDir, "manifest.json");

function parseArgs(argv) {
  const args = {
    apiBase: process.env.API_BASE || "http://127.0.0.1:4010/api",
    username: "",
    password: "",
    classId: "",
    domain: "full",
    dateFrom: "",
    dateTo: "",
    output: ""
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--api-base") {
      args.apiBase = argv[i + 1] || args.apiBase;
      i += 1;
      continue;
    }
    if (token === "--username") {
      args.username = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--password") {
      args.password = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--class-id") {
      args.classId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--domain") {
      args.domain = argv[i + 1] || "full";
      i += 1;
      continue;
    }
    if (token === "--date-from") {
      args.dateFrom = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--date-to") {
      args.dateTo = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--output") {
      args.output = argv[i + 1] || "";
      i += 1;
    }
  }

  return args;
}

async function ensureOk(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response;
}

function buildOutputPath(args) {
  if (args.output) {
    return path.isAbsolute(args.output) ? args.output : path.resolve(process.cwd(), args.output);
  }

  const suffix = [args.domain, args.dateFrom || "all", args.dateTo || "all"].join("-");
  return path.join(outputDir, `${args.classId}-${suffix}.json`);
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

function writeManifest(entry) {
  const manifest = readManifest();
  const nextItems = [entry, ...(manifest.items || [])]
    .filter((item, index, list) => index === list.findIndex((candidate) => candidate.outputPath === item.outputPath))
    .slice(0, 200);

  const byClassMap = new Map();
  for (const item of nextItems) {
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

  const nextManifest = {
    schemaVersion: "classmanager.export.manifest.v1",
    updatedAt: new Date().toISOString(),
    byClass: Array.from(byClassMap.values()).sort((left, right) => {
      return new Date(right.latestExportedAt).getTime() - new Date(left.latestExportedAt).getTime();
    }),
    items: nextItems
  };

  fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
}

async function login(apiBase, username, password) {
  const response = await ensureOk(
    await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username, password })
    })
  );

  return response.json();
}

async function fetchExport(apiBase, token, args) {
  const search = new URLSearchParams();
  if (args.domain) search.set("domain", args.domain);
  if (args.dateFrom) search.set("dateFrom", args.dateFrom);
  if (args.dateTo) search.set("dateTo", args.dateTo);

  const response = await ensureOk(
    await fetch(`${apiBase}/classes/${args.classId}/exports/structured?${search.toString()}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    })
  );

  return response.json();
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.username || !args.password || !args.classId) {
    throw new Error("Use --username <username> --password <password> --class-id <uuid>");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const session = await login(args.apiBase, args.username, args.password);
  const data = await fetchExport(args.apiBase, session.accessToken, args);
  const outputPath = buildOutputPath(args);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  writeManifest({
    exportedAt: data.exportedAt || new Date().toISOString(),
    outputPath,
    apiBase: args.apiBase,
    classId: args.classId,
    exportType: data.exportType,
    counts: data.counts,
    filters: data.filters || null
  });

  console.log(
    JSON.stringify(
      {
        outputPath,
        exportType: data.exportType,
        counts: data.counts,
        filters: data.filters || null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
