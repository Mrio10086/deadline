import type { Task } from "../types";
import { WEEKDAY_LABELS } from "../types";
import { addDays, atTime, mondayOfWeek, parseISODate, toISODate, weekdayOf } from "./weeks";
import { parseHHMM } from "./periods";

function defaultWeekdays(task: Task): number[] {
  const date = parseISODate(task.date);
  return date ? [weekdayOf(date)] : [];
}

function taskWeekdays(task: Task): number[] {
  return task.weekdays.length > 0 ? task.weekdays : defaultWeekdays(task);
}

export function taskOccursOn(task: Task, date: Date): boolean {
  if (task.repeat === "none") return task.date === toISODate(date);
  if (task.repeat === "daily") return true;
  return taskWeekdays(task).includes(weekdayOf(date));
}

export function taskStartDateTime(task: Task, date: Date): Date | null {
  const minutes = parseHHMM(task.time);
  if (minutes === null) return null;
  return atTime(date, minutes);
}

/** 只有不重复的待办才会判定为逾期。 */
export function isTaskOverdue(task: Task, now: Date): boolean {
  if (task.done || task.repeat !== "none") return false;
  const date = parseISODate(task.date);
  if (!date) return false;
  const start = taskStartDateTime(task, date);
  return start !== null && start.getTime() < now.getTime();
}

export function repeatLabel(task: Task): string {
  if (task.repeat === "daily") return `每天 ${task.time}`;
  if (task.repeat === "weekly") {
    const days = taskWeekdays(task)
      .slice()
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_LABELS[day - 1] ?? "")
      .join("、");
    return `每${days} ${task.time}`;
  }
  return `${task.date} ${task.time}`;
}

export function sortTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const keyA = `${a.date} ${a.time}`;
    const keyB = `${b.date} ${b.time}`;
    if (a.repeat === "daily" && b.repeat !== "daily") return -1;
    if (b.repeat === "daily" && a.repeat !== "daily") return 1;
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

export type TaskBucket = "today" | "tomorrow" | "week" | "later" | "done";

export interface TaskGroup {
  key: TaskBucket;
  label: string;
  tasks: Task[];
}

const BUCKET_ORDER: TaskBucket[] = ["today", "tomorrow", "week", "later", "done"];

const BUCKET_LABELS: Record<TaskBucket, string> = {
  today: "今天",
  tomorrow: "明天",
  week: "本周",
  later: "以后",
  done: "已完成",
};

/**
 * 待办该归到哪一组。
 * 重复待办没有「过期」概念，每天/每周到点就会重新出现，所以固定归到对应分组。
 * 已经过期的一次性待办放进「今天」，提示用户赶紧处理（列表里还会标红）。
 */
export function taskBucket(task: Task, now: Date): TaskBucket {
  if (task.done) return "done";
  if (task.repeat === "daily") return "today";

  const today = toISODate(now);
  const endOfWeek = toISODate(addDays(mondayOfWeek(now), 6));

  if (task.repeat === "weekly") {
    const days = taskWeekdays(task);
    if (days.includes(weekdayOf(now))) return "today";
    for (let offset = 1; offset <= 7; offset += 1) {
      const date = addDays(now, offset);
      if (!days.includes(weekdayOf(date))) continue;
      return toISODate(date) <= endOfWeek ? "week" : "later";
    }
    return "later";
  }

  if (task.date <= today) return "today";
  if (task.date === toISODate(addDays(now, 1))) return "tomorrow";
  if (task.date <= endOfWeek) return "week";
  return "later";
}

/** 先按时间排序，再分组；空分组不会返回。 */
export function groupTasks(tasks: Task[], now: Date): TaskGroup[] {
  const buckets = new Map<TaskBucket, Task[]>();
  for (const task of sortTasks(tasks)) {
    const key = taskBucket(task, now);
    const list = buckets.get(key);
    if (list) list.push(task);
    else buckets.set(key, [task]);
  }
  return BUCKET_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    label: BUCKET_LABELS[key],
    tasks: buckets.get(key) as Task[],
  }));
}