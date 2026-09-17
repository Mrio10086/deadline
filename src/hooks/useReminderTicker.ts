import { useEffect } from "react";
import type { Course, Settings, Task } from "../types";
import { displayNotification } from "../lib/notifications";
import { isNativeApp } from "../lib/platform";
import { lastReminderSync, syncDeviceReminders } from "../lib/reminderSync";
import { dueReminders, remindersForDate } from "../lib/reminders";
import { loadFiredKeys, saveFiredKeys } from "../lib/storage";

/** 网页端检查到点提醒的间隔 */
const WEB_TICK_MS = 30_000;
/** 原生端多久没打开应用就重新排一次程 */
const NATIVE_RESYNC_MS = 6 * 60 * 60 * 1000;
/** 数据连续变化时的防抖，避免每敲一个字就重排一次闹钟 */
const NATIVE_DEBOUNCE_MS = 800;

/**
 * 网页端：页面开着时每 30 秒检查一次到点提醒，用浏览器通知弹出来。
 * 这只是辅助手段，真正可靠的提醒请导出 .ics 交给系统日历。
 */
function useWebTicker(tasks: Task[], courses: Course[], settings: Settings): void {
  useEffect(() => {
    if (isNativeApp()) return;

    const tick = () => {
      const now = new Date();
      const fired = loadFiredKeys(now);
      const due = dueReminders(remindersForDate(tasks, courses, settings, now), now, 5).filter(
        (item) => !fired.has(item.key),
      );
      if (due.length === 0) return;
      for (const item of due) {
        displayNotification(item.title, item.body, item.key);
        fired.add(item.key);
      }
      saveFiredKeys(fired, now);
    };

    tick();
    const timer = window.setInterval(tick, WEB_TICK_MS);
    return () => window.clearInterval(timer);
  }, [tasks, courses, settings]);
}

/**
 * 原生端：把接下来两周的提醒一次性排进安卓系统。
 * 排进去之后应用被关掉、被清后台都照响，和日历事件的可靠性同一个级别。
 */
function useDeviceScheduler(tasks: Task[], courses: Course[], settings: Settings): void {
  useEffect(() => {
    if (!isNativeApp()) return;

    let disposed = false;
    const run = async () => {
      try {
        const state = await syncDeviceReminders(tasks, courses, settings, { ask: true });
        if (disposed) return;
        if (state.permission === "denied") {
          console.warn("[deadline] 系统通知权限被拒绝，提醒不会响");
        }
      } catch (error) {
        console.warn("[deadline] 排程提醒失败", error);
      }
    };

    const timer = window.setTimeout(run, NATIVE_DEBOUNCE_MS);

    // 回到前台时，如果距上次排程太久就补一次（用户可能好几天没打开过）
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const state = lastReminderSync();
      if (!state || Date.now() - state.at > NATIVE_RESYNC_MS) void run();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [tasks, courses, settings]);
}

/** 提醒总入口：网页走页面定时器，原生走系统本地通知。 */
export function useReminderTicker(tasks: Task[], courses: Course[], settings: Settings): void {
  useWebTicker(tasks, courses, settings);
  useDeviceScheduler(tasks, courses, settings);
}