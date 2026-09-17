import type { Course, Settings, Task } from "../types";
import { formatHHMM, periodEndMinutes, periodStartMinutes } from "./periods";
import { resolveLeadMinutes } from "./ics";
import { taskOccursOn, taskStartDateTime } from "./tasks";
import { addDays, atTime, courseOccursInWeek, currentWeek, toISODate, weekdayOf } from "./weeks";

export type ReminderKind = "class" | "task";

export interface ReminderItem {
  key: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** 事件开始时间 */
  at: Date;
  /** 事件结束时间；待办没有结束时间时为 null */
  endAt: Date | null;
  /** 应当弹提醒的时间 */
  remindAt: Date;
}

export type ReminderStatus = "upcoming" | "running" | "finished";

export function reminderStatus(item: ReminderItem, now: Date): ReminderStatus {
  if (item.endAt && now.getTime() >= item.endAt.getTime()) return "finished";
  if (now.getTime() >= item.at.getTime()) return "running";
  return "upcoming";
}

/** 只算「某一天」的课程与待办提醒，重复规则由这一天自然展开。 */
export function remindersForDate(
  tasks: Task[],
  courses: Course[],
  settings: Settings,
  date: Date,
): ReminderItem[] {
  const items: ReminderItem[] = [];
  const dayKey = toISODate(date);
  const week = currentWeek(settings.termStart, date);
  const weekday = weekdayOf(date);

  const classLead = resolveLeadMinutes(settings.classLeadMinutes);
  for (const course of courses) {
    if (course.weekday !== weekday) continue;
    if (week <= 0 || !courseOccursInWeek(course, week)) continue;
    const startMinutes = periodStartMinutes(settings.periods, course.startPeriod);
    if (startMinutes === null) continue;
    const endMinutes = periodEndMinutes(settings.periods, course.endPeriod);
    const start = atTime(date, startMinutes);
    const timeRange =
      endMinutes === null
        ? formatHHMM(startMinutes)
        : `${formatHHMM(startMinutes)}-${formatHHMM(endMinutes)}`;
    items.push({
      key: `class:${course.id}:${dayKey}`,
      kind: "class",
      title: course.name,
      body: [timeRange, course.room, course.teacher].filter(Boolean).join(" · "),
      at: start,
      endAt: endMinutes === null ? null : atTime(date, endMinutes),
      remindAt: new Date(start.getTime() - classLead * 60000),
    });
  }

  const taskLead = resolveLeadMinutes(settings.taskLeadMinutes);
  for (const task of tasks) {
    if (task.done || !taskOccursOn(task, date)) continue;
    const start = taskStartDateTime(task, date);
    if (!start) continue;
    items.push({
      key: `task:${task.id}:${dayKey}`,
      kind: "task",
      title: task.title,
      body: task.note || "待办提醒",
      at: start,
      endAt: null,
      remindAt: new Date(start.getTime() - taskLead * 60000),
    });
  }

  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * 当前时刻应当弹出的提醒：提醒时间已到且未超过窗口期（默认 5 分钟），
 * 避免页面隔很久才打开时一次刷出一堆过期通知。
 */
export function dueReminders(
  items: ReminderItem[],
  now: Date,
  windowMinutes = 5,
): ReminderItem[] {
  const nowMs = now.getTime();
  const windowMs = windowMinutes * 60000;
  return items.filter((item) => {
    const at = item.remindAt.getTime();
    return at <= nowMs && at > nowMs - windowMs;
  });
}

/** 下一次提醒，用于「下一件事」展示。 */
export function nextReminder(items: ReminderItem[], now: Date): ReminderItem | null {
  const upcoming = items
    .filter((item) => item.remindAt.getTime() > now.getTime())
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  return upcoming[0] ?? null;
}

/**
 * 从 from 当天起连续 days 天的全部提醒（课程 + 待办），按事件开始时间排序。
 * 原生端要一次排程好几天，靠的就是这个。
 */
export function upcomingReminders(
  tasks: Task[],
  courses: Course[],
  settings: Settings,
  from: Date,
  days: number,
): ReminderItem[] {
  if (days <= 0) return [];
  const items: ReminderItem[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    items.push(...remindersForDate(tasks, courses, settings, addDays(from, offset)));
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}