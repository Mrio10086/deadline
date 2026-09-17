import type { PeriodTime } from "../types";

/** 默认作息：每节 45 分钟，同一大节内的两节之间休 10 分钟。 */
export const DEFAULT_FIRST_PERIOD = "08:00";
export const DEFAULT_CLASS_MINUTES = 45;
export const DEFAULT_BREAK_MINUTES = 10;

/** 一个大节 = 2 学时：45 + 10 + 45 = 100 分钟 */
export const BIG_PERIOD_MINUTES = DEFAULT_CLASS_MINUTES * 2 + DEFAULT_BREAK_MINUTES;

/**
 * 川农把一天分成 5 个大节，教务系统里显示成「12节」「34节」…，每一节次为 2 学时。
 * 上午 2 大节、下午 2 大节、晚上 1 大节；大节之间是长休息，
 * 所以起始时间是一串固定值，不能简单按「上一节结束 + 课间」往后推。
 */
export const BIG_PERIOD_STARTS = ["08:00", "10:00", "14:00", "16:00", "19:00"];

export function formatHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseHHMM(value: string): number | null {
  const match = /^\s*(\d{1,2})\s*[:：]\s*(\d{1,2})\s*$/.exec(value ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 把每个大节的起始时间展开成两小节。 */
export function buildBigPeriods(starts: string[] = BIG_PERIOD_STARTS): PeriodTime[] {
  const periods: PeriodTime[] = [];
  for (const start of starts) {
    const base = parseHHMM(start);
    if (base === null) continue;
    const firstIndex = periods.length + 1;
    periods.push({
      index: firstIndex,
      start: formatHHMM(base),
      end: formatHHMM(base + DEFAULT_CLASS_MINUTES),
    });
    periods.push({
      index: firstIndex + 1,
      start: formatHHMM(base + DEFAULT_CLASS_MINUTES + DEFAULT_BREAK_MINUTES),
      end: formatHHMM(base + BIG_PERIOD_MINUTES),
    });
  }
  return periods;
}

export const DEFAULT_PERIODS: PeriodTime[] = buildBigPeriods();

export function findPeriod(periods: PeriodTime[], index: number): PeriodTime | undefined {
  return periods.find((period) => period.index === index);
}

export function periodStartMinutes(periods: PeriodTime[], index: number): number | null {
  const period = findPeriod(periods, index);
  return period ? parseHHMM(period.start) : null;
}

export function periodEndMinutes(periods: PeriodTime[], index: number): number | null {
  const period = findPeriod(periods, index);
  return period ? parseHHMM(period.end) : null;
}

export function maxPeriodIndex(periods: PeriodTime[]): number {
  return periods.reduce((max, period) => Math.max(max, period.index), 0);
}