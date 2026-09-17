import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field, Tag, TextInput } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { pickFile } from "../lib/download";
import { buildEvents, buildIcs } from "../lib/ics";
import {
  currentExactAlarmPermission,
  currentNotificationPermission,
  openExactAlarmSettings,
  pendingNativeReminders,
  requestNotificationPermission,
  showTestNotification,
  type ExactAlarmPermission,
  type NotifyPermission,
} from "../lib/notifications";
import {
  DEFAULT_BREAK_MINUTES,
  DEFAULT_PERIODS,
  DEFAULT_CLASS_MINUTES,
  DEFAULT_FIRST_PERIOD,
  formatHHMM,
  parseHHMM,
} from "../lib/periods";
import { appPlatform, isNativeApp } from "../lib/platform";
import { cancelDeviceReminders, lastReminderSync, syncDeviceReminders } from "../lib/reminderSync";
import { sampleCourses } from "../lib/samples";
import { saveTextFile } from "../lib/saveFile";
import { buildBackup, readBackup } from "../lib/storage";
import { currentWeek, mondayOfWeek, toISODate } from "../lib/weeks";
import { DEFAULT_LEAD_MINUTES } from "../types";
import type { PeriodTime } from "../types";
import { useApp } from "../state/store";

/** 安卓按文件扩展名判断类型，导出的文件名必须是纯 ASCII */
const ICS_FILENAME = "class-schedule.ics";
const BACKUP_FILENAME = "deadline-backup.json";

const PERMISSION_LABELS: Record<NotifyPermission, string> = {
  granted: "已允许",
  denied: "已拒绝",
  prompt: "未请求",
  unsupported: "不支持",
};

