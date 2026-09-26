/**
 * 58 快照自动刷新：真实浏览器采集 → 现有导入接口
 *
 * 用本机 Edge/Chrome（真实浏览器网络栈，非 curl）打开 58 租房列表页，
 * 抓取渲染后的完整 HTML，POST /api/import-58-snapshot —— 解析、按 rentMode
 * 合并去重、坐标补齐全部复用服务端现有逻辑，本脚本不解析、不编造。
 *
 * 用法：npm run refresh-58   （可选 HEADFUL=1 显示浏览器窗口）
 * 任一环节失败都以非零码退出并说明原因，绝不返回模拟数据。
 */
import { chromium } from 'playwright-core';

const API = process.env.API_BASE || 'http://localhost:3001';
const CITY_SUB = process.env.CITY_58_SUB || 'xj'; // 乌鲁木齐 = xj

const TARGETS = [
  { name: '乌鲁木齐合租房快照.html', urls: [`https://${CITY_SUB}.58.com/hezu/`] },
  { name: '乌鲁木齐整租房快照.html', urls: [`https://${CITY_SUB}.58.com/chuzu/`, `https://${CITY_SUB}.58.com/zufang/`] },
];

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    try {
      if (fsExists(p)) return p;
    } catch {}
  }
  return null;
}

import fs from 'fs';
function fsExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

async function main() {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    await fail('未找到本机 Edge/Chrome，请安装其一后重试');
  }
  const headless = process.env.HEADFUL !== '1';

  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless });
  } catch (e) {
    await fail(`浏览器启动失败: ${e.message}`);
  }

  const collected = [];
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    for (const target of TARGETS) {
      let loaded = false;
      for (const url of target.urls) {
        try {
          const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
          if (!resp || !resp.ok()) {
            console.warn(`  ! ${url} HTTP ${resp ? resp.status() : '无响应'}`);
            continue;
          }
          // Captula-aware: headless fails fast & honestly; HEADFUL waits up to
          // 3 min for a human to solve the slider in the visible window
          const isCaptcha = await page
            .title()
            .then((t) => t.includes('验证码'))
            .catch(() => false);
          if (isCaptcha && !headless) {
            console.warn('  ! 触发 58 验证码，请在弹出的浏览器窗口拖动滑块完成验证（最长等待 3 分钟）…');
            try {
              await page.waitForSelector('.house-cell', { timeout: 180000 });
            } catch {
              console.warn(`  ! ${url} 验证码未在时限内完成，跳过该页`);
              continue;
            }
          } else if (isCaptcha && headless) {
            console.warn(`  ! ${url} 无头模式被 58 反爬拦截（验证码），请用 HEADFUL=1 重跑并人工完成滑块`);
            continue;
          } else {
            await page.waitForSelector('.house-cell', { timeout: 15000 });
          }
          const html = await page.content();
          const count = (html.match(/class="[^"]*house-cell/g) || []).length;
          if (count === 0) {
            console.warn(`  ! ${url} 加载成功但 0 张房源卡片（可能触发验证，可试 HEADFUL=1）`);
            continue;
          }
          collected.push({ name: target.name, html });
          console.log(`✓ ${url} → ${count} 张房源卡片`);
          loaded = true;
          break;
        } catch (e) {
          console.warn(`  ! ${url} 加载失败: ${(e.message || '').slice(0, 80)}`);
        }
      }
      if (!loaded) {
        console.error(`✗ 「${target.name}」所有候选 URL 均未采到真实房源卡片`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }

  if (collected.length === 0) {
    await fail('未采集到任何真实页面（网络/反爬），快照保持原样未动');
  }

  // POST to the existing import endpoint — parse/dedupe/coords all server-side
  try {
    const res = await fetch(`${API}/api/import-58-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: collected.map((c) => ({ name: c.name, content: Buffer.from(c.html, 'utf-8').toString('base64') })),
      }),
    });
    const data = await res.json();
    if (!data.success) {
      await fail(`导入接口拒绝: ${data.error || 'HTTP ' + res.status}`);
    }
    console.log('✓ 快照已更新:');
    console.log(`  采集日期: ${data.capturedAt}`);
    console.log(`  本次导入: ${data.imported} 条 (保留旧数据 ${data.retainedFromPrevious} 条, 共 ${data.totalInSnapshot} 条)`);
    console.log(`  坐标命中: ${JSON.stringify(data.coordinatesResolved)}`);
  } catch (e) {
    await fail(`导入失败（服务 ${API} 未启动或网络异常）: ${e.message}`);
  }
}

main();
