import { Capacitor } from "@capacitor/core";

export type AppPlatform = "web" | "android" | "ios";

/** 当前运行环境：原生壳里是 android / ios，浏览器里是 web。 */
export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "android") return "android";
  if (platform === "ios") return "ios";
  return "web";
}

/** 是否跑在 Capacitor 打包的原生应用里（决定用系统通知还是网页通知）。 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
