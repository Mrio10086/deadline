import { useState } from "react";
import { Button, Card, EmptyHint, Tag } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { toneForCourse } from "../lib/courseColors";
import { FREE_SLOT_CHOICES, busyRanges, freeSlots } from "../lib/freeSlots";
import { formatHHMM, parseHHMM } from "../lib/periods";
import { reminderStatus, remindersForDate } from "../lib/reminders";
import { isTaskOverdue, repeatLabel, sortTasks, taskOccursOn } from "../lib/tasks";
import { currentWeek, parseISODate, toISODate, weekdayOf } from "../lib/weeks";
import { WEEKDAY_LABELS } from "../types";
import { useApp } from "../state/store";
import type { TabId } from "../navigation";

const STATUS_TAG = {
  running: { tone: "green" as const, label: "正在进行" },
  upcoming: { tone: "blue" as const, label: "即将开始" },
  finished: { tone: "slate" as const, label: "已结束" },
};

function greeting(hour: number): string {
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/** 提醒 key 形如 class:<课程 id>:<日期>，日期里只有短横线，所以第一个和最后一个冒号之间就是课程 id */
function courseIdFromKey(key: string): string {
  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  return first >= 0 && last > first ? key.slice(first + 1, last) : "";
}

export function TodayPage({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { tasks, courses, settings, toggleTask } = useApp();
  const now = useNow(30000);

  const [freeDate, setFreeDate] = useState(() => toISODate(now));
  const [minMinutes, setMinMinutes] = useState(60);

  const week = currentWeek(settings.termStart, now);
  const items = remindersForDate(tasks, courses, settings, now);
  const classItems = items.filter((item) => item.kind === "class");
  const todayTasks = sortTasks(tasks.filter((task) => taskOccursOn(task, now)));
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now));

  const openTasks = todayTasks.filter((task) => !task.done).length;
  const toneById = new Map(courses.map((course) => [course.id, toneForCourse(course)]));

  const windowStart = parseHHMM(settings.freeStart) ?? 480;
  const windowEnd = parseHHMM(settings.freeEnd) ?? 1320;
  const queryDate = parseISODate(freeDate) ?? now;
  const freeList = freeSlots(
    busyRanges(
      remindersForDate(tasks, courses, settings, queryDate).filter((item) => item.kind === "class"),
    ),
    { start: windowStart, end: windowEnd },
    minMinutes,
  );
  const todayKey = toISODate(now);

  return (
    <>
      <Card className="!p-5">
        <p className="text-xs text-slate-500">{greeting(now.getHours())}{settings.nickname ? `，${settings.nickname}` : ""}</p>
        <p className="mt-1 text-xs text-slate-400">
          今天是 {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 {WEEKDAY_LABELS[weekdayOf(now) - 1]}
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {week > 0 ? `第 ${week} 周` : "假期中"}
          </h1>
          <span className="text-xs text-slate-400">
            今天 {classItems.length} 节课 · {openTasks} 件事
          </span>
        </div>
        {week <= 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            当前日期早于学期开始日期，课表不会显示。请到「设置」里核对第 1 周周一的日期。
          </p>
        )}
      </Card>

      <Card
        title="今日课程"
        action={
          <Button variant="ghost" onClick={() => onNavigate("timetable")}>
            课表
          </Button>
        }
      >
        {classItems.length === 0 ? (
          <EmptyHint>今天没有课，休息一下 🎉</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {classItems.map((item) => {
              const status = reminderStatus(item, now);
              const tone = toneById.get(courseIdFromKey(item.key));
              return (
                <li
                  key={item.key}
                  className={`flex items-stretch gap-3 rounded-xl border px-3 py-2 ${
                    status === "running"
                      ? "border-emerald-300 bg-emerald-50"
                      : status === "finished"
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <span
                    className={`w-1 shrink-0 rounded-full ${tone ? tone.bar : "bg-slate-300"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          status === "finished" ? "text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {item.title}
                      </span>
                      <Tag tone={STATUS_TAG[status].tone}>{STATUS_TAG[status].label}</Tag>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="空闲时间"
        subtitle={`按课程算出来的空档，默认只算 ${settings.freeStart}-${settings.freeEnd}`}
        action={
          freeDate !== todayKey ? (
            <Button variant="ghost" onClick={() => setFreeDate(todayKey)}>
              回到今天
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">哪一天</span>
            <input
              type="date"
              value={freeDate}
              onChange={(event) => setFreeDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">最少连续</span>
            <select
              value={minMinutes}
              onChange={(event) => setMinMinutes(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {FREE_SLOT_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice} 分钟
                </option>
              ))}
            </select>
          </label>
        </div>

        {freeList.length === 0 ? (
          <div className="mt-3">
            <EmptyHint>这一天没有满足条件的空档</EmptyHint>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {freeList.map((slot) => (
              <li
                key={`${slot.start}-${slot.end}`}
                className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2"
              >
                <span className="text-sm font-medium text-emerald-900">
                  {formatHHMM(slot.start)} - {formatHHMM(slot.end)}
                </span>
                <span className="text-xs text-emerald-700">{slot.minutes} 分钟</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          只统计课程占用，待办不会挡住空档。可安排时间范围在设置里改。
        </p>
      </Card>

      {overdueTasks.length > 0 && (
        <Card title="已逾期" subtitle="这些事的时间已经过了">
          <ul className="space-y-2">
            {overdueTasks.map((task) => (
              <li key={task.id}>
                <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="mt-0.5 h-4 w-4 accent-red-600"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-red-700">{task.title}</span>
                    <span className="mt-0.5 block text-xs text-red-500">{repeatLabel(task)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="今日待办"
        action={
          <Button variant="ghost" onClick={() => onNavigate("tasks")}>
            管理
          </Button>
        }
      >
        {todayTasks.length === 0 ? (
          <EmptyHint>今天还没有安排事情，去「待办」加一条吧</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li key={task.id}>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="mt-0.5 h-4 w-4 accent-indigo-600"
                  />
                  <span className="flex-1">
                    <span
                      className={`block text-sm font-medium ${
                        task.done ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {repeatLabel(task)}
                      {task.note ? ` · ${task.note}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}