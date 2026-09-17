import { useState } from "react";
import { TABS } from "./navigation";
import type { TabId } from "./navigation";
import { useReminderTicker } from "./hooks/useReminderTicker";
import { requestQuickAdd } from "./state/quickAdd";
import type { QuickAddKind } from "./state/quickAdd";
import { useApp } from "./state/store";
import { TodayPage } from "./pages/TodayPage";
import { TimetablePage } from "./pages/TimetablePage";
import { TasksPage } from "./pages/TasksPage";
import { SettingsPage } from "./pages/SettingsPage";

const QUICK_ADD_ITEMS: { kind: QuickAddKind; label: string; tab: TabId }[] = [
  { kind: "course", label: "添加课程", tab: "timetable" },
  { kind: "task", label: "添加待办", tab: "tasks" },
];

export function App() {
  const [tab, setTab] = useState<TabId>("today");
  const [menuOpen, setMenuOpen] = useState(false);
  const { tasks, courses, settings } = useApp();

  useReminderTicker(tasks, courses, settings);

  const quickAdd = (kind: QuickAddKind, target: TabId) => {
    requestQuickAdd(kind);
    setTab(target);
    setMenuOpen(false);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <main className="flex-1 space-y-4 px-4 pb-24 pt-5">
        {tab === "today" && <TodayPage onNavigate={setTab} />}
        {tab === "timetable" && <TimetablePage />}
        {tab === "tasks" && <TasksPage />}
        {tab === "settings" && <SettingsPage />}
      </main>

      {menuOpen && (
        <button
          type="button"
          aria-label="收起添加菜单"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-10 cursor-default bg-slate-900/20"
        />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="fab-safe mx-auto flex w-full max-w-2xl flex-col items-end gap-2 px-4">
          {menuOpen &&
            QUICK_ADD_ITEMS.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => quickAdd(item.kind, item.tab)}
                className="pointer-events-auto rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
          <button
            type="button"
            aria-label={menuOpen ? "收起添加菜单" : "添加课程或待办"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-3xl font-light leading-none text-white shadow-lg transition hover:bg-indigo-700 active:bg-indigo-800"
          >
            <span className={`transition-transform ${menuOpen ? "rotate-45" : ""}`}>+</span>
          </button>
        </div>
      </div>

      <nav className="safe-bottom sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {TABS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] transition ${
                  tab === item.id ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}