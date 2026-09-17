import type { ReminderItem, ReminderKind } from "./reminders";

export interface PlannedNotification {
  /** 安卓本地通知 id 必须是 32 位整数 */
  id: number;
  /** 与 ReminderItem.key 一致，用来判断同一条提醒 */
  key: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** 提醒弹出的时刻 */
  at: Date;
  /** 事件本身的开始时刻 */
  eventAt: Date;
}

export interface PlanOptions {
  /** 排程上限，避免一次往系统里塞进上千条闹钟 */
  maxCount?: number;
  /** 早于 now 这么久之前的提醒直接丢掉（已经来不及提醒了） */
  graceMs?: number;
}

/** 一次最多排程多少条通知 */
export const MAX_PLANNED_NOTIFICATIONS = 200;
/** 每次排程往前铺多少天，用户超过这个时间没打开应用，提醒会停 */
export const PLAN_HORIZON_DAYS = 14;
/** 已经过去但还没超过这个时间的提醒仍然排上（手机刚解锁就补一条） */
export const PLAN_GRACE_MS = 60_000;

/** 安卓通知 id 的取值范围上限 */
export const NOTIFICATION_ID_MAX = 0x7fffffff;

/**
 * FNV-1a 32 位哈希。
 * 同一个 key 永远得到同一个 id，重复排程会覆盖同一条通知而不是叠加。
 */
export function notificationIdFor(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % NOTIFICATION_ID_MAX) + 1;
}

/**
 * 把一段时间内的提醒整理成一份排程计划：
 * 丢掉过期的、按提醒时间排序、解决 id 冲突、截断到上限。
 */
export function buildNotificationPlan(
  items: ReminderItem[],
  now: Date,
  options: PlanOptions = {},
): PlannedNotification[] {
  const maxCount = options.maxCount ?? MAX_PLANNED_NOTIFICATIONS;
  const graceMs = options.graceMs ?? PLAN_GRACE_MS;
  const nowMs = now.getTime();

  const ordered = items
    .filter((item) => item.remindAt.getTime() >= nowMs - graceMs)
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
    .slice(0, Math.max(0, maxCount));

  const used = new Set<number>();
  return ordered.map((item) => {
    let id = notificationIdFor(item.key);
    while (used.has(id)) {
      id = (id % NOTIFICATION_ID_MAX) + 1;
    }
    used.add(id);
    return {
      id,
      key: item.key,
      kind: item.kind,
      title: item.title,
      body: item.body,
      at: item.remindAt,
      eventAt: item.at,
    };
  });
}

export interface PlanSummary {
  /** 计划里的提醒条数 */
  count: number;
  /** 第一条提醒的时间戳 */
  firstAt: number | null;
  /** 最后一条提醒的时间戳 */
  lastAt: number | null;
  /** 课程提醒条数 */
  classCount: number;
  /** 待办提醒条数 */
  taskCount: number;
}

export function summarizePlan(plan: PlannedNotification[]): PlanSummary {
  if (plan.length === 0) {
    return { count: 0, firstAt: null, lastAt: null, classCount: 0, taskCount: 0 };
  }
  let classCount = 0;
  for (const item of plan) {
    if (item.kind === "class") classCount += 1;
  }
  return {
    count: plan.length,
    firstAt: plan[0].at.getTime(),
    lastAt: plan[plan.length - 1].at.getTime(),
    classCount,
    taskCount: plan.length - classCount,
  };
}