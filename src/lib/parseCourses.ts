import type { WeekParity } from "../types";

export interface CourseDraft {
  name: string;
  teacher: string;
  room: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  startWeek: number;
  endWeek: number;
  parity: WeekParity;
  note: string;
  color: string;
}

export interface ParseError {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  drafts: CourseDraft[];
  errors: ParseError[];
}

const WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
};

export function parseWeekday(value: string): number | null {
  const cleaned = (value ?? "").trim().replace(/星期|礼拜|周|weekday/gi, "").trim();
  if (!cleaned) return null;
  const first = Array.from(cleaned)[0];
  return WEEKDAY_MAP[first] ?? null;
}

function rangeFrom(value: string): { start: number; end: number } | null {
  const normalized = (value ?? "").replace(/[~～—－–_至]/g, "-");
  const pair = /(\d+)\s*-\s*(\d+)/.exec(normalized);
  if (pair) {
    let start = Number(pair[1]);
    let end = Number(pair[2]);
    if (start > end) [start, end] = [end, start];
    return { start, end };
  }
  const single = /(\d+)/.exec(normalized);
  if (single) {
    const value2 = Number(single[1]);
    return { start: value2, end: value2 };
  }
  return null;
}

export function parsePeriodRange(value: string): { start: number; end: number } | null {
  return rangeFrom(value);
}

export function parseWeekRange(value: string): { start: number; end: number } | null {
  return rangeFrom(value);
}

export function parseParity(value: string): WeekParity | null {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return null;
  if (/单|odd/i.test(cleaned)) return "odd";
  if (/双|even/i.test(cleaned)) return "even";
  if (/全|每|all/i.test(cleaned)) return "all";
  return null;
}

/**
 * 解析「一行一节课」文本：
 *   课程名, 教师, 教室, 星期, 节次, 周次[, 单双周]
 * 教师 / 教室允许留空，但逗号必须保留；周次里带「单 / 双」也可识别。
 */
export function parseCourseLines(text: string): ParseResult {
  const drafts: CourseDraft[] = [];
  const errors: ParseError[] = [];

  (text ?? "").split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const fields = trimmed.split(/[,，;；\t]/).map((field) => field.trim());
    if (fields.length < 6) {
      errors.push({
        line,
        raw: trimmed,
        reason:
          "字段不足，需要「课程名, 教师, 教室, 星期, 节次, 周次[, 单双周]」，教师和教室可以留空但要保留逗号",
      });
      return;
    }

    const [name, teacher, room, weekdayText, periodText, weekText, parityText] = fields;

    if (!name) {
      errors.push({ line, raw: trimmed, reason: "课程名为空" });
      return;
    }

    const weekday = parseWeekday(weekdayText);
    if (weekday === null) {
      errors.push({ line, raw: trimmed, reason: `无法识别星期「${weekdayText}」` });
      return;
    }

    const periods = parsePeriodRange(periodText);
    if (!periods || periods.start < 1) {
      errors.push({ line, raw: trimmed, reason: `无法识别节次「${periodText}」` });
      return;
    }

    const weeks = parseWeekRange(weekText);
    if (!weeks || weeks.start < 1) {
      errors.push({ line, raw: trimmed, reason: `无法识别周次「${weekText}」` });
      return;
    }

    const parity = parseParity(weekText) ?? parseParity(parityText ?? "") ?? "all";

    drafts.push({
      name,
      teacher,
      room,
      weekday,
      startPeriod: periods.start,
      endPeriod: periods.end,
      startWeek: weeks.start,
      endWeek: weeks.end,
      parity,
      color: "",
      note: "",
    });
  });

  return { drafts, errors };
}