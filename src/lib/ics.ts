import type { Course, Settings, Task } from "../types";
import { DEFAULT_LEAD_MINUTES, DEFAULT_TASK_DURATION_MINUTES } from "../types";
import { parseHHMM, periodEndMinutes, periodStartMinutes } from "./periods";
import { atTime, dateOfOccurrence, parseISODate, weekdayOf, weeksForCourse } from "./weeks";

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location: string;
  description: string;
  /** 提前多少分钟提醒；null 表示使用兜底值 */
  alarmMinutes: number | null;
  /** 重复规则，例如 FREQ=DAILY；null 表示单次事件 */
  rrule: string | null;
}

const RRULE_DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** RFC 5545 文本转义：先处理反斜杠，再处理换行、分号、逗号。 */
export function escapeIcsText(value: string): string {
  return (value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utf8Size(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * 按 UTF-8 字节数折行：首行最多 75 字节，后续行以单个空格开头、总量不超过 75 字节。
 * 按码点切分，不会把一个中文字符截成两半。
 */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let used = 0;
  let limit = 75;
  for (const ch of line) {
    const size = utf8Size(ch);
    if (used + size > limit) {
      parts.push(current);
      current = ch;
      used = size;
      limit = 74;
    } else {
      current += ch;
      used += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** 还原折行，便于校验与测试。 */
export function unfoldIcsLines(ics: string): string[] {
  return ics.split("\r\n").reduce<string[]>((acc, line) => {
    if (line === "") return acc;
    if (line.startsWith(" ") && acc.length > 0) {
      acc[acc.length - 1] += line.slice(1);
    } else {
      acc.push(line);
    }
    return acc;
  }, []);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 浮动本地时间（不带 Z、不带 TZID）。 */
export function formatFloating(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

export function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** 提前量留空 / 非法时回落到 DEFAULT_LEAD_MINUTES。 */
export function resolveLeadMinutes(value: number | null | undefined): number {
  if (value === null || value === undefined) return DEFAULT_LEAD_MINUTES;
  if (!Number.isFinite(value) || value < 0) return DEFAULT_LEAD_MINUTES;
  return Math.round(value);
}

function dayCode(weekday: number): string {
  return RRULE_DAY_CODES[weekday - 1] ?? "MO";
}

/** 把一门课按周次展开成若干单次事件（不用 RRULE，避免单双周表达不了）。 */
export function expandCourseToEvents(course: Course, settings: Settings): IcsEvent[] {
  const startMinutes = periodStartMinutes(settings.periods, course.startPeriod);
  const endMinutes = periodEndMinutes(settings.periods, course.endPeriod);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return [];

  const lead = resolveLeadMinutes(settings.classLeadMinutes);
  const descriptionParts: string[] = [];
  if (course.teacher) descriptionParts.push(`教师：${course.teacher}`);
  if (course.note) descriptionParts.push(course.note);

  const events: IcsEvent[] = [];
  for (const week of weeksForCourse(course)) {
    const date = dateOfOccurrence(settings.termStart, week, course.weekday);
    if (!date) continue;
    events.push({
      uid: `${course.id}-w${week}@deadline`,
      start: atTime(date, startMinutes),
      end: atTime(date, endMinutes),
      summary: course.name,
      location: course.room,
      description: [...descriptionParts, `第 ${week} 周`].join("\n"),
      alarmMinutes: lead,
      rrule: null,
    });
  }
  return events;
}

export function taskToEvent(task: Task, leadMinutes: number | null): IcsEvent | null {
  const date = parseISODate(task.date);
  const minutes = parseHHMM(task.time);
  if (!date || minutes === null) return null;

  const start = atTime(date, minutes);
  const end = new Date(start.getTime() + DEFAULT_TASK_DURATION_MINUTES * 60000);

  let rrule: string | null = null;
  if (task.repeat === "daily") {
    rrule = "FREQ=DAILY";
  } else if (task.repeat === "weekly") {
    const days = (task.weekdays.length > 0 ? task.weekdays : [weekdayOf(date)])
      .slice()
      .sort((a, b) => a - b);
    rrule = `FREQ=WEEKLY;BYDAY=${days.map(dayCode).join(",")}`;
  }

  return {
    uid: `${task.id}@deadline`,
    start,
    end,
    summary: task.title,
    location: "",
    description: task.note,
    alarmMinutes: resolveLeadMinutes(leadMinutes),
    rrule,
  };
}

export function buildEvents(
  tasks: Task[],
  courses: Course[],
  settings: Settings,
): IcsEvent[] {
  const events: IcsEvent[] = [];
  for (const course of courses) events.push(...expandCourseToEvents(course, settings));
  for (const task of tasks) {
    if (task.done) continue;
    const event = taskToEvent(task, settings.taskLeadMinutes);
    if (event) events.push(event);
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function buildIcs(
  tasks: Task[],
  courses: Course[],
  settings: Settings,
  now: Date = new Date(),
): string {
  const events = buildEvents(tasks, courses, settings);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//deadline//Timetable and Tasks//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("我的课表与待办")}`,
  ];

  const stamp = formatUtc(now);

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${formatFloating(event.start)}`);
    lines.push(`DTEND:${formatFloating(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`TRIGGER:-PT${Math.max(0, event.alarmMinutes ?? DEFAULT_LEAD_MINUTES)}M`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.summary)}`);
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}