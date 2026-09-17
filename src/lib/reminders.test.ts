import { describe, expect, it } from "vitest";
import { dueReminders, nextReminder, reminderStatus, remindersForDate, upcomingReminders } from "./reminders";
import { DEFAULT_PERIODS } from "./periods";
import type { Course, Settings, Task } from "../types";

const TERM_START = "2026-09-07";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    termStart: TERM_START,
    classLeadMinutes: null,
    taskLeadMinutes: null,
    nickname: "",
    freeStart: "08:00",
    freeEnd: "22:00",
    periods: DEFAULT_PERIODS.map((period) => ({ ...period })),
    ...overrides,
  };
}

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "高等数学",
    teacher: "张老师",
    room: "一教101",
    weekday: 3,
    startPeriod: 3,
    endPeriod: 4,
    startWeek: 1,
    endWeek: 16,
    parity: "all",
    color: "",
    note: "",
    ...overrides,
  };
}

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

describe("remindersForDate 课程提醒", () => {
  it("只有当天且有课的星期才产生提醒", () => {
    const wednesday = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(wednesday).toHaveLength(1);
    expect(wednesday[0].kind).toBe("class");
    expect(wednesday[0].key).toBe("class:c1:2026-09-16");

    const monday = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 14));
    expect(monday).toHaveLength(0);
  });

  it("提醒时间 = 上课时间 - 提前量", () => {
    const [item] = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(item.at.getHours()).toBe(10);
    expect(item.at.getMinutes()).toBe(0);
    expect(item.remindAt.getHours()).toBe(9);
    expect(item.remindAt.getMinutes()).toBe(50);
  });

  it("提前量留空时用默认 10 分钟，填 0 则准点提醒", () => {
    const [fallback] = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(fallback.remindAt.getMinutes()).toBe(50);

    const [exact] = remindersForDate(
      [],
      [makeCourse()],
      makeSettings({ classLeadMinutes: 0 }),
      new Date(2026, 8, 16),
    );
    expect(exact.remindAt.getMinutes()).toBe(0);
  });

  it("单周课程在双周不提醒", () => {
    const odd = makeCourse({ parity: "odd" });
    expect(remindersForDate([], [odd], makeSettings(), new Date(2026, 8, 16))).toHaveLength(0);
    expect(remindersForDate([], [odd], makeSettings(), new Date(2026, 8, 23))).toHaveLength(1);
  });

  it("超出周次范围不提醒", () => {
    const shortCourse = makeCourse({ startWeek: 1, endWeek: 1 });
    expect(remindersForDate([], [shortCourse], makeSettings(), new Date(2026, 8, 16))).toHaveLength(0);
    expect(remindersForDate([], [shortCourse], makeSettings(), new Date(2026, 8, 9))).toHaveLength(1);
  });

  it("开学前不提醒", () => {
    const before = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 2));
    expect(before).toHaveLength(0);
  });

  it("提醒正文包含时间、教室和教师", () => {
    const [item] = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(item.body).toContain("10:00-11:40");
    expect(item.body).toContain("一教101");
    expect(item.body).toContain("张老师");
  });
});

describe("remindersForDate 待办提醒", () => {
  it("当天待办产生提醒", () => {
    const items = remindersForDate([makeTask()], [], makeSettings(), new Date(2026, 8, 16));
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("task");
    expect(items[0].remindAt.getHours()).toBe(13);
    expect(items[0].remindAt.getMinutes()).toBe(50);
  });

  it("其他日期不提醒", () => {
    expect(remindersForDate([makeTask()], [], makeSettings(), new Date(2026, 8, 15))).toHaveLength(0);
  });

  it("每天重复的待办天天都提醒", () => {
    const daily = makeTask({ repeat: "daily" });
    expect(remindersForDate([daily], [], makeSettings(), new Date(2026, 8, 15))).toHaveLength(1);
    expect(remindersForDate([daily], [], makeSettings(), new Date(2026, 8, 20))).toHaveLength(1);
  });

  it("每周重复只在选中的星期提醒", () => {
    const weekly = makeTask({ repeat: "weekly", weekdays: [3, 5] });
    expect(remindersForDate([weekly], [], makeSettings(), new Date(2026, 8, 16))).toHaveLength(1);
    expect(remindersForDate([weekly], [], makeSettings(), new Date(2026, 8, 17))).toHaveLength(0);
  });

  it("已完成的待办不提醒", () => {
    expect(remindersForDate([makeTask({ done: true })], [], makeSettings(), new Date(2026, 8, 16))).toHaveLength(0);
  });

  it("课程和待办按时间排序", () => {
    const items = remindersForDate([makeTask()], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(items.map((item) => item.kind)).toEqual(["class", "task"]);
  });
});

describe("dueReminders", () => {
  const items = remindersForDate([makeTask()], [makeCourse()], makeSettings(), new Date(2026, 8, 16));

  it("提醒时间已到且在窗口内才返回", () => {
    expect(dueReminders(items, new Date(2026, 8, 16, 9, 52), 5)).toHaveLength(1);
    expect(dueReminders(items, new Date(2026, 8, 16, 9, 45), 5)).toHaveLength(0);
    expect(dueReminders(items, new Date(2026, 8, 16, 10, 0), 5)).toHaveLength(0);
  });

  it("窗口可调大以补发错过的提醒", () => {
    expect(dueReminders(items, new Date(2026, 8, 16, 9, 50), 20)).toHaveLength(1);
  });
});

describe("reminderStatus", () => {
  const [item] = remindersForDate([], [makeCourse()], makeSettings(), new Date(2026, 8, 16));

  it("区分即将开始、进行中和已结束", () => {
    expect(reminderStatus(item, new Date(2026, 8, 16, 9, 0))).toBe("upcoming");
    expect(reminderStatus(item, new Date(2026, 8, 16, 10, 0))).toBe("running");
    expect(reminderStatus(item, new Date(2026, 8, 16, 11, 45))).toBe("finished");
  });
});

describe("nextReminder", () => {
  it("返回最近一次未来提醒", () => {
    const items = remindersForDate([makeTask()], [makeCourse()], makeSettings(), new Date(2026, 8, 16));
    expect(nextReminder(items, new Date(2026, 8, 16, 9, 0))?.kind).toBe("class");
    expect(nextReminder(items, new Date(2026, 8, 16, 13, 0))?.kind).toBe("task");
    expect(nextReminder(items, new Date(2026, 8, 16, 23, 0))).toBeNull();
  });
});

describe("upcomingReminders", () => {
  it("展开多天，并按事件开始时间排序", () => {
    const items = upcomingReminders(
      [makeTask({ repeat: "daily", date: "2026-09-16" })],
      [makeCourse()],
      makeSettings(),
      new Date(2026, 8, 16),
      3,
    );
    expect(items).toHaveLength(4);
    const times = items.map((item) => item.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("单周课程只在单周出现", () => {
    const items = upcomingReminders(
      [],
      [makeCourse({ parity: "odd", endWeek: 4 })],
      makeSettings(),
      new Date(2026, 8, 7),
      28,
    );
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.key)).toEqual([
      "class:c1:2026-09-09",
      "class:c1:2026-09-23",
    ]);
  });

  it("开学前不产生任何课程提醒", () => {
    const items = upcomingReminders(
      [],
      [makeCourse()],
      makeSettings(),
      new Date(2026, 7, 20),
      10,
    );
    expect(items).toEqual([]);
  });

  it("days 小于等于 0 时返回空数组", () => {
    expect(upcomingReminders([makeTask()], [makeCourse()], makeSettings(), new Date(2026, 8, 16), 0)).toEqual([]);
  });
});