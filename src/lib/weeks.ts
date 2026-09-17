import type { Course } from "../types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 解析 YYYY-MM-DD 为本地零点；格式非法时返回 null。 */
export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** 以 UTC 天序号表示本地日期，用于避免夏令时导致的整数天误差。 */
function dayIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function atTime(date: Date, minutesOfDay: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
    0,
    0,
  );
}

/** 1 = 周一 ... 7 = 周日 */
export function weekdayOf(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

/** 周一为一周的第一天的所在周周一。 */
export function mondayOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -(weekdayOf(date) - 1));
}

/**
 * 计算给定日期属于第几周（1 起）。
 * 开学前返回 <= 0，第 1 周周一返回 1，第 1 周周日仍为 1。
 */
export function currentWeek(termStart: string, date: Date): number {
  const start = parseISODate(termStart);
  if (!start) return 0;
  const diff = dayIndex(date) - dayIndex(start);
  return Math.floor(diff / 7) + 1;
}

/** 第 week 周 weekday 那天的日期。 */
export function dateOfOccurrence(termStart: string, week: number, weekday: number): Date | null {
  const start = parseISODate(termStart);
  if (!start) return null;
  return addDays(start, (week - 1) * 7 + (weekday - 1));
}

export function courseOccursInWeek(course: Course, week: number): boolean {
  if (week < course.startWeek || week > course.endWeek) return false;
  if (course.parity === "odd") return week % 2 === 1;
  if (course.parity === "even") return week % 2 === 0;
  return true;
}

export function weeksForCourse(course: Course): number[] {
  const weeks: number[] = [];
  for (let week = course.startWeek; week <= course.endWeek; week += 1) {
    if (courseOccursInWeek(course, week)) weeks.push(week);
  }
  return weeks;
}

export function formatDateCN(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}