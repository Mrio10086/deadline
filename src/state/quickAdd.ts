import { useEffect, useRef } from "react";

export type QuickAddKind = "course" | "task";

let pending: QuickAddKind | null = null;
const listeners = new Set<(kind: QuickAddKind) => void>();

/** 点全局「+ 添加」时调用：先记下来，再通知已经挂载的页面。 */
export function requestQuickAdd(kind: QuickAddKind): void {
  pending = kind;
  for (const listener of listeners) listener(kind);
}

export function consumePendingQuickAdd(kind: QuickAddKind): boolean {
  if (pending !== kind) return false;
  pending = null;
  return true;
}

function subscribe(listener: (kind: QuickAddKind) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 页面接收「+ 添加」的两种时机：
 * 1. 页面还没挂载就先请求了（切页面的场景）——挂载时消费一次；
 * 2. 页面已经挂着（就在当前 tab）——订阅回调里消费。
 */
export function useQuickAdd(kind: QuickAddKind, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (consumePendingQuickAdd(kind)) handlerRef.current();
    return subscribe((requested) => {
      if (requested === kind && consumePendingQuickAdd(kind)) handlerRef.current();
    });
  }, [kind]);
}