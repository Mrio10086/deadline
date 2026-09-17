# 我的课表与待办

每日待办 + 课表提醒的**离线应用**：同一套代码既能当手机网页用（PWA），也能打包成安卓 APK。
数据全部存在设备本地，**不需要账号、不需要服务器**。

- **网页版**：`npm run dev`，手机连同一个 WiFi 打开局域网地址即可。
- **安卓版**：`npx cap sync android` + `gradlew assembleDebug` 出 APK，提醒由系统本地通知负责，**关掉应用也会响**。

## 快速开始（网页版）

```bash
npm install
npm run dev
```

启动后终端会打印两个地址：

- `Local: http://localhost:5173/` —— 电脑上打开
- `Network: http://172.x.x.x:5173/` —— **手机连同一个 WiFi 后打开这个地址**

如果手机打不开，是 Windows 防火墙拦了 Node 的入站连接，需要放行一次（管理员权限）：

```powershell
New-NetFirewallRule -DisplayName "Vite dev 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
```

其他命令：

```bash
npm test         # 跑单元测试（107 个）
npm run typecheck # 只做类型检查
npm run build    # 类型检查 + 生产构建到 dist/
npm run preview  # 预览生产构建
```

## 打包安卓 APK

环境要求：**JDK 21 + Android SDK（compileSdk 36）**，Capacitor 8 的硬性要求。

```powershell
$env:JAVA_HOME        = "D:\Android\jdk21"
$env:ANDROID_HOME     = "D:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "D:\Android\Sdk"
$env:GRADLE_USER_HOME = "D:\gradle"
$env:PATH             = "D:\Android\jdk21\bin;$env:PATH"

npm run build                    # 1. 构建网页产物
npx cap sync android             # 2. 把产物和插件同步进安卓工程
cd android
.\gradlew.bat assembleDebug      # 3. 出 APK
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

装到手机：

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

> 建议在 **ASCII 路径、非 OneDrive 同步目录**下做安卓构建（例如 `D:\dev\deadline`）。
> 中文路径 + OneDrive 实时同步会让 Gradle 偶发失败。

## 怎么用

1. **设置 → 学期**：把「第 1 周周一」改成你学校实际的开学第一周周一。
   这是所有周次推算的基准，填错了课表会整体错位。
2. **设置 → 作息时间**：默认按川农的 5 大节排——上午 2 大节（08:00、10:00）、下午 2 大节（14:00、16:00）、
   晚上 1 大节（19:00），每个大节 2 学时，大节之间是长休息。跟学校对不上就直接改上面的时间，改乱了点「套用川农作息」恢复。
3. **课表 → 加课程**：填课程名、星期、节次、周次范围、单双周。周视图可以左右翻周次。
4. **课表 → 批量录入**：课多时用这个，一行一节课：

   ```text
   课程名, 教师, 教室, 星期, 节次, 周次, 单双周
   高等数学, 张老师, 一教101, 周一, 1-2, 1-16
   大学英语, 李老师, 外语楼305, 周三, 3-4, 1-16, 单
   体育,, 体育馆, 周五, 5-6, 2-14, 双
   ```

   教师和教室可以留空，但逗号要保留。星期支持「周一 / 星期一 / 周1 / 1」，节次支持「1-2 / 第1-2节 / 5」，
   周次支持「1-16 / 1-16周 / 1-16单」。先点「解析预览」确认无误再导入。
5. **待办**：标题、备注、时间，可选「每天」或「每周固定几天」重复。

## 提醒是怎么响的

三条路，安卓版优先用第一条：

**① 安卓系统本地通知（安卓版，推荐）**

装成 APK 后，应用会把**接下来两周**的课程和待办一次性排进系统（安卓 `AlarmManager`）。
排好之后**关掉应用、清掉后台、重启手机都会照常响**，精确到分钟。
每次打开应用会自动续排，回到前台时如果距上次排程超过 6 小时也会补一次。

- 权限：首次打开会申请通知权限；安卓 12+ 还要在设置 → 提醒里打开「精确闹钟」，
  否则系统会把它降级成粗略时间（可能晚几分钟）。
- 提示音：`android/app/src/main/res/raw/notify.wav` 是本项目自己合成的两声提示音，
  不配置的话安卓 8+ 的通知渠道默认是静音的。
- 省电策略激进的机型（小米 / 华为 / OPPO 等）建议把本应用加进后台白名单。

**② 导出到系统日历（通用，最稳）**

设置 → 导出 `.ics` → 安卓版会弹出系统分享面板，选「日历」导入；网页版直接下载文件后点开。
之后由系统日历负责准点提醒。
课表会按周次逐节展开成独立事件（1-16 周的课 = 16 个事件），所以单双周也能精确表达。

**③ 网页通知（只用于网页版，辅助）**

设置 → 开启通知。到点会弹通知，但**关掉浏览器就不会响**。
这是网页版的固有限制，没有服务器就做不到后台推送——所以推荐装安卓版。

提前量默认 10 分钟，可以在设置 → 提醒里改成任意值（填 0 就是准点提醒），课程和待办分别配置。

## 数据与备份

所有数据存在设备本地的 `localStorage` 里，**清除应用数据 / 浏览器数据就会丢失**。
设置 → 备份可以导出/导入 JSON，建议录完课表后导出一份存好。

## 已知限制

- **课表不能自动从教务系统抓取**。浏览器的同源策略（CORS）会阻止网页读取另一个网站，
  自动抓取只能在安卓 App 的 WebView 里做（下一阶段）。
- 网页版跑在局域网 `http://` 上，浏览器不把它当作安全上下文，所以装不成真正的 PWA
  （没有 Service Worker、没有桌面图标）。装安卓版就没有这个问题。
- 不做账号登录、云同步、多设备同步；换设备靠 JSON 备份搬。
- 单一时区（Asia/Shanghai）、单一学期；`.ics` 用浮动本地时间，不含 VTIMEZONE。

## 下一步

用 WebView 登录教务系统自动抓取课表：**需要先拿到课程表网址**，才能判断是正方 / 强智 / URP / 自建系统。
代码结构已经把它隔离好了——抓取只需产出 `CourseDraft[]` 交给 `addCourses()`，UI 和业务逻辑都不用动。

## 代码结构

```text
src/
  lib/               纯逻辑，基本都有单测
    ics.ts           .ics 生成（RFC 5545 折行、转义、周次展开）
    weeks.ts         周次 / 日期推算
    periods.ts       作息时间表
    parseCourses.ts  批量录入文本解析
    reminders.ts     提醒时刻推算（单日 + 多日展开）
    notifyPlan.ts    提醒 → 系统通知排程计划（纯函数，可测）
    tasks.ts         待办重复规则
    storage.ts       localStorage 读写、schema 版本、备份
    platform.ts      平台判断（网页 / 安卓 / iOS）
    notifications.ts 通知能力封装（系统本地通知 / 浏览器通知）
    reminderSync.ts  提醒排程入口
    saveFile.ts      导出文件（网页下载 / 安卓分享）
    download.ts      浏览器下载与文件选择
  components/         UI 基础组件
  pages/              今天 / 课表 / 待办 / 设置
  state/store.tsx     全局状态
android/              Capacitor 安卓工程
```