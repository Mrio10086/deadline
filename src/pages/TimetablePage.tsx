import { Fragment, useMemo, useState } from "react";
import { Button, Card, EmptyHint, Field, Select, TextInput, Textarea } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { AUTO_TONE_KEY, COURSE_TONES, toneForCourse } from "../lib/courseColors";
import { parseCourseLines } from "../lib/parseCourses";
import type { CourseDraft, ParseResult } from "../lib/parseCourses";
import { findPeriod, maxPeriodIndex } from "../lib/periods";
import { sampleCourses } from "../lib/samples";
import { courseOccursInWeek, currentWeek, weekdayOf } from "../lib/weeks";
import { useQuickAdd } from "../state/quickAdd";
import { useApp } from "../state/store";
import { PARITY_LABELS, WEEKDAY_LABELS } from "../types";
import type { Course, WeekParity } from "../types";

const EMPTY_DRAFT: CourseDraft = {
  name: "",
  teacher: "",
  room: "",
  weekday: 1,
  startPeriod: 1,
  endPeriod: 2,
  startWeek: 1,
  endWeek: 16,
  parity: "all",
  note: "",
  color: AUTO_TONE_KEY,
};

const BULK_PLACEHOLDER = [
  "一行一节课，逗号分隔：",
  "课程名, 教师, 教室, 星期, 节次, 周次, 单双周",
  "",
  "高等数学, 张老师, 一教101, 周一, 1-2, 1-16",
  "大学英语, 李老师, 外语楼305, 周三, 3-4, 1-16, 单",
  "体育,, 体育馆, 周五, 5-6, 2-14, 双",
].join("\n");

