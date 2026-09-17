import { describe, expect, it } from "vitest";
import { groupTasks, taskBucket } from "./tasks";
import type { Task } from "../types";

// 2026-09-16 是周三，所在周为 2026-09-14（周一）~ 2026-09-20（周日）
const NOW = new Date(2026, 8, 16, 10, 0);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "交实验报告",
    note: "",
    date: "2026-09-16",
    time: "14:00",
    repeat: "none",
    weekdays: [],
    done: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("taskBucket", () => {
  it("已完成的进「已完成」", () => {
    expect(taskBucket(makeTask({ done: true }), NOW)).toBe("done");
  });

  it("今天的进「今天」", () => {
    expect(taskBucket(makeTask(), NOW)).toBe("today");
  });

  it("明天的进「明天」", () => {
    expect(taskBucket(makeTask({ date: "2026-09-17" }), NOW)).toBe("tomorrow");
  });

  it("本周内的进「本周」", () => {
    expect(taskBucket(makeTask({ date: "2026-09-19" }), NOW)).toBe("week");
    expect(taskBucket(makeTask({ date: "2026-09-20" }), NOW)).toBe("week");
  });

  it("下周及以后进「以后」", () => {
    expect(taskBucket(makeTask({ date: "2026-09-21" }), NOW)).toBe("later");
    expect(taskBucket(makeTask({ date: "2026-12-31" }), NOW)).toBe("later");
  });

  it("已经过期的一次性待办仍然留在「今天」", () => {
    expect(taskBucket(makeTask({ date: "2026-09-01" }), NOW)).toBe("today");
  });

  it("每天重复的永远在「今天」", () => {
    expect(taskBucket(makeTask({ repeat: "daily", date: "2026-01-01" }), NOW)).toBe("today");
  });

  it("每周重复：今天正好是的进「今天」，本周内其他天进「本周」", () => {
    expect(taskBucket(makeTask({ repeat: "weekly", weekdays: [3] }), NOW)).toBe("today");
    expect(taskBucket(makeTask({ repeat: "weekly", weekdays: [5] }), NOW)).toBe("week");
  });

  it("每周重复：本周已经过了的算「以后」", () => {
    expect(taskBucket(makeTask({ repeat: "weekly", weekdays: [1] }), NOW)).toBe("later");
  });

  it("每周重复没填星期时按创建日期那天算", () => {
    expect(taskBucket(makeTask({ repeat: "weekly", weekdays: [], date: "2026-09-14" }), NOW)).toBe(
      "later",
    );
  });
});

describe("groupTasks", () => {
  it("只返回非空分组，且顺序固定", () => {
    const groups = groupTasks(
      [
        makeTask({ id: "a", date: "2026-09-21" }),
        makeTask({ id: "b", date: "2026-09-16" }),
        makeTask({ id: "c", done: true }),
        makeTask({ id: "d", date: "2026-09-17" }),
      ],
      NOW,
    );
    expect(groups.map((group) => group.label)).toEqual(["今天", "明天", "以后", "已完成"]);
    expect(groups[0].tasks.map((task) => task.id)).toEqual(["b"]);
  });

  it("空列表得到空分组", () => {
    expect(groupTasks([], NOW)).toEqual([]);
  });

  it("分组内的待办沿用全局排序", () => {
    const groups = groupTasks(
      [
        makeTask({ id: "晚", date: "2026-09-16", time: "20:00" }),
        makeTask({ id: "早", date: "2026-09-16", time: "08:00" }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((task) => task.id)).toEqual(["早", "晚"]);
  });
});