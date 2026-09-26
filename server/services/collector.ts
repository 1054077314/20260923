// 浏览器采集：调起 scripts/collect-58.mjs（playwright-core + 真实 Edge 会话）。
// 非 0 退出也可能在 stdout 带诚实结果 JSON，这里统一解析。

import { execFile as execFileCb } from 'child_process';
import fs from 'fs';
import path from 'path';
import { SCRIPTS_DIR, DEFAULT_CITY } from '../config.js';
import { CITY_TO_58_CODE } from '../cityDict.js';

const RESULT_MARKER = '###RESULT### ';

const execFileAsync = (
  cmd: string,
  args: string[],
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFileCb(
      cmd,
      args,
      { maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs, windowsHide: false, env },
      (err, stdout, stderr) => {
        if (err && (err as any).killed) return reject(new Error(`采集超时（${timeoutMs}ms）`));
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      }
    );
  });

export type CollectOutcome =
  | { ok: true; result: any }
  | { ok: false; error: string; log?: string };

export async function collect58(params: {
  city: string;
  pages: number;
  headful: boolean;
  modes: string;
}): Promise<CollectOutcome> {
  const city = String(params.city || DEFAULT_CITY).trim();
  const citySub = CITY_TO_58_CODE[city] || 'xj';

  const scriptPath = path.resolve(SCRIPTS_DIR, 'collect-58.mjs');
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, error: '采集脚本不存在: ' + scriptPath };
  }

  const args = [
    scriptPath,
    '--city-sub',
    citySub,
    '--city-label',
    city || DEFAULT_CITY,
    '--pages',
    String(Math.max(1, Math.min(10, Number(params.pages) || 3))),
    '--modes',
    String(params.modes || 'hezu,zhengzu'),
  ];
  const env = { ...process.env };
  if (params.headful) env.HEADFUL = '1';

  try {
    const { stdout } = await execFileAsync(process.execPath, args, 300000, env);
    const marker = stdout.lastIndexOf(RESULT_MARKER);
    if (marker < 0) {
      return { ok: false, error: '采集脚本未返回结果', log: stdout.slice(-500) };
    }
    const result = JSON.parse(stdout.slice(marker + RESULT_MARKER.length).trim());
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: '采集失败：' + (err?.message || '未知错误') };
  }
}
