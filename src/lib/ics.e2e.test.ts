import { describe, expect, it } from "vitest";
import { buildIcs, unfoldIcsLines } from "./ics";
import { DEFAULT_PERIODS } from "./periods";
import type { Course, Settings, Task } from "../types";

/** 一份贴近真实使用的样本：普通课 + 单周课 + 单次待办 + 每日待办。 */
const SETTINGS: Settings = {
  termStart: "2026-09-07",
  classLeadMinutes: 10,
  taskLeadMinutes: 15,
  nickname: "",
  freeStart: "08:00",
  freeEnd: "22:00",
  periods: DEFAULT_PERIODS,
};

const COURSES: Course[] = [
  {
    id: "c1",
    name: "高等数学",
    teacher: "张老师",
    room: "一教101",
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    startWeek: 1,
    endWeek: 2,
    parity: "all",
    color: "",
    note: "",
  },
  {
    id: "c2",
    name: "大学英语",
    teacher: "李老师",
    room: "外语楼305",
    weekday: 3,
    startPeriod: 3,
    endPeriod: 4,
    startWeek: 1,
    endWeek: 3,
    parity: "odd",
    color: "",
    note: "",
  },
];

const TASKS: Task[] = [
  {
    id: "t1",
    title: "交实验报告",
    note: "记得带,附件;和签名",
    date: "2026-09-16",
    time: "14:00",
    repeat: "none",
    weekdays: [],
    done: false,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "t2",
    title: "背单词",
    note: "",
    date: "2026-09-16",
    time: "21:00",
    repeat: "daily",
    weekdays: [],
    done: false,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];

const ICS = buildIcs(TASKS, COURSES, SETTINGS, new Date(Date.UTC(2026, 8, 15)));

function eventOf(uid: string): string[] {
  const lines = unfoldIcsLines(ICS);
  const uidIndex = lines.indexOf(`UID:${uid}`);
  const start = lines.indexOf("BEGIN:VEVENT", uidIndex - 1);
  return lines.slice(start, lines.indexOf("END:VEVENT", start) + 1);
}

describe("端到端导出", () => {
  it("普通课按周次逐节展开，起止时间来自作息表", () => {
    expect(eventOf("c1-w1@deadline")).toEqual([
      "BEGIN:VEVENT",
      "UID:c1-w1@deadline",
      "DTSTAMP:20260915T000000Z",
      "DTSTART:20260907T080000",
      "DTEND:20260907T094000",
      "SUMMARY:高等数学",
      "LOCATION:一教101",
      "DESCRIPTION:教师：张老师\\n第 1 周",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT10M",
      "DESCRIPTION:高等数学",
      "END:VALARM",
      "END:VEVENT",
    ]);
  });

  it("单周课只导出奇数周，双周次直接不生成事件", () => {
    expect(ICS).toContain("UID:c2-w1@deadline");
    expect(ICS).toContain("UID:c2-w3@deadline");
    expect(ICS).not.toContain("UID:c2-w2@deadline");
  });

  it("普通课导出到周次范围为止", () => {
    expect(ICS).toContain("UID:c1-w2@deadline");
    expect(ICS).not.toContain("UID:c1-w3@deadline");
  });

  it("单次待办用待办的提前量，描述里的逗号分号已转义", () => {
    const event = eventOf("t1@deadline");
    expect(event).toContain("DTSTART:20260916T140000");
    expect(event).toContain("DTEND:20260916T143000");
    expect(event).toContain("DESCRIPTION:记得带\\,附件\\;和签名");
    expect(event).toContain("TRIGGER:-PT15M");
    expect(event.some((line) => line.startsWith("RRULE:"))).toBe(false);
  });

  it("每日待办用 FREQ=DAILY 而不是展开成多条", () => {
    expect(eventOf("t2@deadline")).toContain("RRULE:FREQ=DAILY");
    expect(ICS.split("UID:t2@deadline")).toHaveLength(2);
  });

  it("整份日历结构闭合，事件数符合预期", () => {
    expect(ICS.split("BEGIN:VEVENT")).toHaveLength(7);
    expect(ICS.split("BEGIN:VALARM")).toHaveLength(7);
    expect(ICS.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});