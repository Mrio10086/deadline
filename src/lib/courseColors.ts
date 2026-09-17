/**
 * 课程配色。Tailwind 只会生成源码里出现过的类名，
 * 所以这里必须写完整的类名字符串，不能用拼接。
 */
export interface CourseTone {
  key: string;
  label: string;
  /** 课表格子 */
  block: string;
  /** 列表左侧色条 */
  bar: string;
  /** 选色按钮 */
  dot: string;
}

export const AUTO_TONE_KEY = "";

export const COURSE_TONES: CourseTone[] = [
  {
    key: "indigo",
    label: "靛蓝",
    block: "bg-indigo-50 text-indigo-900 ring-indigo-200",
    bar: "bg-indigo-400",
    dot: "bg-indigo-500",
  },
  {
    key: "blue",
    label: "天蓝",
    block: "bg-sky-50 text-sky-900 ring-sky-200",
    bar: "bg-sky-400",
    dot: "bg-sky-500",
  },
  {
    key: "emerald",
    label: "青绿",
    block: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    bar: "bg-emerald-400",
    dot: "bg-emerald-500",
  },
  {
    key: "amber",
    label: "杏黄",
    block: "bg-amber-50 text-amber-900 ring-amber-200",
    bar: "bg-amber-400",
    dot: "bg-amber-500",
  },
  {
    key: "rose",
    label: "玫红",
    block: "bg-rose-50 text-rose-900 ring-rose-200",
    bar: "bg-rose-400",
    dot: "bg-rose-500",
  },
  {
    key: "violet",
    label: "紫罗兰",
    block: "bg-violet-50 text-violet-900 ring-violet-200",
    bar: "bg-violet-400",
    dot: "bg-violet-500",
  },
  {
    key: "teal",
    label: "蓝绿",
    block: "bg-teal-50 text-teal-900 ring-teal-200",
    bar: "bg-teal-400",
    dot: "bg-teal-500",
  },
  {
    key: "slate",
    label: "灰蓝",
    block: "bg-slate-100 text-slate-800 ring-slate-300",
    bar: "bg-slate-400",
    dot: "bg-slate-500",
  },
];

export function toneByKey(key: string): CourseTone | undefined {
  return COURSE_TONES.find((tone) => tone.key === key);
}

/**
 * 课程配色：用户选过就用选的，没选过就按 id 稳定分配一种，
 * 保证同一门课每次打开颜色都一样。
 */
export function toneForCourse(course: { id: string; color: string }): CourseTone {
  const picked = toneByKey(course.color);
  if (picked) return picked;
  let hash = 0;
  for (let index = 0; index < course.id.length; index += 1) {
    hash = (hash * 31 + course.id.charCodeAt(index)) % 9973;
  }
  return COURSE_TONES[hash % COURSE_TONES.length];
}