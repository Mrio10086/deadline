import type { Backup, Course, PeriodTime, Settings, Task, WeekParity } from "../types";
import { toneByKey } from "./courseColors";
import { DEFAULT_FREE_END, DEFAULT_FREE_START } from "./freeSlots";
import { DEFAULT_PERIODS, parseHHMM } from "./periods";
import { mondayOfWeek, parseISODate, toISODate } from "./weeks";

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  version: "deadline.schemaVersion",
  tasks: "deadline.tasks",
  courses: "deadline.courses",
  settings: "deadline.settings",
  fired: "deadline.fired",
} as const;

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  const store = safeStorage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式或配额不足时静默忽略 */
  }
}

export function removeKey(key: string): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function defaultSettings(today: Date = new Date()): Settings {
  return {
    termStart: toISODate(mondayOfWeek(today)),
    classLeadMinutes: null,
    taskLeadMinutes: null,
    periods: DEFAULT_PERIODS.map((period) => ({ ...period })),
    nickname: "",
    freeStart: DEFAULT_FREE_START,
    freeEnd: DEFAULT_FREE_END,
  };
}

function isClock(value: unknown): boolean {
  return typeof value === "string" && parseHHMM(value) !== null;
}

function normalizeLead(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function isPeriodTime(value: unknown): value is PeriodTime {
  if (!value || typeof value !== "object") return false;
  const period = value as Partial<PeriodTime>;
  return (
    typeof period.index === "number" &&
    period.index >= 1 &&
    typeof period.start === "string" &&
    parseHHMM(period.start) !== null &&
    typeof period.end === "string" &&
    parseHHMM(period.end) !== null
  );
}

export function normalizeSettings(value: unknown, today: Date = new Date()): Settings {
  const base = defaultSettings(today);
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Settings>;

  const periods = Array.isArray(raw.periods)
    ? raw.periods
        .filter(isPeriodTime)
        .map((period) => ({ index: period.index, start: period.start, end: period.end }))
        .sort((a, b) => a.index - b.index)
    : [];

  return {
    termStart:
      typeof raw.termStart === "string" && parseISODate(raw.termStart)
        ? raw.termStart
        : base.termStart,
    classLeadMinutes: normalizeLead(raw.classLeadMinutes),
    taskLeadMinutes: normalizeLead(raw.taskLeadMinutes),
    periods: periods.length > 0 ? periods : base.periods,
    nickname:
      typeof raw.nickname === "string" ? raw.nickname.trim().slice(0, 12) : base.nickname,
    freeStart: isClock(raw.freeStart) ? (raw.freeStart as string) : base.freeStart,
    freeEnd: isClock(raw.freeEnd) ? (raw.freeEnd as string) : base.freeEnd,
  };
}

const PARITIES: WeekParity[] = ["all", "odd", "even"];

function normalizeCourse(value: unknown): Course | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Course>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.name !== "string" || !raw.name) return null;
  if (typeof raw.weekday !== "number" || raw.weekday < 1 || raw.weekday > 7) return null;
  if (typeof raw.startPeriod !== "number" || typeof raw.endPeriod !== "number") return null;
  if (typeof raw.startWeek !== "number" || typeof raw.endWeek !== "number") return null;
  return {
    id: raw.id,
    name: raw.name,
    teacher: typeof raw.teacher === "string" ? raw.teacher : "",
    room: typeof raw.room === "string" ? raw.room : "",
    weekday: raw.weekday,
    startPeriod: raw.startPeriod,
    endPeriod: Math.max(raw.startPeriod, raw.endPeriod),
    startWeek: raw.startWeek,
    endWeek: Math.max(raw.startWeek, raw.endWeek),
    parity: PARITIES.includes(raw.parity as WeekParity) ? (raw.parity as WeekParity) : "all",
    color: typeof raw.color === "string" && toneByKey(raw.color) ? raw.color : "",
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

function normalizeTask(value: unknown): Task | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Task>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.title !== "string" || !raw.title) return null;
  if (typeof raw.date !== "string" || !parseISODate(raw.date)) return null;
  if (typeof raw.time !== "string" || parseHHMM(raw.time) === null) return null;
  const repeat = raw.repeat === "daily" || raw.repeat === "weekly" ? raw.repeat : "none";
  return {
    id: raw.id,
    title: raw.title,
    note: typeof raw.note === "string" ? raw.note : "",
    date: raw.date,
    time: raw.time,
    repeat,
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter(
          (day): day is number => typeof day === "number" && day >= 1 && day <= 7,
        )
      : [],
    done: raw.done === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

export function normalizeCourses(value: unknown): Course[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCourse).filter((course): course is Course => course !== null);
}

export function normalizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeTask).filter((task): task is Task => task !== null);
}

export function buildBackup(tasks: Task[], courses: Course[], settings: Settings): Backup {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    courses,
    settings,
  };
}

export interface BackupData {
  tasks: Task[];
  courses: Course[];
  settings: Settings;
}

/** 接受完整备份，也接受只有 tasks / courses / settings 的裸对象。 */
export function readBackup(value: unknown): BackupData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Backup>;
  if (!Array.isArray(raw.tasks) && !Array.isArray(raw.courses)) return null;
  return {
    tasks: normalizeTasks(raw.tasks),
    courses: normalizeCourses(raw.courses),
    settings: normalizeSettings(raw.settings),
  };
}

/** 记录 schema 版本号，为将来的数据迁移留钩子。 */
export function ensureSchemaVersion(): void {
  const store = safeStorage();
  if (!store) return;
  const stored = Number(store.getItem(STORAGE_KEYS.version) ?? 0);
  if (stored === SCHEMA_VERSION) return;
  saveJson(STORAGE_KEYS.version, SCHEMA_VERSION);
}

interface FiredState {
  date: string;
  keys: string[];
}

export function loadFiredKeys(today: Date = new Date()): Set<string> {
  const state = loadJson<FiredState | null>(STORAGE_KEYS.fired, null);
  if (!state || state.date !== toISODate(today) || !Array.isArray(state.keys)) {
    return new Set();
  }
  return new Set(state.keys);
}

export function saveFiredKeys(keys: Set<string>, today: Date = new Date()): void {
  saveJson(STORAGE_KEYS.fired, { date: toISODate(today), keys: Array.from(keys) });
}