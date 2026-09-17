import { useState } from "react";
import { Button, Card, EmptyHint, Field, Select, TextInput, Textarea } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { groupTasks, isTaskOverdue, repeatLabel } from "../lib/tasks";
import { WEEKDAY_LABELS } from "../types";
import type { RepeatRule, Task } from "../types";
import { toISODate, weekdayOf } from "../lib/weeks";
import { useQuickAdd } from "../state/quickAdd";
import { useApp } from "../state/store";
import type { NewTaskInput } from "../state/store";

const QUICK_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function emptyInput(now: Date): NewTaskInput {
  return {
    title: "",
    note: "",
    date: toISODate(now),
    time: "09:00",
    repeat: "none",
    weekdays: [weekdayOf(now)],
  };
}

export function TasksPage() {
  const { tasks, addTask, updateTask, removeTask, toggleTask } = useApp();
  const now = useNow(30000);
  const [form, setForm] = useState<NewTaskInput>(() => emptyInput(now));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const groups = groupTasks(tasks, now);
  const todayKey = toISODate(now);

  const startCreate = () => {
    setForm(emptyInput(now));
    setEditingId(null);
    setShowForm(true);
  };

  useQuickAdd("task", startCreate);

  const startEdit = (task: Task) => {
    setForm({
      title: task.title,
      note: task.note,
      date: task.date,
      time: task.time,
      repeat: task.repeat,
      weekdays: task.weekdays,
    });
    setEditingId(task.id);
    setShowForm(true);
  };

  const submit = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload: NewTaskInput = { ...form, title };
    if (editingId) updateTask(editingId, payload);
    else addTask(payload);
    setShowForm(false);
    setEditingId(null);
  };

  const toggleWeekday = (day: number) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((value) => value !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b),
    }));
  };

  const taskHint = (task: Task): string => {
    if (task.repeat === "daily") return `每天 ${task.time}`;
    if (task.repeat === "weekly") return repeatLabel(task);
    return `${task.date === todayKey ? "今天" : task.date} ${task.time}`;
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">待办</h1>
        <Button onClick={startCreate}>+ 新待办</Button>
      </div>

      {showForm && (
        <Card title={editingId ? "编辑待办" : "新建待办"}>
          <div className="space-y-3">
            <Field label="要做什么">
              <TextInput
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：交实验报告"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="日期">
                <TextInput
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </Field>
              <Field label="时间">
                <TextInput
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </Field>
            </div>

            <Field label="重复">
              <Select
                value={form.repeat}
                onChange={(event) =>
                  setForm({ ...form, repeat: event.target.value as RepeatRule })
                }
              >
                <option value="none">不重复</option>
                <option value="daily">每天</option>
                <option value="weekly">每周固定几天</option>
              </Select>
            </Field>

            {form.repeat === "weekly" && (
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">重复的星期</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_WEEKDAYS.map((day) => {
                    const active = form.weekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          active
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {WEEKDAY_LABELS[day - 1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="备注" hint="也会写进导出的日历事件描述里">
              <Textarea
                rows={2}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="可选"
              />
            </Field>

            <div className="flex gap-2">
              <Button onClick={submit} disabled={!form.title.trim()}>
                {editingId ? "保存" : "添加"}
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                取消
              </Button>
            </div>
          </div>
        </Card>
      )}

      {groups.length === 0 ? (
        <EmptyHint>还没有待办，点右下角「+ 添加」加一条</EmptyHint>
      ) : (
        groups.map((group) => (
          <Card key={group.key} title={`${group.label} ${group.tasks.length}`}>
            <ul className="space-y-2">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  overdue={group.key === "today" && isTaskOverdue(task, now)}
                  hint={taskHint(task)}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => startEdit(task)}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </ul>
          </Card>
        ))
      )}
    </>
  );
}

function TaskRow({
  task,
  overdue,
  hint,
  onToggle,
  onEdit,
  onRemove,
}: {
  task: Task;
  overdue: boolean;
  hint: string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
        overdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-indigo-600"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            task.done ? "text-slate-400 line-through" : overdue ? "text-red-700" : "text-slate-900"
          }`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {hint}
          {task.note ? ` · ${task.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={onEdit}>
          编辑
        </Button>
        <Button variant="danger" className="!px-2 !py-1 !text-xs" onClick={onRemove}>
          删除
        </Button>
      </div>
    </li>
  );
}