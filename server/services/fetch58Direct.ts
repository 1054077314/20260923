// 58 直连抓取：快照为空时的兜底通路（真实 HTTP 请求 + 真实解析，抓不到就是 0 条）。

import { exec } from 'child_process';
import { promisify } from 'util';
import { parse58HtmlListings } from '../parse58.js';

const execAsync = promisify(exec);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0';
const GIT_CURL_PATH = 'C:\\Program Files\\Git\\mingw64\\bin\\curl.exe';

async function curlHtml(url: string): Promise<string> {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const cmd = `"${curlBin}" -sL -k -A "${UA}" "${url}"`;
  try {
    const res = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 12000 });
    return res.stdout || '';
  } catch (execErr: any) {
    // Windows 上系统 curl 可能不存在，退到 Git 自带 curl
    if (process.platform !== 'win32') return '';
    try {
      const res = await execAsync(`"${GIT_CURL_PATH}" -sL -k -A "${UA}" "${url}"`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 12000,
      });
      return res.stdout || '';
    } catch {
      console.warn('Direct curl execution error:', execErr?.message || execErr);
      return '';
    }
  }
}

export interface DirectFetchParams {
  city: string;
  cityCode: string;
  district: string;
  budgetMin: number;
  budgetMax: number;
}

export interface DirectFetchResult {
  listings: Record<string, any>[];
  message?: string;
}

export async function fetch58Direct(params: DirectFetchParams): Promise<DirectFetchResult> {
  const { city, cityCode, district, budgetMin, budgetMax } = params;
  const url = `https://${cityCode}.58.com/chuzu/`;

  let stdout = '';
  try {
    stdout = await curlHtml(url);
  } catch (err: any) {
    console.error('58 direct fetch error:', err);
    return { listings: [], message: '抓取失败，未解析到房源数据 (0 条)' };
  }

  let listings = parse58HtmlListings(stdout || '', city, cityCode, district, budgetMin, budgetMax);

  const dClean = district.trim();
  if (listings.length > 0 && dClean) {
    const districtListings = listings.filter(
      (l) => l.address.includes(dClean) || l.title.includes(dClean) || l.community.includes(dClean)
    );
    if (districtListings.length > 0) listings = districtListings;
  }

  return {
    listings,
    message:
      listings.length === 0 ? '抓取到 0 条房源（58 反爬拦截或当前筛选条件下无挂牌）' : undefined,
  };
}
