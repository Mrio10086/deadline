import { LocalNotifications } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { isNativeApp } from "./platform";
import type { PlannedNotification } from "./notifyPlan";

export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";
export type ExactAlarmPermission = "granted" | "denied" | "unsupported";

/** 安卓 8+ 必须走通知渠道，分成上课和待办两类方便用户单独静音 */
export const CLASS_CHANNEL_ID = "deadline-class";
export const TASK_CHANNEL_ID = "deadline-task";

/** res/raw 里的提示音资源名（不带扩展名），与 capacitor.config.ts 保持一致 */
export const NOTIFICATION_SOUND_RESOURCE = "notify";

const TEST_NOTIFICATION_ID = 1;

function normalizePermission(state: string | undefined): NotifyPermission {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  return "prompt";
}

/** 把排程计划翻译成插件要求的通知结构。 */
export function toNativeNotifications(plan: PlannedNotification[]): LocalNotificationSchema[] {
  return plan.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    channelId: item.kind === "class" ? CLASS_CHANNEL_ID : TASK_CHANNEL_ID,
    schedule: {
      at: item.at,
      // 息屏 / 打盹模式下也尽量按时响
      allowWhileIdle: true,
    },
  }));
}

/** 建好两个通知渠道；渠道一旦创建，用户改过设置后系统不会再覆盖。 */
export async function ensureNotificationChannels(): Promise<void> {
  if (!isNativeApp()) return;
  const shared = {
    importance: 4 as const,
    visibility: 1 as const,
    sound: NOTIFICATION_SOUND_RESOURCE,
    vibration: true,
    lights: true,
  };
  await LocalNotifications.createChannel({
    id: CLASS_CHANNEL_ID,
    name: "上课提醒",
    description: "课程开始前的提醒",
    ...shared,
  });
  await LocalNotifications.createChannel({
    id: TASK_CHANNEL_ID,
    name: "待办提醒",
    description: "待办到点提醒",
    ...shared,
  });
}

export async function currentNotificationPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission === "default" ? "prompt" : normalizePermission(Notification.permission);
  }
  try {
    const status = await LocalNotifications.checkPermissions();
    return normalizePermission(status.display);
  } catch {
    return "unsupported";
  }
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) {
    if (typeof Notification === "undefined") return "unsupported";
    return normalizePermission(await Notification.requestPermission());
  }
  try {
    const status = await LocalNotifications.requestPermissions();
    return normalizePermission(status.display);
  } catch {
    return "unsupported";
  }
}

export interface NativeScheduleResult {
  scheduled: number;
  /** 没有拿到精确闹钟权限时插件会降级成不精确闹钟并回一条警告 */
  warning: string | null;
}

/**
 * 覆盖式排程：先撤掉旧的，再按新计划全部排一遍。
 * 这样删课、改时间之后不会留下幽灵提醒。
 */
export async function scheduleNativeReminders(
  plan: PlannedNotification[],
): Promise<NativeScheduleResult> {
  if (!isNativeApp()) return { scheduled: 0, warning: null };
  await ensureNotificationChannels();
  await LocalNotifications.cancelAll();
  if (plan.length === 0) return { scheduled: 0, warning: null };
  const result = await LocalNotifications.schedule({ notifications: toNativeNotifications(plan) });
  return {
    scheduled: result.notifications.length,
    warning: result.warning ? result.warning.message : null,
  };
}

export async function clearNativeReminders(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancelAll();
  } catch {
    /* 没有排程时取消失败无所谓 */
  }
}

export async function pendingNativeReminders(): Promise<number> {
  if (!isNativeApp()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch {
    return 0;
  }
}

/** 立刻弹一条通知，用来验证权限和提示音是否正常。 */
export async function showTestNotification(delaySeconds = 5): Promise<boolean> {
  const at = new Date(Date.now() + delaySeconds * 1000);
  if (isNativeApp()) {
    await ensureNotificationChannels();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_NOTIFICATION_ID,
          title: "测试提醒",
          body: `${delaySeconds} 秒后见：课程和待办到点就是长这样`,
          channelId: TASK_CHANNEL_ID,
          schedule: { at, allowWhileIdle: true },
        },
      ],
    });
    return true;
  }
  return displayNotification("测试提醒", "课程和待办到点就是长这样", "deadline-test");
}

/** 网页端的即时通知（只有页面开着时才会弹）。 */
export function displayNotification(title: string, body: string, tag?: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    new Notification(title, { body, tag });
    return true;
  } catch {
    return false;
  }
}

/**
 * 安卓 12+ 的「闹钟和提醒」特殊权限。
 * 没有它通知只能粗略时间弹出，可能会晚几分钟。
 */
export async function currentExactAlarmPermission(): Promise<ExactAlarmPermission> {
  if (!isNativeApp()) return "unsupported";
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return status.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/** 跳到系统设置页让用户打开「闹钟和提醒」。 */
export async function openExactAlarmSettings(): Promise<ExactAlarmPermission> {
  if (!isNativeApp()) return "unsupported";
  try {
    const status = await LocalNotifications.changeExactNotificationSetting();
    return status.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}