export function TimetablePage() {
  const { courses, settings, addCourse, updateCourse, removeCourse, addCourses } = useApp();
  const now = useNow(60000);

  const thisWeek = Math.max(1, currentWeek(settings.termStart, now));
  const [weekOffset, setWeekOffset] = useState(0);
  const week = Math.max(1, thisWeek + weekOffset);

  const [draft, setDraft] = useState<CourseDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importedHint, setImportedHint] = useState("");

  const weekCourses = useMemo(
    () => courses.filter((course) => courseOccursInWeek(course, week)),
    [courses, week],
  );

  const periodRows = useMemo(() => {
    const maxUsed = courses.reduce((max, course) => Math.max(max, course.endPeriod), 0);
    const count = Math.max(maxPeriodIndex(settings.periods), maxUsed, 1);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [courses, settings.periods]);

  const todayWeekday = weekdayOf(now);

  const startCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(true);
  };

  useQuickAdd("course", startCreate);

  const startEdit = (course: Course) => {
    setDraft({
      name: course.name,
      teacher: course.teacher,
      room: course.room,
      weekday: course.weekday,
      startPeriod: course.startPeriod,
      endPeriod: course.endPeriod,
      startWeek: course.startWeek,
      endWeek: course.endWeek,
      parity: course.parity,
      note: course.note,
      color: course.color,
    });
    setEditingId(course.id);
    setShowForm(true);
  };

  const submit = () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload: CourseDraft = {
      ...draft,
      name,
      startPeriod: Math.min(draft.startPeriod, draft.endPeriod),
      endPeriod: Math.max(draft.startPeriod, draft.endPeriod),
      startWeek: Math.min(draft.startWeek, draft.endWeek),
      endWeek: Math.max(draft.startWeek, draft.endWeek),
    };
    if (editingId) updateCourse(editingId, payload);
    else addCourse(payload);
    setShowForm(false);
    setEditingId(null);
  };

  const loadSample = () => {
    addCourses(sampleCourses());
    setImportedHint("已加入 5 门示例课程，可以直接改或删掉。");
  };

  const runParse = () => setParsed(parseCourseLines(bulkText));

  const confirmImport = () => {
    if (!parsed || parsed.drafts.length === 0) return;
    addCourses(parsed.drafts);
    setImportedHint(`已导入 ${parsed.drafts.length} 门课程。`);
    setBulkText("");
    setParsed(null);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">课表</h1>
        <Button onClick={startCreate}>+ 加课程</Button>
      </div>

      {importedHint && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {importedHint}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <Button variant="subtle" onClick={() => setWeekOffset((value) => value - 1)}>
            上一周
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-900">第 {week} 周</p>
            {weekOffset === 0 ? (
              <p className="text-[11px] text-slate-400">本周</p>
            ) : (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-[11px] text-indigo-600"
              >
                回到本周（第 {thisWeek} 周）
              </button>
            )}
          </div>
          <Button variant="subtle" onClick={() => setWeekOffset((value) => value + 1)}>
            下一周
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto pb-1">
          <div
            className="grid gap-px rounded-xl bg-slate-200 p-px"
            style={{
              minWidth: "620px",
              gridTemplateColumns: "46px repeat(7, minmax(78px, 1fr))",
              gridAutoRows: "56px",
            }}
          >
            <div
              className="flex items-center justify-center bg-slate-50 text-[10px] text-slate-400"
              style={{ gridColumn: 1, gridRow: 1 }}
            >
              节次
            </div>
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={`flex items-center justify-center bg-slate-50 text-xs font-medium ${
                  index + 1 === todayWeekday ? "text-indigo-600" : "text-slate-600"
                }`}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                {label}
              </div>
            ))}

            {periodRows.map((period) => (
              <Fragment key={`row-${period}`}>
                <div
                  className="flex flex-col items-center justify-center bg-slate-50"
                  style={{ gridColumn: 1, gridRow: period + 1 }}
                >
                  <span className="text-[11px] font-semibold text-slate-500">{period}</span>
                  <span className="text-[10px] text-slate-400">
                    {findPeriod(settings.periods, period)?.start ?? "--:--"}
                  </span>
                </div>
                {WEEKDAY_LABELS.map((label, index) => (
                  <div
                    key={`cell-${period}-${label}`}
                    className="bg-white"
                    style={{ gridColumn: index + 2, gridRow: period + 1 }}
                  />
                ))}
              </Fragment>
            ))}

            {weekCourses.map((course) => (
              <button
                key={`${course.id}-${week}`}
                type="button"
                onClick={() => startEdit(course)}
                className={`m-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-left ring-1 ${
                  toneForCourse(course).block
                }`}
                style={{
                  gridColumn: course.weekday + 1,
                  gridRow: `${course.startPeriod + 1} / span ${Math.max(
                    1,
                    course.endPeriod - course.startPeriod + 1,
                  )}`,
                }}
              >
                <span className="block truncate text-[11px] font-semibold">{course.name}</span>
                <span className="mt-0.5 block truncate text-[10px] opacity-70">
                  {course.room || PARITY_LABELS[course.parity]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {courses.length === 0 && (
          <div className="mt-3 space-y-2">
            <EmptyHint>还没有课程，点右上角「加课程」，或用下面的批量录入快速导入</EmptyHint>
            <Button variant="subtle" onClick={loadSample}>
              先放 5 门示例课程试试
            </Button>
          </div>
        )}
      </Card>

      {showForm && (
        <Card title={editingId ? "编辑课程" : "添加课程"}>
          <div className="space-y-3">
            <Field label="课程名">
              <TextInput
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如：高等数学"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="教师">
                <TextInput
                  value={draft.teacher}
                  onChange={(event) => setDraft({ ...draft, teacher: event.target.value })}
                  placeholder="可留空"
                />
              </Field>
              <Field label="教室">
                <TextInput
                  value={draft.room}
                  onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                  placeholder="可留空"
                />
              </Field>
            </div>

            <Field label="星期">
              <Select
                value={draft.weekday}
                onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="开始节次">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.startPeriod}
                  onChange={(event) =>
                    setDraft({ ...draft, startPeriod: Number(event.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="结束节次">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.endPeriod}
                  onChange={(event) =>
                    setDraft({ ...draft, endPeriod: Number(event.target.value) || 1 })
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="开始周">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.startWeek}
                  onChange={(event) =>
                    setDraft({ ...draft, startWeek: Number(event.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="结束周">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.endWeek}
                  onChange={(event) =>
                    setDraft({ ...draft, endWeek: Number(event.target.value) || 1 })
                  }
                />
              </Field>
            </div>

            <Field label="单双周">
              <Select
                value={draft.parity}
                onChange={(event) =>
                  setDraft({ ...draft, parity: event.target.value as WeekParity })
                }
              >
                {(["all", "odd", "even"] as WeekParity[]).map((parity) => (
                  <option key={parity} value={parity}>
                    {PARITY_LABELS[parity]}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <span className="mb-1 block text-xs font-medium text-slate-600">颜色</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, color: AUTO_TONE_KEY })}
                  className={`h-8 rounded-lg border px-2 text-[11px] transition ${
                    draft.color === AUTO_TONE_KEY
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-500"
                  }`}
                >
                  自动
                </button>
                {COURSE_TONES.map((tone) => (
                  <button
                    key={tone.key}
                    type="button"
                    title={tone.label}
                    aria-label={tone.label}
                    onClick={() => setDraft({ ...draft, color: tone.key })}
                    className={`h-8 w-8 rounded-lg ${tone.dot} transition ${
                      draft.color === tone.key
                        ? "ring-2 ring-slate-900 ring-offset-2"
                        : "hover:opacity-80"
                    }`}
                  />
                ))}
              </div>
            </div>

            <Field label="备注" hint="也会写进导出的日历事件描述里">
              <Textarea
                rows={2}
                value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                placeholder="可选"
              />
            </Field>

            <div className="flex gap-2">
              <Button onClick={submit} disabled={!draft.name.trim()}>
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
              {editingId && (
                <Button
                  variant="danger"
                  onClick={() => {
                    removeCourse(editingId);
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  删除
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title="批量录入" subtitle="把课表按「一行一节课」贴进来，比一门门录快得多">
        <Textarea
          rows={6}
          value={bulkText}
          onChange={(event) => {
            setBulkText(event.target.value);
            setParsed(null);
          }}
          placeholder={BULK_PLACEHOLDER}
          className="font-mono !text-xs"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="subtle" onClick={runParse} disabled={!bulkText.trim()}>
            解析预览
          </Button>
          <Button onClick={confirmImport} disabled={!parsed || parsed.drafts.length === 0}>
            导入 {parsed ? parsed.drafts.length : 0} 门课
          </Button>
        </div>

        {parsed && (
          <div className="mt-3 space-y-2">
            {parsed.drafts.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {parsed.drafts.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    {item.name} · {WEEKDAY_LABELS[item.weekday - 1]} · 第 {item.startPeriod}-
                    {item.endPeriod} 节 · {item.startWeek}-{item.endWeek} 周
                    {item.parity === "all" ? "" : ` · ${PARITY_LABELS[item.parity]}`}
                  </li>
                ))}
              </ul>
            )}
            {parsed.errors.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {parsed.errors.map((error) => (
                  <li key={`${error.line}-${error.raw}`}>
                    第 {error.line} 行：{error.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {courses.length > 0 && (
        <Card title={`全部课程 ${courses.length} 门`}>
          <ul className="space-y-2">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneForCourse(course).dot}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{course.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {WEEKDAY_LABELS[course.weekday - 1]} 第 {course.startPeriod}-{course.endPeriod}{" "}
                      节{" · "}
                      {course.startWeek}-{course.endWeek} 周{" · "}
                      {PARITY_LABELS[course.parity]}
                      {course.room ? ` · ${course.room}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  className="!shrink-0 !px-2 !py-1 !text-xs"
                  onClick={() => removeCourse(course.id)}
                >
                  删除
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}