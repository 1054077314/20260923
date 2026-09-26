// 服务端全局配置：路径、端口、外部服务 key、默认城市常量。
// 所有散落的硬编码（尤其是默认城市）一律收到这里，业务模块不再自己写字面量。

import path from 'path';
import { fileURLToPath } from 'url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 项目根目录（server.ts 所在目录，data-*.json 都在这里） */
export const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');

export const SNAPSHOT_PATH = path.resolve(PROJECT_ROOT, 'data-58-snapshot.json');

export const PORT = Number(process.env.PORT) || 3000;

/** 采集脚本目录 */
export const SCRIPTS_DIR = path.resolve(PROJECT_ROOT, 'scripts');

/** 默认城市：58 快照目前只覆盖乌鲁木齐，其他城市诚实返回空 */
export const DEFAULT_CITY = '乌鲁木齐';

export const GEMINI_MODEL = 'gemini-3.8-flash';

export function amapKey(): string {
  return process.env.AMAP_KEY || '';
}

export function geminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

/** 前端 Google Maps 用 key：多环境变量兜底，全无则回落到内置公共 key */
export function browserMapsKey(): string {
  return (
    process.env.VITE_GEMINI_PUBLIC_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    'AIzaSyBIoomGq3PNyW2WrvhwyKagxUkU-NxuTRE'
  );
}

/** 缺失 AMAP_KEY 时的统一提示后半段，各接口自己补前半句 */
export const AMAP_KEY_MISSING_HINT =
  '请在 .env 中添加 AMAP_KEY=你的key（高德 Web 服务 Key）并重启服务';
