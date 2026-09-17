import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Course, Settings, Task } from "../types";
import type { CourseDraft } from "../lib/parseCourses";
import { newId } from "../lib/id";
import {
  STORAGE_KEYS,
  ensureSchemaVersion,
  loadJson,
  normalizeCourses,
  normalizeSettings,
  normalizeTasks,
  removeKey,
  saveJson,
} from "../lib/storage";
import type { BackupData } from "../lib/storage";

export type NewTaskInput = Omit<Task, "id" | "createdAt" | "done">;

interface AppContextValue {
  tasks: Task[];
  courses: Course[];
  settings: Settings;
  addTask: (input: NewTaskInput) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  addCourse: (draft: CourseDraft) => void;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  removeCourse: (id: string) => void;
  addCourses: (drafts: CourseDraft[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (data: BackupData) => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function withIds(drafts: CourseDraft[]): Course[] {
  return drafts.map((draft) => ({ ...draft, id: newId("c") }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    normalizeTasks(loadJson<unknown>(STORAGE_KEYS.tasks, [])),
  );
  const [courses, setCourses] = useState<Course[]>(() =>
    normalizeCourses(loadJson<unknown>(STORAGE_KEYS.courses, [])),
  );
  const [settings, setSettings] = useState<Settings>(() =>
    normalizeSettings(loadJson<unknown>(STORAGE_KEYS.settings, null)),
  );

  useEffect(() => {
    ensureSchemaVersion();
  }, []);

  useEffect(() => {
    saveJson(STORAGE_KEYS.tasks, tasks);
  }, [tasks]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.courses, courses);
  }, [courses]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  const addTask = useCallback((input: NewTaskInput) => {
    setTasks((prev) => [
      ...prev,
      { ...input, id: newId("t"), done: false, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch, id } : task)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }, []);

  const addCourse = useCallback((draft: CourseDraft) => {
    setCourses((prev) => [...prev, { ...draft, id: newId("c") }]);
  }, []);

  const addCourses = useCallback((drafts: CourseDraft[]) => {
    if (drafts.length === 0) return;
    setCourses((prev) => [...prev, ...withIds(drafts)]);
  }, []);

  const updateCourse = useCallback((id: string, patch: Partial<Course>) => {
    setCourses((prev) =>
      prev.map((course) => (course.id === id ? { ...course, ...patch, id } : course)),
    );
  }, []);

  const removeCourse = useCallback((id: string) => {
    setCourses((prev) => prev.filter((course) => course.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch, periods: patch.periods ?? prev.periods }));
  }, []);

  const replaceAll = useCallback((data: BackupData) => {
    setTasks(normalizeTasks(data.tasks));
    setCourses(normalizeCourses(data.courses));
    setSettings(normalizeSettings(data.settings));
  }, []);

  const resetAll = useCallback(() => {
    removeKey(STORAGE_KEYS.tasks);
    removeKey(STORAGE_KEYS.courses);
    removeKey(STORAGE_KEYS.settings);
    removeKey(STORAGE_KEYS.fired);
    setTasks([]);
    setCourses([]);
    setSettings(normalizeSettings(null));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      tasks,
      courses,
      settings,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      addCourse,
      updateCourse,
      removeCourse,
      addCourses,
      updateSettings,
      replaceAll,
      resetAll,
    }),
    [
      tasks,
      courses,
      settings,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      addCourse,
      updateCourse,
      removeCourse,
      addCourses,
      updateSettings,
      replaceAll,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp 必须在 AppProvider 内部使用");
  return context;
}