import { describe, expect, it } from "vitest";
import {
  BIG_PERIOD_STARTS,
  DEFAULT_PERIODS,
  buildBigPeriods,
  findPeriod,
  formatHHMM,
  maxPeriodIndex,
  parseHHMM,
  periodEndMinutes,
  periodStartMinutes,
} from "./periods";

describe("默认作息", () => {
  it("5 个大节展开成 10 小节", () => {
    expect(BIG_PERIOD_STARTS).toHaveLength(5);
    expect(DEFAULT_PERIODS).toHaveLength(10);
    expect(DEFAULT_PERIODS.map((period) => period.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("上午两节 08:00-09:40、10:00-11:40", () => {
    expect(DEFAULT_PERIODS[0]).toEqual({ index: 1, start: "08:00", end: "08:45" });
    expect(DEFAULT_PERIODS[1]).toEqual({ index: 2, start: "08:55", end: "09:40" });
    expect(DEFAULT_PERIODS[2]).toEqual({ index: 3, start: "10:00", end: "10:45" });
    expect(DEFAULT_PERIODS[3]).toEqual({ index: 4, start: "10:55", end: "11:40" });
  });

  it("下午两节 14:00-15:40、16:00-17:40", () => {
    expect(DEFAULT_PERIODS[4]).toEqual({ index: 5, start: "14:00", end: "14:45" });
    expect(DEFAULT_PERIODS[5]).toEqual({ index: 6, start: "14:55", end: "15:40" });
    expect(DEFAULT_PERIODS[6]).toEqual({ index: 7, start: "16:00", end: "16:45" });
    expect(DEFAULT_PERIODS[7]).toEqual({ index: 8, start: "16:55", end: "17:40" });
  });

  it("晚上一节 19:00-20:40", () => {
    expect(DEFAULT_PERIODS[8]).toEqual({ index: 9, start: "19:00", end: "19:45" });
    expect(DEFAULT_PERIODS[9]).toEqual({ index: 10, start: "19:55", end: "20:40" });
  });

  it("大节之间是长休息，不是接着上一节往后排", () => {
    const startOf = (index: number) => parseHHMM(DEFAULT_PERIODS[index - 1].start);
    expect(startOf(3)).toBe(600);
    expect(startOf(5)).toBe(840);
    expect(startOf(7)).toBe(960);
    expect(startOf(9)).toBe(1140);
  });

  it("buildBigPeriods 支持自定义大节起始时间", () => {
    const periods = buildBigPeriods(["08:00", "09:00"]);
    expect(periods.map((period) => period.index)).toEqual([1, 2, 3, 4]);
    expect(periods[2]).toEqual({ index: 3, start: "09:00", end: "09:45" });
  });

  it("起始时间非法的大节会被跳过", () => {
    expect(buildBigPeriods(["25:00", "08:00"]).map((period) => period.index)).toEqual([1, 2]);
    expect(buildBigPeriods([])).toEqual([]);
  });
});

describe("时间解析", () => {
  it("接受 HH:MM、个位数和全角冒号", () => {
    expect(parseHHMM("08:00")).toBe(480);
    expect(parseHHMM("8:5")).toBe(485);
    expect(parseHHMM("14：30")).toBe(870);
    expect(parseHHMM(" 09:40 ")).toBe(580);
  });

  it("拒绝越界与非法输入", () => {
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("08:60")).toBeNull();
    expect(parseHHMM("abc")).toBeNull();
    expect(parseHHMM("")).toBeNull();
  });

  it("formatHHMM 补零", () => {
    expect(formatHHMM(480)).toBe("08:00");
    expect(formatHHMM(0)).toBe("00:00");
    expect(formatHHMM(1439)).toBe("23:59");
  });
});

describe("节次查询", () => {
  it("periodStartMinutes / periodEndMinutes 能定位到节次", () => {
    expect(periodStartMinutes(DEFAULT_PERIODS, 3)).toBe(600);
    expect(periodEndMinutes(DEFAULT_PERIODS, 3)).toBe(645);
  });

  it("查不到的节次返回 null", () => {
    expect(periodStartMinutes(DEFAULT_PERIODS, 99)).toBeNull();
    expect(periodEndMinutes([], 1)).toBeNull();
  });

  it("findPeriod 与 maxPeriodIndex", () => {
    expect(findPeriod(DEFAULT_PERIODS, 2)?.start).toBe("08:55");
    expect(findPeriod(DEFAULT_PERIODS, 99)).toBeUndefined();
    expect(maxPeriodIndex(DEFAULT_PERIODS)).toBe(10);
    expect(maxPeriodIndex([])).toBe(0);
  });
});