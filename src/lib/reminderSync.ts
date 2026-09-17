import type { Course, Settings, Task } from "../types";
import {
  currentNotificationPermission,
  clearNativeReminders,
  requestNotificationPermission,
  scheduleNativeReminders,
  type NotifyPermission,
} from "./notifications";
import { buildNotificationPlan, PLAN_HORIZON_DAYS, summarizePlan } from "./notifyPlan";
import { isNativeApp } from "./platform";
import { upcomingReminders } from "./reminders";

export interface ReminderSyncState {
  /** 这次排程发生的时刻 */
  at: number;
  /** 计划覆盖的提醒条数 */
  planned: number;
  /** 真正交给系统的通知条数（网页端为 0） */
  scheduled: number;
  /** 第一条 / 最后一条提醒的时间戳 */
  firstAt: number | null;
  lastAt: number | null;
  permission: NotifyPermission;
  warning: string | null;
}

let lastState: ReminderSyncState | null = null;

export function lastReminderSync(): ReminderSyncState | null {
  return lastState;
}

async function resolvePermission(ask: boolean): Promise<NotifyPermission> {
  let permission = await currentNotificationPermission();
  if (ask && permission === "prompt") {
    permission = await requestNotificationPermission();
  }
  return permission;
}

/**
 * 把接下来两周的课程和待办排进系统通知。
 * 网页端没有系统通知可用，只记录计划条数，真正的提醒靠页面的定时器。
 */
export async function syncDeviceReminders(
  tasks: Task[],
  courses: Course[],
  settings: Settings,
  options: { ask?: boolean } = {},
): Promise<ReminderSyncState> {
  const now = new Date();
  const plan = buildNotificationPlan(
    upcomingReminders(tasks, courses, settings, now, PLAN_HORIZON_DAYS),
    now,
  );
  const summary = summarizePlan(plan);
  // 一条提醒都没有的时候不要弹权限框，等用户真的录了课再问
  const permission = await resolvePermission((options.ask ?? false) && summary.count > 0);

  let scheduled = 0;
  let warning: string | null = null;
  if (isNativeApp() && permission === "granted") {
    const result = await scheduleNativeReminders(plan);
    scheduled = result.scheduled;
    warning = result.warning;
  }

  lastState = {
    at: now.getTime(),
    planned: summary.count,
    scheduled,
    firstAt: summary.firstAt,
    lastAt: summary.lastAt,
    permission,
    warning,
  };
  return lastState;
}

/** 清空数据时顺手撤掉所有已排程的通知。 */
export async function cancelDeviceReminders(): Promise<void> {
  await clearNativeReminders();
  lastState = null;
}