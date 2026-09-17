import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { downloadText } from "./download";
import { isNativeApp } from "./platform";

export type SaveMethod = "download" | "share" | "cancelled" | "failed";

export interface SaveOutcome {
  ok: boolean;
  method: SaveMethod;
  message: string;
}

export interface SaveTextFileOptions {
  /** 真正写进磁盘的文件名，原生平台上必须是纯 ASCII（系统按扩展名判断类型） */
  filename: string;
  /** 网页下载时用的文件名，可以用中文 */
  downloadName?: string;
  content: string;
  mime: string;
  /** 系统分享面板的标题 */
  title?: string;
}

/**
 * 把一份文本交给用户。
 * - 网页：走浏览器下载。
 * - 安卓：先写进应用缓存目录，再交给系统分享面板（可选日历、文件管理、聊天软件）。
 */
export async function saveTextFile(options: SaveTextFileOptions): Promise<SaveOutcome> {
  const { filename, downloadName, content, mime, title } = options;

  if (!isNativeApp()) {
    downloadText(downloadName ?? filename, content, mime);
    return { ok: true, method: "download", message: `已开始下载 ${downloadName ?? filename}` };
  }

  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: title ?? filename,
      files: [written.uri],
      dialogTitle: title ?? filename,
    });
    return { ok: true, method: "share", message: `已生成 ${filename}，请在分享面板里选择应用` };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(text)) {
      return { ok: false, method: "cancelled", message: "已取消分享" };
    }
    return { ok: false, method: "failed", message: `导出失败：${text}` };
  }
}