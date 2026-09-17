export type WeekParity = "all" | "odd" | "even";

export type RepeatRule = "none" | "daily" | "weekly";

export const WEEKDAY_LABELS = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
] as const;

export const PARITY_LABELS: Record<WeekParity, string> = {
  all: "每周",
  odd: "单周",
  even: "双周",
};

/** 提前量留空时使用的兜底值（分钟）。 */
export const DEFAULT_LEAD_MINUTES = 10;

/** 待办事件在日历里的默认时长（分钟）。 */
export const DEFAULT_TASK_DURATION_MINUTES = 30;

export interface Course {
  id: string;
  name: string;
  teacher: string;
  room: string;
  /** 1 = 周一 ... 7 = 周日 */
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  startWeek: number;
  endWeek: number;
  parity: WeekParity;
  /** 课表配色 key；空字符串表示按课程自动分配 */
  color: string;
  note: string;
}

export interface PeriodTime {
  /** 节次编号，从 1 开始 */
  index: number;
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  repeat: RepeatRule;
  /** repeat === "weekly" 时生效，1 = 周一 ... 7 = 周日 */
  weekdays: number[];
  done: boolean;
  createdAt: string;
}

export interface Settings {
  /** 第 1 周周一的日期，YYYY-MM-DD */
  termStart: string;
  /** 课前提前量（分钟），null 表示用兜底值 */
  classLeadMinutes: number | null;
  /** 待办提前量（分钟），null 表示用兜底值 */
  taskLeadMinutes: number | null;
  periods: PeriodTime[];
  /** 首页问候语里的称呼，留空就只用「早上好」 */
  nickname: string;
  /** 空闲时间查询的默认范围 */
  freeStart: string;
  freeEnd: string;
}

export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  tasks: Task[];
  courses: Course[];
  settings: Settings;
}