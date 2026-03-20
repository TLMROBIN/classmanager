export type StudentStatusOption = {
  value: string;
  label: string;
  participatesInDailyFlow: boolean;
};

export const STUDENT_STATUS_OPTION_PRESETS: StudentStatusOption[] = [
  {
    value: "active",
    label: "在读（active）",
    participatesInDailyFlow: true
  },
  {
    value: "archived",
    label: "已归档（archived）",
    participatesInDailyFlow: false
  },
  {
    value: "graduated",
    label: "已毕业（graduated）",
    participatesInDailyFlow: false
  },
  {
    value: "transferred",
    label: "已转出（transferred）",
    participatesInDailyFlow: false
  }
];

const studentStatusPresetMap = new Map(STUDENT_STATUS_OPTION_PRESETS.map((item) => [item.value, item]));

function normalizeStudentStatusValue(value: string) {
  return value.trim();
}

export function normalizeStudentStatusOptions(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  const normalized: StudentStatusOption[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const row = item as Record<string, unknown>;
    const statusValue = typeof row.value === "string" ? normalizeStudentStatusValue(row.value) : "";
    if (!statusValue || seen.has(statusValue)) {
      continue;
    }

    const preset = studentStatusPresetMap.get(statusValue);
    const label = typeof row.label === "string" ? row.label.trim() : "";
    normalized.push({
      value: statusValue,
      label: label || preset?.label || statusValue,
      participatesInDailyFlow:
        typeof row.participatesInDailyFlow === "boolean"
          ? row.participatesInDailyFlow
          : preset?.participatesInDailyFlow || false
    });
    seen.add(statusValue);
  }

  for (const preset of STUDENT_STATUS_OPTION_PRESETS) {
    if (seen.has(preset.value)) {
      continue;
    }
    normalized.push({ ...preset });
  }

  return normalized;
}

export function getDailyParticipantStatusValues(value: unknown) {
  return normalizeStudentStatusOptions(value)
    .filter((item) => item.participatesInDailyFlow)
    .map((item) => item.value);
}