function formatMoment(timestamp: number | null): string {
  if (timestamp === null) return "—";
  const date = new Date(timestamp);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${time}`;
}

export function SettingsPage() {
  const { tasks, courses, settings, addCourses, updateSettings, replaceAll, resetAll } = useApp();
  const now = useNow(60000);
  const week = currentWeek(settings.termStart, now);
  const native = isNativeApp();

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotifyPermission>("prompt");
  const [exactAlarm, setExactAlarm] = useState<ExactAlarmPermission>("unsupported");
  const [pendingCount, setPendingCount] = useState(0);

  const eventCount = buildEvents(tasks, courses, settings).length;
  const sync = lastReminderSync();

  const refreshNotificationStatus = useCallback(async () => {
    setPermission(await currentNotificationPermission());
    setExactAlarm(await currentExactAlarmPermission());
    setPendingCount(await pendingNativeReminders());
  }, []);

  useEffect(() => {
    void refreshNotificationStatus();
  }, [refreshNotificationStatus]);

  const runBusy = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const exportIcs = () =>
    runBusy(async () => {
      const outcome = await saveTextFile({
        filename: ICS_FILENAME,
        downloadName: "课表与待办.ics",
        content: buildIcs(tasks, courses, settings),
        mime: "text/calendar;charset=utf-8",
        title: "课表与待办",
      });
      if (!outcome.ok) {
        setStatus(outcome.message);
        return;
      }
      setStatus(
        native
          ? `已生成 ${ICS_FILENAME}（${eventCount} 个事件）。在分享面板里选「日历」即可导入；如果列表里没有日历，选「保存到文件」再去文件管理器里点开它。`
          : `已导出 ${eventCount} 个日历事件。下载完成后在手机上点开该文件，选择用「日历」打开即可导入。`,
      );
    });

  const exportJson = () =>
    runBusy(async () => {
      const outcome = await saveTextFile({
        filename: BACKUP_FILENAME,
        downloadName: BACKUP_FILENAME,
        content: JSON.stringify(buildBackup(tasks, courses, settings), null, 2),
        mime: "application/json;charset=utf-8",
        title: "deadline 备份",
      });
      setStatus(outcome.message);
    });

  const importJson = async () => {
    const file = await pickFile("application/json,.json");
    if (!file) return;
    try {
      const data = readBackup(JSON.parse(await file.text()));
      if (!data) {
        setStatus("文件内容不对，至少需要包含 tasks 或 courses 字段。");
        return;
      }
      replaceAll(data);
      setStatus(`已导入 ${data.tasks.length} 个待办、${data.courses.length} 门课程。`);
    } catch {
      setStatus("JSON 解析失败，请确认选的是本应用导出的备份文件。");
    }
  };

  const requestPermission = () =>
    runBusy(async () => {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === "granted") {
        await showTestNotification(5);
        setStatus(
          native
            ? "系统通知已开启，5 秒后会弹一条测试通知。关掉应用也会照常提醒。"
            : "网页通知已开启，5 秒内会弹一条测试通知。注意：只有页面还开着时才会提醒。",
        );
      } else if (result === "unsupported") {
        setStatus("当前环境不支持通知，请用导出的 .ics 交给系统日历提醒。");
      } else {
        setStatus(
          "通知权限被拒绝。到「系统设置 → 应用 → 课表与待办 → 通知」里手动打开，提醒才会响。",
        );
      }
      await refreshNotificationStatus();
    });

  const resyncReminders = () =>
    runBusy(async () => {
      const state = await syncDeviceReminders(tasks, courses, settings, { ask: true });
      await refreshNotificationStatus();
      if (state.warning) {
        setStatus(`排程完成，但系统提示：${state.warning}`);
        return;
      }
      setStatus(
        native
          ? `已排入 ${state.scheduled} 条系统通知，最近一条 ${formatMoment(state.firstAt)}。`
          : `接下来两周共有 ${state.planned} 条提醒，网页端只在页面打开时弹出，建议导出 .ics 或安装安卓版。`,
      );
    });

  const testNotification = () =>
    runBusy(async () => {
      const sent = await showTestNotification(5);
      setStatus(sent ? "5 秒后弹出测试通知。" : "通知没有发出去，请先开启通知权限。");
    });

  const grantExactAlarm = () =>
    runBusy(async () => {
      const result = await openExactAlarmSettings();
      setExactAlarm(result);
      setStatus("系统设置里打开「闹钟和提醒」后回来，提醒才能精确到分钟。");
    });

  const clearAll = () =>
    runBusy(async () => {
      if (!window.confirm("确定清空所有课程、待办和设置吗？此操作不可恢复。")) return;
      resetAll();
      await cancelDeviceReminders();
      await refreshNotificationStatus();
      setStatus("已清空全部数据，并撤掉了所有已排程的提醒。");
    });

  const updatePeriod = (index: number, patch: Partial<PeriodTime>) => {
    updateSettings({
      periods: settings.periods.map((period) =>
        period.index === index ? { ...period, ...patch } : period,
      ),
    });
  };

  const addPeriod = () => {
    const last = settings.periods[settings.periods.length - 1];
    const nextIndex = (last?.index ?? 0) + 1;
    const startMinutes = last
      ? (parseHHMM(last.end) ?? parseHHMM(DEFAULT_FIRST_PERIOD) ?? 480) + DEFAULT_BREAK_MINUTES
      : (parseHHMM(DEFAULT_FIRST_PERIOD) ?? 480);
    updateSettings({
      periods: [
        ...settings.periods,
        {
          index: nextIndex,
          start: formatHHMM(startMinutes),
          end: formatHHMM(startMinutes + DEFAULT_CLASS_MINUTES),
        },
      ],
    });
  };

  const removePeriod = (index: number) => {
    if (settings.periods.length <= 1) return;
    updateSettings({ periods: settings.periods.filter((period) => period.index !== index) });
  };

  const loadSample = () => {
    addCourses(sampleCourses());
    setStatus("已加入 5 门示例课程，可以到「课表」里改或删掉。");
  };

  const applyDefaultPeriods = () => {
    updateSettings({ periods: DEFAULT_PERIODS.map((period) => ({ ...period })) });
    setStatus("已套用川农作息（5 大节 / 10 小节），可以直接在上面微调。");
  };

  const leadToText = (value: number | null) => (value === null ? "" : String(value));
  const textToLead = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  };

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">设置</h1>

      {status && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
          {status}
        </div>
      )}

      <Card title="学期" subtitle="课表的第 1 周从这一天开始算">
        <div className="space-y-3">
          <Field label="第 1 周周一" hint={`当前是第 ${week > 0 ? week : 0} 周`}>
            <TextInput
              type="date"
              value={settings.termStart}
              onChange={(event) => updateSettings({ termStart: event.target.value })}
            />
          </Field>
          <Button variant="subtle" onClick={() => updateSettings({ termStart: toISODate(mondayOfWeek(now)) })}>
            设为本周一
          </Button>
        </div>
      </Card>

      <Card
        title="提醒"
        subtitle={native ? "由安卓系统负责响，关掉应用也会提醒" : "留空就用默认的 10 分钟"}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="课前提前（分钟）">
            <TextInput
              type="number"
              min={0}
              inputMode="numeric"
              value={leadToText(settings.classLeadMinutes)}
              placeholder={String(DEFAULT_LEAD_MINUTES)}
              onChange={(event) =>
                updateSettings({ classLeadMinutes: textToLead(event.target.value) })
              }
            />
          </Field>
          <Field label="待办提前（分钟）">
            <TextInput
              type="number"
              min={0}
              inputMode="numeric"
              value={leadToText(settings.taskLeadMinutes)}
              placeholder={String(DEFAULT_LEAD_MINUTES)}
              onChange={(event) =>
                updateSettings({ taskLeadMinutes: textToLead(event.target.value) })
              }
            />
          </Field>
        </div>

        <dl className="mt-4 space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <dt>应用形态</dt>
            <dd>
              <Tag tone="blue">
                {native ? (appPlatform() === "android" ? "安卓应用" : "iOS 应用") : "网页版"}
              </Tag>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>通知权限</dt>
            <dd>
              <Tag tone={permission === "granted" ? "green" : permission === "denied" ? "red" : "slate"}>
                {PERMISSION_LABELS[permission]}
              </Tag>
            </dd>
          </div>
          {exactAlarm !== "unsupported" && (
            <div className="flex items-center justify-between gap-2">
              <dt>精确闹钟权限</dt>
              <dd>
                <Tag tone={exactAlarm === "granted" ? "green" : "amber"}>
                  {exactAlarm === "granted" ? "已允许" : "未允许"}
                </Tag>
              </dd>
            </div>
          )}
          {native && (
            <div className="flex items-center justify-between gap-2">
              <dt>系统里已排程</dt>
              <dd>{pendingCount} 条</dd>
            </div>
          )}
          {native && sync && (
            <div className="flex items-center justify-between gap-2">
              <dt>本次排程覆盖到</dt>
              <dd>{formatMoment(sync.lastAt)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          {permission !== "granted" ? (
            <Button onClick={requestPermission} disabled={busy}>
              开启通知权限
            </Button>
          ) : (
            <Button variant="subtle" onClick={testNotification} disabled={busy}>
              发一条测试通知
            </Button>
          )}
          {native && (
            <Button variant="subtle" onClick={resyncReminders} disabled={busy}>
              重新排程
            </Button>
          )}
          {native && exactAlarm === "denied" && (
            <Button variant="subtle" onClick={grantExactAlarm} disabled={busy}>
              去开启精确闹钟
            </Button>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {native
            ? "提醒会提前排好两周，每次打开应用自动续上。手机上省电策略很激进的机型，建议把这个应用加进「后台运行白名单」。"
            : "网页通知只在页面打开时才会弹，最可靠的办法还是下面导出的 .ics，或者装成安卓应用。"}
        </p>
      </Card>

      <Card title="导出到系统日历" subtitle="最稳的提醒方式，由日历应用负责准点响">
        <p className="text-xs leading-relaxed text-slate-500">
          会生成 {eventCount} 个事件：课程按周次逐节展开，待办带上提前提醒。课表在 1-16 周共 16 次课就会生成
          16 个事件。
          {native
            ? "点下面的按钮会弹出系统分享面板，选「日历」就能导入。"
            : "下载后在手机上点开 .ics 文件，选择用系统日历打开即可导入。"}
        </p>
        <div className="mt-3">
          <Button onClick={exportIcs} disabled={eventCount === 0 || busy}>
            {native ? "导出并分享 .ics" : "导出 .ics 日历文件"}
          </Button>
        </div>
      </Card>

      <Card
        title="作息时间"
        subtitle="课表根据这里的节次时间推算提醒时刻"
        action={
          <Button variant="subtle" onClick={addPeriod}>
            + 加一节
          </Button>
        }
      >
        <ul className="space-y-2">
          {settings.periods.map((period) => (
            <li key={period.index} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-slate-500">第 {period.index} 节</span>
              <TextInput
                type="time"
                value={period.start}
                onChange={(event) => updatePeriod(period.index, { start: event.target.value })}
              />
              <span className="text-xs text-slate-400">—</span>
              <TextInput
                type="time"
                value={period.end}
                onChange={(event) => updatePeriod(period.index, { end: event.target.value })}
              />
              <Button
                variant="ghost"
                className="!shrink-0 !px-2 !py-1 !text-xs"
                onClick={() => removePeriod(period.index)}
              >
                删
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="subtle" onClick={applyDefaultPeriods}>
            套用川农作息（5 大节）
          </Button>
          <span className="text-[11px] text-slate-400">
            上午 2 大节 + 下午 2 大节 + 晚上 1 大节，每个大节 2 学时
          </span>
        </div>
      </Card>

      <Card title="个人信息" subtitle="只影响首页的问候语，不会上传到任何地方">
        <Field label="怎么称呼你" hint="留空就只显示「早上好」">
          <TextInput
            value={settings.nickname}
            maxLength={12}
            onChange={(event) => updateSettings({ nickname: event.target.value })}
            placeholder="例如：小张"
          />
        </Field>
      </Card>

      <Card title="空闲时间" subtitle="首页算空档时只统计这个区间">
        <div className="grid grid-cols-2 gap-3">
          <Field label="可安排起点">
            <TextInput
              type="time"
              value={settings.freeStart}
              onChange={(event) => updateSettings({ freeStart: event.target.value })}
            />
          </Field>
          <Field label="可安排终点">
            <TextInput
              type="time"
              value={settings.freeEnd}
              onChange={(event) => updateSettings({ freeEnd: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title="示例数据" subtitle="想先看看用起来是什么样，可以放一份示例课表进去">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="subtle" onClick={loadSample}>
            创建示例课表（5 门）
          </Button>
          <span className="text-[11px] text-slate-400">
            {courses.length > 0
              ? `当前已有 ${courses.length} 门课，点一下会再追加 5 门`
              : "会写入 5 门课，随时可以删掉"}
          </span>
        </div>
      </Card>

      <Card title="备份" subtitle="数据只存在这台设备上，卸载或清数据会丢">
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" onClick={exportJson} disabled={busy}>
            导出 JSON
          </Button>
          <Button variant="subtle" onClick={importJson}>
            导入 JSON
          </Button>
          <Button variant="danger" onClick={clearAll} disabled={busy}>
            清空全部数据
          </Button>
        </div>
      </Card>

      <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-slate-400">
        {native
          ? "数据保存在本机，不上传任何服务器。换设备时用上面的 JSON 备份搬过去。"
          : "当前是网页版，数据保存在本机浏览器中。安装安卓版后提醒改为系统级本地通知，关掉应用也会响。"}
      </p>
    </>
  );
}