export type TabId = "today" | "timetable" | "tasks" | "settings";

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "today", label: "今天", icon: "☀" },
  { id: "timetable", label: "课表", icon: "▦" },
  { id: "tasks", label: "待办", icon: "✓" },
  { id: "settings", label: "设置", icon: "⚙" },
];