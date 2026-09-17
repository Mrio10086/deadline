import { describe, expect, it } from "vitest";
import {
  parseCourseLines,
  parseParity,
  parsePeriodRange,
  parseWeekRange,
  parseWeekday,
} from "./parseCourses";

describe("parseWeekday", () => {
  it("认识多种中文写法", () => {
    expect(parseWeekday("周一")).toBe(1);
    expect(parseWeekday("星期三")).toBe(3);
    expect(parseWeekday("礼拜五")).toBe(5);
    expect(parseWeekday("周天")).toBe(7);
    expect(parseWeekday("周日")).toBe(7);
    expect(parseWeekday("周3")).toBe(3);
    expect(parseWeekday(" 4 ")).toBe(4);
  });

  it("无法识别时返回 null", () => {
    expect(parseWeekday("星期八")).toBeNull();
    expect(parseWeekday("")).toBeNull();
  });
});

describe("区间解析", () => {
  it("支持 1-2 与全角波浪号", () => {
    expect(parsePeriodRange("1-2")).toEqual({ start: 1, end: 2 });
    expect(parsePeriodRange("第3～4节")).toEqual({ start: 3, end: 4 });
  });

  it("单个数字视为起止相同", () => {
    expect(parsePeriodRange("5")).toEqual({ start: 5, end: 5 });
    expect(parseWeekRange("7")).toEqual({ start: 7, end: 7 });
  });

  it("顺序反了会自动纠正", () => {
    expect(parsePeriodRange("6-3")).toEqual({ start: 3, end: 6 });
  });

  it("周次支持带「周」后缀", () => {
    expect(parseWeekRange("1-16周")).toEqual({ start: 1, end: 16 });
  });

  it("完全没有数字时返回 null", () => {
    expect(parsePeriodRange("待定")).toBeNull();
  });
});

describe("parseParity", () => {
  it("识别单双周", () => {
    expect(parseParity("单")).toBe("odd");
    expect(parseParity("单周")).toBe("odd");
    expect(parseParity("双周")).toBe("even");
    expect(parseParity("每周")).toBe("all");
    expect(parseParity("")).toBeNull();
  });
});

describe("parseCourseLines", () => {
  it("解析标准一行", () => {
    const result = parseCourseLines("高等数学, 张老师, 一教101, 周一, 1-2, 1-16");
    expect(result.errors).toHaveLength(0);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]).toEqual({
      name: "高等数学",
      teacher: "张老师",
      room: "一教101",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      startWeek: 1,
      endWeek: 16,
      parity: "all",
      note: "",
      color: "",
    });
  });

  it("支持全角逗号与多余空格", () => {
    const result = parseCourseLines("  大学英语 ， 李老师 ，外语楼305， 周三 ， 3-4 ， 1-16 ， 单  ");
    expect(result.errors).toHaveLength(0);
    expect(result.drafts[0].name).toBe("大学英语");
    expect(result.drafts[0].weekday).toBe(3);
    expect(result.drafts[0].parity).toBe("odd");
  });

  it("教师和教室可以留空但必须保留逗号", () => {
    const result = parseCourseLines("体育,,, 周五, 5-6, 2-14");
    expect(result.errors).toHaveLength(0);
    expect(result.drafts[0].teacher).toBe("");
    expect(result.drafts[0].room).toBe("");
  });

  it("周次里带单双周也能识别", () => {
    const result = parseCourseLines("物理, 王老师, 二教201, 周四, 3-4, 1-16单");
    expect(result.drafts[0].parity).toBe("odd");
    expect(result.drafts[0].endWeek).toBe(16);
  });

  it("字段不足时报错并给出行号", () => {
    const result = parseCourseLines("高等数学, 张老师\n英语, 李老师, 一教, 周二, 1-2, 1-16");
    expect(result.drafts).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(1);
    expect(result.errors[0].reason).toContain("字段不足");
  });

  it("星期或节次无法识别时分别报错", () => {
    const result = parseCourseLines("数学, 张, 一教, 星期八, 1-2, 1-16\n英语, 李, 一教, 周二, 待定, 1-16");
    expect(result.drafts).toHaveLength(0);
    expect(result.errors.map((error) => error.line)).toEqual([1, 2]);
    expect(result.errors[0].reason).toContain("星期");
    expect(result.errors[1].reason).toContain("节次");
  });

  it("空行和 # 开头的注释会被跳过", () => {
    const result = parseCourseLines("# 这是我的课表\n\n高等数学, 张老师, 一教101, 周一, 1-2, 1-16\n   ");
    expect(result.drafts).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("空文本返回空结果", () => {
    const result = parseCourseLines("");
    expect(result.drafts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});