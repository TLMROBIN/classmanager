const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");
const policyPath = path.join(__dirname, "migration-warning-policy.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = { input: "", all: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      args.all = true;
      continue;
    }
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
    }
  }
  return args;
}

function getSourceFiles(args) {
  if (args.all) {
    return fs
      .readdirSync(normalizedDir)
      .filter((name) => name.endsWith(".normalized.json"))
      .map((name) => path.join(normalizedDir, name));
  }

  if (args.input) {
    const target = path.isAbsolute(args.input) ? args.input : path.join(normalizedDir, args.input);
    if (!fs.existsSync(target)) {
      throw new Error(`Normalized file not found: ${target}`);
    }
    return [target];
  }

  throw new Error("Use --all or --input <file>");
}

function addIssue(issues, severity, code, message) {
  issues.push({ severity, code, message });
}

function loadPolicy() {
  return readJson(policyPath);
}

function classifyIssue(policy, issue) {
  for (const rule of policy.rules || []) {
    if (rule.matchType === "code" && issue.code === rule.pattern) {
      return { severity: rule.severity, action: rule.action };
    }
    if (rule.matchType === "message_contains" && issue.message.includes(rule.pattern)) {
      return { severity: rule.severity, action: rule.action };
    }
  }
  return { severity: issue.severity, action: "none" };
}

function validateData(data, filePath = "<memory>") {
  const issues = [];

  const studentRefs = new Set((data.students || []).map((item) => item.legacyRef));
  const groupKeys = new Set((data.groups || []).map((item) => item.legacyKey));
  const dormKeys = new Set((data.dormitories || []).map((item) => item.legacyKey));
  const positionKeys = new Set((data.positions || []).map((item) => item.legacyKey));
  const scheduleCodes = new Set((data.attendanceSchedules || []).map((item) => item.code));
  const sessionKeys = new Set((data.attendanceSessions || []).map((item) => item.legacyKey));
  const hasStudentLinkedData =
    (data.studentProfiles || []).length > 0 ||
    (data.studentGroupAssignments || []).length > 0 ||
    (data.studentDormAssignments || []).length > 0 ||
    (data.studentPositionAssignments || []).length > 0 ||
    (data.pointAccounts || []).length > 0 ||
    (data.pointTransactions || []).length > 0 ||
    (data.attendanceRecords || []).length > 0;

  if (!data.tenant?.slug) addIssue(issues, "error", "tenant.slug.missing", "Tenant slug missing");
  if (!data.class?.name) addIssue(issues, "error", "class.name.missing", "Class name missing");
  if ((data.students || []).length === 0) {
    addIssue(
      issues,
      hasStudentLinkedData ? "error" : "review",
      "students.empty",
      hasStudentLinkedData ? "No students normalized" : "No students normalized; review before importing shell-only class data"
    );
  }

  const duplicateStudentRefs = new Set();
  for (const ref of (data.students || []).map((item) => item.legacyRef)) {
    if ([...studentRefs].filter((item) => item === ref).length > 1) {
      duplicateStudentRefs.add(ref);
    }
  }
  for (const ref of duplicateStudentRefs) {
    addIssue(issues, "error", "student.duplicate_ref", `Duplicate student ref: ${ref}`);
  }

  for (const item of data.pointAccounts || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "pointAccount.missing_student", `Missing student for point account ${item.studentLegacyRef}`);
    }
  }

  for (const item of data.studentGroupAssignments || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "groupAssignment.missing_student", `Missing student for group assignment ${item.studentLegacyRef}`);
    }
    if (!groupKeys.has(item.groupLegacyKey)) {
      addIssue(issues, "error", "groupAssignment.missing_group", `Missing group ${item.groupLegacyKey}`);
    }
  }

  for (const item of data.studentDormAssignments || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "dormAssignment.missing_student", `Missing student for dorm assignment ${item.studentLegacyRef}`);
    }
    if (!dormKeys.has(item.dormLegacyKey)) {
      addIssue(issues, "error", "dormAssignment.missing_dorm", `Missing dorm ${item.dormLegacyKey}`);
    }
  }

  for (const item of data.studentPositionAssignments || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "positionAssignment.missing_student", `Missing student for position assignment ${item.studentLegacyRef}`);
    }
    if (!positionKeys.has(item.positionLegacyKey)) {
      addIssue(issues, "error", "positionAssignment.missing_position", `Missing position ${item.positionLegacyKey}`);
    }
  }

  for (const item of data.pointTransactions || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "pointTransaction.missing_student", `Missing student for point transaction ${item.legacyNumericId}`);
    }
    if (!item.occurredAt) {
      addIssue(issues, "warn", "pointTransaction.missing_time", `Missing occurredAt for point transaction ${item.legacyNumericId}`);
    }
  }

  for (const item of data.attendanceSessions || []) {
    if (!scheduleCodes.has(item.sessionCode)) {
      addIssue(issues, "warn", "attendanceSession.missing_schedule", `No schedule config for session code ${item.sessionCode}`);
    }
  }

  const attendancePolicy =
    data.attendancePolicy && typeof data.attendancePolicy === "object" && !Array.isArray(data.attendancePolicy)
      ? data.attendancePolicy
      : {};
  const weekendRules =
    attendancePolicy.weekendRules && typeof attendancePolicy.weekendRules === "object" && !Array.isArray(attendancePolicy.weekendRules)
      ? attendancePolicy.weekendRules
      : {};
  for (const [weekday, rawCodes] of Object.entries(weekendRules)) {
    if (!Array.isArray(rawCodes)) {
      addIssue(issues, "error", "attendancePolicy.weekend_rule_invalid", `Weekend rule ${weekday} is not an array`);
      continue;
    }
    for (const rawCode of rawCodes) {
      const scheduleCode = typeof rawCode === "string" ? rawCode.trim() : "";
      if (!scheduleCode || !scheduleCodes.has(scheduleCode)) {
        addIssue(
          issues,
          "error",
          "attendancePolicy.weekend_rule_missing_schedule",
          `Weekend rule ${weekday} references invalid schedule ${String(rawCode)}`
        );
      }
    }
  }

  const specialRules =
    attendancePolicy.specialRules && typeof attendancePolicy.specialRules === "object" && !Array.isArray(attendancePolicy.specialRules)
      ? attendancePolicy.specialRules
      : {};
  const sundaySpecialLateTime =
    specialRules.sundaySpecialLateTime &&
    typeof specialRules.sundaySpecialLateTime === "object" &&
    !Array.isArray(specialRules.sundaySpecialLateTime)
      ? specialRules.sundaySpecialLateTime
      : null;
  if (sundaySpecialLateTime) {
    for (const [rawCode, rawTime] of Object.entries(sundaySpecialLateTime)) {
      const scheduleCode = rawCode.trim();
      if (!scheduleCode || !scheduleCodes.has(scheduleCode)) {
        addIssue(
          issues,
          "error",
          "attendancePolicy.special_rule_missing_schedule",
          `Sunday special late time references invalid schedule ${rawCode}`
        );
      }
      if (typeof rawTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime.trim())) {
        addIssue(
          issues,
          "error",
          "attendancePolicy.special_rule_invalid_time",
          `Sunday special late time for ${rawCode} is invalid: ${String(rawTime)}`
        );
      }
    }
  }

  for (const item of data.attendanceRecords || []) {
    if (!studentRefs.has(item.studentLegacyRef)) {
      addIssue(issues, "error", "attendanceRecord.missing_student", `Missing student for attendance record ${item.legacyStudentName}`);
    }
    if (!sessionKeys.has(item.sessionLegacyKey)) {
      addIssue(issues, "error", "attendanceRecord.missing_session", `Missing session ${item.sessionLegacyKey}`);
    }
  }

  for (const warning of data.warnings || []) {
    addIssue(issues, "warn", "normalizer.warning", warning);
  }

  const summary = {
    filePath,
    students: (data.students || []).length,
    pointTransactions: (data.pointTransactions || []).length,
    attendanceSessions: (data.attendanceSessions || []).length,
    attendanceRecords: (data.attendanceRecords || []).length,
    errors: issues.filter((item) => item.severity === "error").length,
    warnings: issues.filter((item) => item.severity === "warn").length
  };

  return { summary, issues };
}

