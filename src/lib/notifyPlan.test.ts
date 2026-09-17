import { describe, expect, it } from "vitest";
import {
  MAX_PLANNED_NOTIFICATIONS,
  NOTIFICATION_ID_MAX,
  buildNotificationPlan,
  notificationIdFor,
  summarizePlan,
} from "./notifyPlan";
import type { ReminderItem } from "./reminders";

const NOW = new Date(2026, 8, 16, 12, 0);

function makeItem(overrides: Partial<ReminderItem> & { key: string; remindAt: Date }): ReminderItem {
  return {
    kind: "class",
    title: "高等数学",
    body: "08:00-08:45 · 一教101",
    at: new Date(overrides.remindAt.getTime() + 10 * 60000),
    endAt: null,
    ...overrides,
  };
}

describe("notificationIdFor", () => {
  it("同一个 key 永远得到同一个 id", () => {
    expect(notificationIdFor("class:c1:2026-09-16")).toBe(notificationIdFor("class:c1:2026-09-16"));
  });

  it("落在安卓本地通知要求的正整数范围内", () => {
    const keys = ["", "a", "class:c1:2026-09-16", "task:t9:2026-12-31", "课:测试"];
    for (const key of keys) {
      const id = notificationIdFor(key);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(NOTIFICATION_ID_MAX);
    }
  });

  it("不同 key 基本不会撞车", () => {
    const ids = new Set<number>();
    for (let index = 0; index < 500; index += 1) {
      ids.add(notificationIdFor(`class:c${index}:2026-09-${(index % 28) + 1}`));
    }
    expect(ids.size).toBe(500);
  });
});

describe("buildNotificationPlan", () => {
  it("按提醒时间从早到晚排序", () => {
    const plan = buildNotificationPlan(
      [
        makeItem({ key: "b", remindAt: new Date(2026, 8, 16, 13, 0) }),
        makeItem({ key: "a", remindAt: new Date(2026, 8, 16, 12, 30) }),
      ],
      NOW,
    );
    expect(plan.map((item) => item.key)).toEqual(["a", "b"]);
  });

  it("丢掉已经过期的提醒，但保留刚过去一分钟内的", () => {
    const plan = buildNotificationPlan(
      [
        makeItem({ key: "过期", remindAt: new Date(2026, 8, 16, 9, 0) }),
        makeItem({ key: "刚过", remindAt: new Date(2026, 8, 16, 11, 59, 30) }),
        makeItem({ key: "将来", remindAt: new Date(2026, 8, 16, 12, 30) }),
      ],
      NOW,
    );
    expect(plan.map((item) => item.key)).toEqual(["刚过", "将来"]);
  });

  it("按时间排序后再截断，不会漏掉最近的提醒", () => {
    const items = [
      makeItem({ key: "晚", remindAt: new Date(2026, 8, 16, 18, 0) }),
      makeItem({ key: "早", remindAt: new Date(2026, 8, 16, 12, 10) }),
      makeItem({ key: "中", remindAt: new Date(2026, 8, 16, 14, 0) }),
    ];
    const plan = buildNotificationPlan(items, NOW, { maxCount: 2 });
    expect(plan.map((item) => item.key)).toEqual(["早", "中"]);
  });

  it("默认上限是常量里的条数", () => {
    const items = Array.from({ length: MAX_PLANNED_NOTIFICATIONS + 20 }, (_, index) =>
      makeItem({ key: `k${index}`, remindAt: new Date(NOW.getTime() + (index + 1) * 60000) }),
    );
    expect(buildNotificationPlan(items, NOW)).toHaveLength(MAX_PLANNED_NOTIFICATIONS);
  });

  it("id 冲突会自动让位，计划里的 id 互不相同", () => {
    const items = Array.from({ length: 300 }, (_, index) =>
      makeItem({ key: `同一批-${index}`, remindAt: new Date(NOW.getTime() + (index + 1) * 60000) }),
    );
    const plan = buildNotificationPlan(items, NOW);
    expect(new Set(plan.map((item) => item.id)).size).toBe(plan.length);
  });

  it("保留触发时刻、事件时刻和类型，供通知正文使用", () => {
    const item = makeItem({
      key: "class:c1:2026-09-16",
      kind: "class",
      title: "大学英语",
      body: "10:00-10:45 · 外语楼302",
      remindAt: new Date(2026, 8, 16, 13, 50),
      at: new Date(2026, 8, 16, 14, 0),
    });
    const [planned] = buildNotificationPlan([item], NOW);
    expect(planned.kind).toBe("class");
    expect(planned.title).toBe("大学英语");
    expect(planned.body).toBe("10:00-10:45 · 外语楼302");
    expect(planned.at.getTime()).toBe(item.remindAt.getTime());
    expect(planned.eventAt.getTime()).toBe(item.at.getTime());
  });

  it("空输入得到空计划", () => {
    expect(buildNotificationPlan([], NOW)).toEqual([]);
  });
});

describe("summarizePlan", () => {
  it("空计划返回全零", () => {
    expect(summarizePlan([])).toEqual({
      count: 0,
      firstAt: null,
      lastAt: null,
      classCount: 0,
      taskCount: 0,
    });
  });

  it("统计条数、首末时间和课程 / 待办占比", () => {
    const plan = buildNotificationPlan(
      [
        makeItem({ key: "c1", kind: "class", remindAt: new Date(2026, 8, 16, 12, 10) }),
        makeItem({ key: "t1", kind: "task", remindAt: new Date(2026, 8, 16, 15, 0) }),
        makeItem({ key: "c2", kind: "class", remindAt: new Date(2026, 8, 17, 9, 0) }),
      ],
      NOW,
    );
    const summary = summarizePlan(plan);
    expect(summary.count).toBe(3);
    expect(summary.classCount).toBe(2);
    expect(summary.taskCount).toBe(1);
    expect(summary.firstAt).toBe(new Date(2026, 8, 16, 12, 10).getTime());
    expect(summary.lastAt).toBe(new Date(2026, 8, 17, 9, 0).getTime());
  });
});