const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = { input: "", apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    throw new Error("Use --input <normalized-file>");
  }

  const filePath = path.isAbsolute(args.input) ? args.input : path.join(normalizedDir, args.input);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Normalized file not found: ${filePath}`);
  }

  const data = readJson(filePath);
  const plan = {
    mode: args.apply ? "apply" : "dry-run",
    filePath,
    tenant: data.tenant,
    class: data.class,
    counts: {
      groups: (data.groups || []).length,
      dormitories: (data.dormitories || []).length,
      positions: (data.positions || []).length,
      students: (data.students || []).length,
      studentProfiles: (data.studentProfiles || []).length,
      pointAccounts: (data.pointAccounts || []).length,
      pointReasonTemplates: (data.pointReasonTemplates || []).length,
      pointTransactions: (data.pointTransactions || []).length,
      attendanceSchedules: (data.attendanceSchedules || []).length,
      attendanceSessions: (data.attendanceSessions || []).length,
      attendanceRecords: (data.attendanceRecords || []).length
    },
    note: args.apply
      ? "Apply mode is intentionally not implemented yet. Add database writes only after validator passes and transactional safeguards are added."
      : "Dry-run only. No database writes performed."
  };

  console.log(JSON.stringify(plan, null, 2));

  if (args.apply) {
    console.error("Refusing to write database: apply mode is not implemented yet.");
    process.exitCode = 2;
  }
}

main();
