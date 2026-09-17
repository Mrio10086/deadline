import { describe, expect, it } from "vitest";
import {
  courseOccursInWeek,
  currentWeek,
  dateOfOccurrence,
  mondayOfWeek,
  parseISODate,
  toISODate,
  weekdayOf,
  weeksForCourse,
} from "./weeks";
import type { Course } from "../types";

/** 2026-09-07 是周一，作为第 1 周的开始。 */
const TERM_START = "2026-09-07";

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "高等数学",
    teacher: "张老师",
    room: "一教101",
    weekday: 3,
    startPeriod: 1,
    endPeriod: 2,
    startWeek: 1,
    endWeek: 16,
    parity: "all",
    color: "",
    note: "",
    ...overrides,
  };
}

describe("currentWeek", () => {
  it("第 1 周周一算第 1 周", () => {
    expect(currentWeek(TERM_START, new Date(2026, 8, 7))).toBe(1);
  });

  it("第 1 周周日仍然是第 1 周", () => {
    expect(currentWeek(TERM_START, new Date(2026, 8, 13))).toBe(1);
  });

  it("第二个周一进入第 2 周", () => {
    expect(currentWeek(TERM_START, new Date(2026, 8, 14))).toBe(2);
  });

  it("开学前一周返回 0，更早返回负数", () => {
    expect(currentWeek(TERM_START, new Date(2026, 7, 31))).toBe(0);
    expect(currentWeek(TERM_START, new Date(2026, 7, 30))).toBe(-1);
  });

  it("学期开始日期非法时返回 0", () => {
    expect(currentWeek("", new Date(2026, 8, 7))).toBe(0);
    expect(currentWeek("2026-13-01", new Date(2026, 8, 7))).toBe(0);
  });
});

describe("日期工具", () => {
  it("weekdayOf 以周一为 1、周日为 7", () => {
    expect(weekdayOf(new Date(2026, 8, 7))).toBe(1);
    expect(weekdayOf(new Date(2026, 8, 13))).toBe(7);
  });

  it("parseISODate 拒绝非法日期", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2026/09/07")).toBeNull();
    expect(toISODate(parseISODate(TERM_START) as Date)).toBe(TERM_START);
  });

  it("mondayOfWeek 回退到本周周一", () => {
    expect(toISODate(mondayOfWeek(new Date(2026, 8, 13)))).toBe(TERM_START);
    expect(toISODate(mondayOfWeek(new Date(2026, 8, 14)))).toBe("2026-09-14");
  });

  it("dateOfOccurrence 按周次和星期推算日期", () => {
    expect(toISODate(dateOfOccurrence(TERM_START, 2, 3) as Date)).toBe("2026-09-16");
    expect(toISODate(dateOfOccurrence(TERM_START, 1, 1) as Date)).toBe("2026-09-07");
    expect(dateOfOccurrence("", 1, 1)).toBeNull();
  });
});

describe("周次展开", () => {
  it("每周课程覆盖全部周次", () => {
    expect(weeksForCourse(course())).toHaveLength(16);
  });

  it("单周只有奇数周", () => {
    const weeks = weeksForCourse(course({ parity: "odd", endWeek: 6 }));
    expect(weeks).toEqual([1, 3, 5]);
  });

  it("双周只有偶数周", () => {
    const weeks = weeksForCourse(course({ parity: "even", endWeek: 6 }));
    expect(weeks).toEqual([2, 4, 6]);
  });

  it("courseOccursInWeek 兼顾边界与单双周", () => {
    expect(courseOccursInWeek(course({ startWeek: 3, endWeek: 5 }), 2)).toBe(false);
    expect(courseOccursInWeek(course({ startWeek: 3, endWeek: 5 }), 3)).toBe(true);
    expect(courseOccursInWeek(course({ startWeek: 3, endWeek: 5 }), 6)).toBe(false);
    expect(courseOccursInWeek(course({ parity: "odd" }), 4)).toBe(false);
    expect(courseOccursInWeek(course({ parity: "odd" }), 5)).toBe(true);
  });
});