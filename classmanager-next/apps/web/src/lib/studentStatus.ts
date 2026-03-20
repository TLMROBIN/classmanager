import type { StudentStatusOptionItem } from "../types";

export const STUDENT_STATUS_PRESET_OPTIONS: StudentStatusOptionItem[] = [
  { value: "active", label: "在读（active）", participatesInDailyFlow: true },
  { value: "archived", label: "已归档（archived）", participatesInDailyFlow: false },
  { value: "graduated", label: "已毕业（graduated）", participatesInDailyFlow: false },
  { value: "transferred", label: "已转出（transferred）", participatesInDailyFlow: false }
];

export const STUDENT_STATUS_PRESET_VALUES = new Set(STUDENT_STATUS_PRESET_OPTIONS.map((item) => item.value));

const presetByValue = new Map(STUDENT_STATUS_PRESET_OPTIONS.map((item) => [item.value, item]));

function normalizeStatusValue(value: string) {
  return value.trim();
}

export function isStudentStatusPreset(value: string) {
  return STUDENT_STATUS_PRESET_VALUES.has(normalizeStatusValue(value));
}

export function buildStudentStatusOptions(
  configuredOptions: StudentStatusOptionItem[] | null | undefined,
  observedStatuses: string[] = []
) {
  const normalized: StudentStatusOptionItem[] = [];
  const seen = new Set<string>();

  for (const item of configuredOptions || []) {
    const value = normalizeStatusValue(item.value);
    if (!value || seen.has(value)) {
      continue;
    }
    const preset = presetByValue.get(value);
    normalized.push({
      value,
      label: item.label?.trim() || preset?.label || value,
      participatesInDailyFlow:
        typeof item.participatesInDailyFlow === "boolean"
          ? item.participatesInDailyFlow
          : preset?.participatesInDailyFlow || false
    });
    seen.add(value);
  }

  for (const preset of STUDENT_STATUS_PRESET_OPTIONS) {
    if (seen.has(preset.value)) {
      continue;
    }
    normalized.push({ ...preset });
    seen.add(preset.value);
  }

  const customObserved = Array.from(
    new Set(observedStatuses.map((item) => normalizeStatusValue(item)).filter(Boolean))
  )
    .filter((item) => !seen.has(item))
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((value) => ({
      value,
      label: value,
      participatesInDailyFlow: false
    }));

  return [...normalized, ...customObserved];
}

export function getStudentStatusOption(
  status: string,
  configuredOptions?: StudentStatusOptionItem[] | null
) {
  const normalizedStatus = normalizeStatusValue(status);
  if (!normalizedStatus) {
    return null;
  }

  return buildStudentStatusOptions(configuredOptions).find((item) => item.value === normalizedStatus) || null;
}

export function getStudentStatusLabel(
  status: string,
  configuredOptions?: StudentStatusOptionItem[] | null
) {
  return getStudentStatusOption(status, configuredOptions)?.label || normalizeStatusValue(status) || "-";
}

export function isStudentDailyParticipant(
  status: string,
  configuredOptions?: StudentStatusOptionItem[] | null
) {
  return getStudentStatusOption(status, configuredOptions)?.participatesInDailyFlow || false;
}

export function summarizeStudentStatuses(
  statuses: string[],
  configuredOptions?: StudentStatusOptionItem[] | null
) {
  const counts = statuses.reduce(
    (acc, current) => {
      const value = normalizeStatusValue(current);
      if (!value) {
        return acc;
      }
      acc.set(value, (acc.get(value) || 0) + 1);
      return acc;
    },
    new Map<string, number>()
  );

  return buildStudentStatusOptions(configuredOptions, statuses).map((item) => ({
    ...item,
    count: counts.get(item.value) || 0
  }));
}
