import type { LoginResponse } from "../types";

export const STORAGE_KEYS = {
  session: "classmanager-next.web.session",
  username: "classmanager-next.web.username",
  selectedClassId: "classmanager-next.web.selectedClassId",
  selectedStudentId: "classmanager-next.web.selectedStudentId",
  maintenanceSnapshots: "classmanager-next.web.maintenanceSnapshots",
  maintenanceTestMode: "classmanager-next.web.maintenanceTestMode",
  maintenanceTestSnapshot: "classmanager-next.web.maintenanceTestSnapshot"
} as const;

export function readStorage(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

export function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

export function readStoredSession(): LoginResponse | null {
  const raw = readStorage(STORAGE_KEYS.session);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LoginResponse;
  } catch {
    writeStorage(STORAGE_KEYS.session, "");
    return null;
  }
}
