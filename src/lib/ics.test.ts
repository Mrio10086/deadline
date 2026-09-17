import { describe, expect, it } from "vitest";
import {
  buildEvents,
  buildIcs,
  escapeIcsText,
  expandCourseToEvents,
  foldIcsLine,
  formatFloating,
  formatUtc,
  resolveLeadMinutes,
  taskToEvent,
  unfoldIcsLines,
} from "./ics";
import { DEFAULT_PERIODS } from "./periods";
import type { Course, Settings, Task } from "../types";

const TERM_START = "2026-09-07";
const STAMP = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

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
    endWeek: 2,
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

describe("escapeIcsText", () => {
  it("转义反斜杠、换行、分号和逗号", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("把 CRLF 也归一成 \\n", () => {
    expect(escapeIcsText("第一行\r\n第二行")).toBe("第一行\\n第二行");
  });

  it("先处理反斜杠，避免二次转义", () => {
    expect(escapeIcsText("\\,")).toBe("\\\\\\,");
  });
});

describe("foldIcsLine", () => {
  it("短行原样返回", () => {
    expect(foldIcsLine("SUMMARY:数学")).toBe("SUMMARY:数学");
  });

  it("按 UTF-8 字节折行，每行不超过 75 字节", () => {
    const folded = foldIcsLine(`SUMMARY:${"高等数学".repeat(30)}`);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const line of physical) {
      expect(byteLength(line)).toBeLessThanOrEqual(75);
    }
    for (const line of physical.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
    }
  });

  it("折行不会把中文字符截断，展开后与原文一致", () => {
    const original = `DESCRIPTION:${"人工智能导论".repeat(20)}`;
    const ics = `${foldIcsLine(original)}\r\n`;
    expect(unfoldIcsLines(ics)).toEqual([original]);
  });
});

describe("时间格式", () => {
  it("浮动本地时间不带 Z", () => {
    expect(formatFloating(new Date(2026, 8, 16, 9, 50))).toBe("20260916T095000");
  });

  it("UTC 时间带 Z", () => {
    expect(formatUtc(STAMP)).toBe("20260101T000000Z");
  });
});

describe("resolveLeadMinutes", () => {
  it("留空回落到默认 10 分钟", () => {
    expect(resolveLeadMinutes(null)).toBe(10);
    expect(resolveLeadMinutes(undefined)).toBe(10);
    expect(resolveLeadMinutes(Number.NaN)).toBe(10);
    expect(resolveLeadMinutes(-5)).toBe(10);
  });

  it("保留合法的自定义值，含 0", () => {
    expect(resolveLeadMinutes(0)).toBe(0);
    expect(resolveLeadMinutes(25)).toBe(25);
  });
});

describe("expandCourseToEvents", () => {
  it("按周次逐节展开，每节课一个事件", () => {
    const events = expandCourseToEvents(makeCourse(), makeSettings());
    expect(events).toHaveLength(2);
    expect(events[0].uid).toBe("c1-w1@deadline");
    expect(formatFloating(events[0].start)).toBe("20260909T100000");
    expect(formatFloating(events[0].end)).toBe("20260909T114000");
    expect(formatFloating(events[1].start)).toBe("20260916T100000");
  });

  it("单双周只展开匹配的周次", () => {
    const events = expandCourseToEvents(
      makeCourse({ startWeek: 1, endWeek: 6, parity: "odd" }),
      makeSettings(),
    );
    expect(events.map((event) => event.uid)).toEqual(["c1-w1@deadline", "c1-w3@deadline", "c1-w5@deadline"]);
  });

  it("节次在作息表里找不到时不生成事件", () => {
    expect(expandCourseToEvents(makeCourse({ startPeriod: 99 }), makeSettings())).toHaveLength(0);
  });

  it("教师写进描述、教室写进地点", () => {
    const [event] = expandCourseToEvents(makeCourse(), makeSettings());
    expect(event.location).toBe("一教101");
    expect(event.description).toContain("教师：张老师");
    expect(event.description).toContain("第 1 周");
  });
});

