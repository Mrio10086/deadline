import { describe, expect, it } from "vitest";
import { foldIcsLine, unfoldIcsLines } from "./ics";

/**
 * 折行属性回归：折行是这个导出流程里最容易悄悄坏掉的一环。
 * 只要把一个多字节字符截成两半，系统日历就会显示乱码甚至整份文件导入失败，
 * 所以这里用大量随机中文 / ASCII / 符号混合串，验证「折行后必须逐字还原」。
 */
const ALPHABET = [
  ..."高等数学英语物理化学实验报告张老师一教体育馆",
  ..."abcXYZ019 ,;\\-",
  "，",
  "；",
  "（",
  "）",
  "🙂",
];

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("foldIcsLine 属性回归", () => {
  it("任意输入折行后都能逐字还原，且每行不超过 75 字节", () => {
    const random = makeRandom(20260915);

    for (let round = 0; round < 400; round += 1) {
      const length = 1 + Math.floor(random() * 300);
      let original = "";
      for (let index = 0; index < length; index += 1) {
        original += ALPHABET[Math.floor(random() * ALPHABET.length)];
      }

      const folded = foldIcsLine(original);
      const physical = folded.split("\r\n");

      expect(unfoldIcsLines(`${folded}\r\n`)).toEqual([original]);
      for (const line of physical) {
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      }
      for (const line of physical.slice(1)) {
        expect(line.startsWith(" ")).toBe(true);
      }
    }
  });

  it("开头是空格的文本不会被误当成续行", () => {
    const original = `   leading spaces ${"中文".repeat(40)}`;
    expect(unfoldIcsLines(`${foldIcsLine(original)}\r\n`)).toEqual([original]);
  });
});