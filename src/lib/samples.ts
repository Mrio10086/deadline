import type { CourseDraft } from "./parseCourses";

/**
 * 示例课表：给第一次上手的人几门课看看效果。
 * 只有用户主动点「创建示例课表」才会写入，不是写死的假数据。
 */
export function sampleCourses(): CourseDraft[] {
  return [
    {
      name: "高等数学",
      teacher: "王老师",
      room: "一教 A101",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      startWeek: 1,
      endWeek: 16,
      parity: "all",
      note: "",
      color: "indigo",
    },
    {
      name: "大学英语",
      teacher: "李老师",
      room: "外语楼 B203",
      weekday: 2,
      startPeriod: 3,
      endPeriod: 4,
      startWeek: 1,
      endWeek: 16,
      parity: "all",
      note: "",
      color: "emerald",
    },
    {
      name: "大学物理",
      teacher: "赵老师",
      room: "理科楼 305",
      weekday: 3,
      startPeriod: 1,
      endPeriod: 2,
      startWeek: 1,
      endWeek: 16,
      parity: "odd",
      note: "单周上实验",
      color: "amber",
    },
    {
      name: "程序设计基础",
      teacher: "陈老师",
      room: "机房 402",
      weekday: 4,
      startPeriod: 5,
      endPeriod: 6,
      startWeek: 1,
      endWeek: 12,
      parity: "all",
      note: "",
      color: "violet",
    },
    {
      name: "体育",
      teacher: "",
      room: "体育馆",
      weekday: 5,
      startPeriod: 5,
      endPeriod: 6,
      startWeek: 2,
      endWeek: 14,
      parity: "all",
      note: "",
      color: "rose",
    },
  ];
}