function validateFile(filePath) {
  const data = readJson(filePath);
  return validateData(data, filePath);
}

function main() {
  const args = parseArgs(process.argv);
  const files = getSourceFiles(args);
  const policy = loadPolicy();
  const reports = files.map(validateFile);

  for (const report of reports) {
    const classifiedIssues = report.issues.map((issue) => ({
      ...issue,
      policy: classifyIssue(policy, issue)
    }));
    const warnings = classifiedIssues.filter((issue) => issue.policy.severity === "warn").length;
    const blockers = classifiedIssues.filter((issue) => issue.policy.severity === "blocker").length;
    const reviews = classifiedIssues.filter((issue) => issue.policy.severity === "review").length;
    const infos = classifiedIssues.filter((issue) => issue.policy.severity === "info").length;
    console.log(JSON.stringify({ ...report.summary, warnings, rawWarnings: report.summary.warnings, blockers, reviews, infos }, null, 2));
    const topIssues = classifiedIssues.slice(0, 40);
    if (topIssues.length > 0) {
      console.log(
        topIssues
          .map(
            (item) =>
              `[${item.policy.severity}] ${item.code}: ${item.message} -> ${item.policy.action}`
          )
          .join("\n")
      );
    }
  }

  const hasError = reports.some((report) =>
    report.issues.some((issue) => issue.severity === "error")
  );
  const hasBlocker = reports.some((report) =>
    report.issues.some((issue) => classifyIssue(policy, issue).severity === "blocker")
  );
  process.exitCode = hasError || hasBlocker ? 1 : 0;
}

module.exports = {
  validateData,
  validateFile,
  loadPolicy,
  classifyIssue
};

if (require.main === module) {
  main();
}
