import { DEFAULT_CLASS_MINUTES } from "./periods";
import type { ReminderItem } from "./reminders";

/** 一天内的分钟数区间 */
export interface TimeRange {
  start: number;
  end: number;
}

export interface FreeSlot extends TimeRange {
  minutes: number;
}

/** 默认可安排时间范围，用户可以到设置里改 */
export const DEFAULT_FREE_START = "08:00";
export const DEFAULT_FREE_END = "22:00";

/** 「最少连续多久」的候选值 */
export const FREE_SLOT_CHOICES = [30, 60, 90, 120];

function toSlot(start: number, end: number): FreeSlot {
  return { start, end, minutes: end - start };
}

/** 课程占用区间；缺结束时间时按一节课的时长兜底。 */
export function busyRanges(
  items: ReminderItem[],
  fallbackMinutes: number = DEFAULT_CLASS_MINUTES,
): TimeRange[] {
  return items.map((item) => {
    const start = item.at.getHours() * 60 + item.at.getMinutes();
    const end = item.endAt
      ? item.endAt.getHours() * 60 + item.endAt.getMinutes()
      : start + fallbackMinutes;
    return { start, end: Math.max(start, end) };
  });
}

/** 合并重叠或首尾相接的区间，输入顺序不影响结果。 */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * 找出 window 内所有长度不少于 minMinutes 的空档。
 * 课程超出 window 的部分会被裁掉，不会产生负长度的空档。
 */
export function freeSlots(busy: TimeRange[], window: TimeRange, minMinutes: number): FreeSlot[] {
  const slots: FreeSlot[] = [];
  if (window.end <= window.start) return slots;

  let cursor = window.start;
  for (const range of mergeRanges(busy)) {
    if (range.end <= window.start || range.start >= window.end) continue;
    const start = Math.max(range.start, window.start);
    if (start - cursor >= minMinutes) slots.push(toSlot(cursor, start));
    cursor = Math.max(cursor, Math.min(range.end, window.end));
  }
  if (window.end - cursor >= minMinutes) slots.push(toSlot(cursor, window.end));
  return slots;
}