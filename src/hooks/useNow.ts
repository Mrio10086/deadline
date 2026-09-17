import { useEffect, useState } from "react";

/** 每 intervalMs 毫秒刷新一次当前时间，用于「当前节次」「逾期」等实时状态。 */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}