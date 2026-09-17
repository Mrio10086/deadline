import { describe, expect, it } from "vitest";
import { busyRanges, freeSlots, mergeRanges } from "./freeSlots";
import type { ReminderItem } from "./reminders";

function minutes(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 16, hour, minute);
}

function classItem(startHour: number, startMinute: number, endHour: number, endMinute: number): ReminderItem {
  return {
    key: `class:${startHour}${startMinute}`,
    kind: "class",
    title: "高等数学",
    body: "",
    at: at(startHour, startMinute),
    endAt: at(endHour, endMinute),
    remindAt: at(startHour, startMinute),
  };
}

const WINDOW = { start: minutes(8), end: minutes(22) };

describe("busyRanges", () => {
  it("取课程的起止时间", () => {
    expect(busyRanges([classItem(9, 0, 10, 0)])).toEqual([{ start: 540, end: 600 }]);
  });

  it("没有结束时间时按一节课兜底", () => {
    const item: ReminderItem = { ...classItem(9, 0, 9, 0), endAt: null };
    expect(busyRanges([item])).toEqual([{ start: 540, end: 585 }]);
  });

  it("结束早于开始时不产生负区间", () => {
    expect(busyRanges([classItem(10, 0, 9, 0)])).toEqual([{ start: 600, end: 600 }]);
  });
});

describe("mergeRanges", () => {
  it("合并重叠区间并保持顺序无关", () => {
    expect(
      mergeRanges([
        { start: 600, end: 660 },
        { start: 540, end: 600 },
        { start: 700, end: 720 },
      ]),
    ).toEqual([
      { start: 540, end: 660 },
      { start: 700, end: 720 },
    ]);
  });

  it("包含关系取并集而不是相加", () => {
    expect(mergeRanges([{ start: 540, end: 720 }, { start: 600, end: 660 }])).toEqual([
      { start: 540, end: 720 },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe("freeSlots", () => {
  it("一天没课时整段都可安排", () => {
    expect(freeSlots([], WINDOW, 30)).toEqual([{ start: 480, end: 1320, minutes: 840 }]);
  });

  it("按课程切出空档并算好时长", () => {
    const busy = busyRanges([
      classItem(9, 0, 10, 0),
      classItem(11, 0, 12, 0),
      classItem(14, 0, 15, 30),
    ]);
    expect(freeSlots(busy, WINDOW, 30)).toEqual([
      { start: 480, end: 540, minutes: 60 },
      { start: 600, end: 660, minutes: 60 },
      { start: 720, end: 840, minutes: 120 },
      { start: 930, end: 1320, minutes: 390 },
    ]);
  });

  it("太短的空档会被过滤掉", () => {
    const busy = busyRanges([classItem(9, 0, 10, 0), classItem(10, 20, 12, 0)]);
    expect(freeSlots(busy, WINDOW, 30)).toEqual([
      { start: 480, end: 540, minutes: 60 },
      { start: 720, end: 1320, minutes: 600 },
    ]);
    expect(freeSlots(busy, WINDOW, 15)).toEqual([
      { start: 480, end: 540, minutes: 60 },
      { start: 600, end: 620, minutes: 20 },
      { start: 720, end: 1320, minutes: 600 },
    ]);
  });

  it("超出时间范围的课程会被裁掉", () => {
    const busy = busyRanges([classItem(7, 0, 8, 30), classItem(21, 30, 23, 0)]);
    expect(freeSlots(busy, WINDOW, 30)).toEqual([{ start: 510, end: 1290, minutes: 780 }]);
  });

  it("课程占满整段时间时没有空档", () => {
    expect(freeSlots(busyRanges([classItem(8, 0, 22, 0)]), WINDOW, 30)).toEqual([]);
  });

  it("首尾相接的课程之间不留空档", () => {
    const busy = busyRanges([classItem(9, 0, 10, 0), classItem(10, 0, 11, 0)]);
    expect(freeSlots(busy, WINDOW, 30)).toEqual([
      { start: 480, end: 540, minutes: 60 },
      { start: 660, end: 1320, minutes: 660 },
    ]);
  });

  it("时间范围本身非法时返回空", () => {
    expect(freeSlots([], { start: 600, end: 600 }, 30)).toEqual([]);
    expect(freeSlots([], { start: 600, end: 500 }, 30)).toEqual([]);
  });
});