describe("taskToEvent", () => {
  it("单次待办没有 RRULE，默认 30 分钟", () => {
    const event = taskToEvent(makeTask(), null);
    expect(event?.rrule).toBeNull();
    expect(formatFloating(event!.start)).toBe("20260916T140000");
    expect(formatFloating(event!.end)).toBe("20260916T143000");
    expect(event?.alarmMinutes).toBe(10);
  });

  it("每天重复用 FREQ=DAILY", () => {
    expect(taskToEvent(makeTask({ repeat: "daily" }), 5)?.rrule).toBe("FREQ=DAILY");
  });

  it("每周重复按星期展开为 BYDAY", () => {
    const event = taskToEvent(makeTask({ repeat: "weekly", weekdays: [5, 1, 3] }), null);
    expect(event?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("每周重复没选星期时回落到待办日期所在星期", () => {
    const event = taskToEvent(makeTask({ repeat: "weekly", weekdays: [], date: "2026-09-16" }), null);
    expect(event?.rrule).toBe("FREQ=WEEKLY;BYDAY=WE");
  });

  it("日期或时间非法时返回 null", () => {
    expect(taskToEvent(makeTask({ date: "2026-02-30" }), null)).toBeNull();
    expect(taskToEvent(makeTask({ time: "25:00" }), null)).toBeNull();
  });
});

describe("buildIcs", () => {
  const singleWeek = makeCourse({ startWeek: 1, endWeek: 1 });
  const ics = buildIcs([makeTask()], [singleWeek], makeSettings(), STAMP);

  it("结构完整", () => {
    const lines = unfoldIcsLines(ics);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("只用 CRLF 换行，没有裸 LF", () => {
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(ics).toContain("\r\n");
  });

  it("课程和待办都生成了事件", () => {
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(3);
    expect(ics.split("END:VEVENT")).toHaveLength(3);
  });

  it("每个事件都带 VALARM 提醒", () => {
    expect(ics.split("BEGIN:VALARM")).toHaveLength(3);
    expect(ics).toContain("TRIGGER:-PT10M");
  });

  it("自定义提前量会体现在 TRIGGER 上", () => {
    const custom = buildIcs([makeTask()], [makeCourse()], makeSettings({ classLeadMinutes: 0 }), STAMP);
    expect(custom).toContain("TRIGGER:-PT0M");
    const twenty = buildIcs([], [makeCourse()], makeSettings({ classLeadMinutes: 20 }), STAMP);
    expect(twenty).toContain("TRIGGER:-PT20M");
  });

  it("事件按开始时间排序", () => {
    const events = buildEvents([makeTask()], [makeCourse()], makeSettings());
    expect(events.map((event) => formatFloating(event.start))).toEqual([
      "20260909T100000",
      "20260916T100000",
      "20260916T140000",
    ]);
  });

  it("已完成的待办不会导出", () => {
    const withDone = buildIcs([makeTask({ done: true })], [], makeSettings(), STAMP);
    expect(withDone).not.toContain("BEGIN:VEVENT");
  });

  it("描述和地点里的特殊字符会被转义", () => {
    const escaped = buildIcs(
      [makeTask({ note: "带,逗号;和分号" })],
      [makeCourse({ room: "一教,101" })],
      makeSettings(),
      STAMP,
    );
    expect(escaped).toContain("DESCRIPTION:带\\,逗号\\;和分号");
    expect(escaped).toContain("LOCATION:一教\\,101");
  });

  it("中文长文本折行后仍能被正确还原", () => {
    const name = "高等数学（含实验课与习题课）";
    const folded = buildIcs([], [makeCourse({ name })], makeSettings(), STAMP);
    const summary = unfoldIcsLines(folded).find((line) => line.startsWith("SUMMARY:"));
    expect(summary).toBe(`SUMMARY:${name}`);
    for (const line of folded.split("\r\n")) {
      expect(byteLength(line)).toBeLessThanOrEqual(75);
    }
  });
});