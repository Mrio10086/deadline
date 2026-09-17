import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.deadline.schedule",
  appName: "课表与待办",
  webDir: "dist",
  android: {
    // 课表/待办全部存本机，不需要任何网络权限能力
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      // res/drawable 里的通知栏小图标
      smallIcon: "ic_stat_deadline",
      iconColor: "#2563eb",
      // res/raw 里的提示音；不配的话安卓 8+ 的通知渠道是静音的
      sound: "notify.wav",
    },
  },
};

export default config;