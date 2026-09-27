/**
 * 58 浏览器自动采集：真实 Edge 会话 → 列表页自动翻页 → 现有导入接口
 *
 * - 按城市子域 + 整租/合租频道采集，逐页解析"下一页"链接自动翻页
 * - 复用 /api/import-58-snapshot：解析、按 rentMode 分桶去重、坐标补齐全在服务端
 * - 验证码感知：无头被拦快速诚实失败；HEADFUL=1 弹出真窗口等人拖滑块（最长 3 分钟/页）
 * - 任一环节失败以非零码退出并说明原因，绝不返回模拟数据
 *
 * 用法：
 *   node scripts/collect-58.mjs --pages 3                    # 无头采集两频道各 3 页
 *   HEADFUL=1 node scripts/collect-58.mjs                    # 弹窗模式（可人工过验证码）
 *   node scripts/collect-58.mjs --city-sub xj --city-label 乌鲁木齐 --modes hezu,zhengzu
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const API = process.env.API_BASE || 'http://localhost:3000';
const CITY_SUB = argOf('city-sub', process.env.CITY_58_SUB || 'xj');
const CITY_LABEL = argOf('city-label', '乌鲁木齐');
const MAX_PAGES = Math.max(1, parseInt(argOf('pages', '3'), 10) || 3);
const MODES = (argOf('modes', 'hezu,zhengzu') || '').split(',').filter(Boolean);

const HEADFUL = process.env.HEADFUL === '1';

const TARGETS = {
  hezu: { label: '合租', urls: [`https://${CITY_SUB}.58.com/hezu/`] },
  zhengzu: { label: '整租', urls: [`https://${CITY_SUB}.58.com/zufang/`, `https://${CITY_SUB}.58.com/chuzu/`] },
};

function findBrowserExecutable() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  for (const p of candidates) {
    try {
      fs.accessSync(p);
      return p;
    } catch {}
  }
  return null;
}

async function fail(msg) {
  console.error('###RESULT### ' + JSON.stringify({ success: false, error: msg }));
  process.exit(1);
}

async function main() {
  const executablePath = findBrowserExecutable();
  if (!executablePath) return fail('未找到本机 Edge/Chrome，请安装其一后重试');

  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: !HEADFUL });
  } catch (e) {
    return fail(`浏览器启动失败: ${e.message}`);
  }

  const collected = []; // { name, html }
  const skipped = []; // { target, reason }
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    const gotoWithCaptcha = async (url) => {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const isCaptcha = await page
        .title()
        .then((t) => t.includes('验证码') || t.includes('访问过于频繁'))
        .catch(() => false);
      if (!isCaptcha) return resp;
      if (!HEADFUL) {
        throw new Error('无头模式被 58 反爬拦截（验证码），请用 HEADFUL=1 重跑并人工完成滑块');
      }
      console.log(`  ! ${url} 触发验证码，请在弹出的浏览器窗口拖动滑块完成验证（最长等待 3 分钟）…`);
      await page.waitForSelector('.house-cell', { timeout: 180000 });
      return resp;
    };

    for (const modeKey of MODES) {
      const target = TARGETS[modeKey];
      if (!target) continue;

      let done = false;
      for (const url of target.urls) {
        try {
          const pagesCollected = [];
          let nextUrl = url;
          const visited = new Set();

          while (nextUrl && pagesCollected.length < MAX_PAGES && !visited.has(nextUrl)) {
            visited.add(nextUrl);
            try {
              await gotoWithCaptcha(nextUrl);
              await page.waitForSelector('.house-cell', { timeout: 15000 });
            } catch (e) {
              // 翻页被拦：保留已采页，诚实记录后停止翻页（不丢弃部分成功）
              console.warn(`  ! ${nextUrl} ${(e.message || '').slice(0, 90)}`);
              if (pagesCollected.length > 0) {
                console.warn(`  ! 保留已采的 ${pagesCollected.length} 页，停止翻页`);
              }
              break;
            }
            const html = await page.content();
            const count = (html.match(/class="[^"]*house-cell/g) || []).length;
            if (count === 0) break;
            pagesCollected.push(html);
            console.log(`  ✓ [${target.label}] ${nextUrl} → ${count} 张卡片`);

            // 自动翻页：找"下一页"链接（类名含 next 或文本匹配）
            nextUrl = await page.evaluate(() => {
              const anchors = [...document.querySelectorAll('a')];
              const next =
                anchors.find((a) => (a.textContent || '').trim() === '下一页') ||
                anchors.find((a) => /(^|\s)next(\s|$)/.test(a.className || ''));
              if (!next || !next.getAttribute('href')) return null;
              const href = next.getAttribute('href');
              if (href.startsWith('http')) return href;
              if (href.startsWith('//')) return 'https:' + href;
              return new URL(href, location.origin).href;
            });
          }

          if (pagesCollected.length > 0) {
            const mergedName = `${CITY_LABEL}${target.label}房快照.html`;
            collected.push({
              name: pagesCollected.length > 1 ? `${CITY_LABEL}${target.label}房快照(${pagesCollected.length}页).html` : mergedName,
              html: pagesCollected.join('\n<!--PAGE-BREAK-->\n'),
            });
            done = true;
            break;
          }
        } catch (e) {
          console.warn(`  ! ${url} ${(e.message || '').slice(0, 90)}`);
        }
      }
      if (!done) skipped.push({ target: target.label, reason: '所有候选 URL 未采到真实房源卡片（反爬/网络）' });
    }
    await context.close();
  } finally {
    await browser.close();
  }

  if (collected.length === 0) {
    return fail(
      '未采集到任何真实页面' +
        (skipped.length ? `：${skipped.map((s) => `${s.target}(${s.reason})`).join('；')}` : '')
    );
  }

  try {
    const res = await fetch(`${API}/api/import-58-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: collected.map((c) => ({ name: c.name, content: Buffer.from(c.html, 'utf-8').toString('base64') })),
      }),
    });
    const data = await res.json();
    if (!data.success) return fail(`导入接口拒绝: ${data.error || 'HTTP ' + res.status}`);
    console.log(
      '###RESULT### ' +
        JSON.stringify({
          success: true,
          capturedAt: data.capturedAt,
          imported: data.imported,
          retainedFromPrevious: data.retainedFromPrevious,
          totalInSnapshot: data.totalInSnapshot,
          coordinatesResolved: data.coordinatesResolved,
          skipped,
          pages: collected.map((c) => c.name),
        })
    );
  } catch (e) {
    await fail(`导入失败（服务 ${API} 未启动或网络异常）: ${e.message}`);
  }
}

main();
