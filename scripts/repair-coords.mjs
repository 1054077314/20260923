/**
 * 坐标修复脚本（一次性维护用）：
 * 清理快照与地理编码缓存中被街道名污染的越界坐标（如「北京路」命中的北京市坐标），
 * 再按「geocache → 本地字典 → 高德」重新解析，解析结果必须通过城市范围校验。
 *
 * 用法：node scripts/repair-coords.mjs [--city 乌鲁木齐] [--dry]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.resolve(ROOT, 'data-58-snapshot.json');
const GEOCACHE = path.resolve(ROOT, 'data-58-geocache.json');
const MAX_KM = 80;

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.resolve(ROOT, '.env'), 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, '').trim();
      if (value) process.env[m[1]] = value;
    }
  } catch {}
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

const cityArgIdx = process.argv.indexOf('--city');
const CITY = cityArgIdx >= 0 ? process.argv[cityArgIdx + 1] : '乌鲁木齐';
const DRY = process.argv.includes('--dry');

loadEnv();
const KEY = process.env.AMAP_KEY || '';

const CITY_CENTERS = { 乌鲁木齐: { lat: 43.8256, lng: 87.6168 } };
const center = CITY_CENTERS[CITY] || null;

function distanceKm(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
}
const withinCity = (c) => !center || distanceKm(c, center) <= MAX_KM;

async function geocode(address) {
  if (!KEY) return null;
  const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(
    address
  )}&city=${encodeURIComponent(CITY)}&key=${KEY}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    const loc = data?.geocodes?.[0]?.location;
    if (typeof loc !== 'string' || !loc.includes(',')) return null;
    const [lng, lat] = loc.split(',').map(Number);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

const snapshot = readJson(SNAPSHOT, []);
const geocache = readJson(GEOCACHE, {});

// 1. 清掉缓存里越界的污染条目
let cachePurged = 0;
for (const [key, entry] of Object.entries(geocache)) {
  if (entry && typeof entry.lat === 'number' && !withinCity(entry)) {
    delete geocache[key];
    cachePurged++;
  }
}

// 2. 找出越界房源，清空坐标后重新解析
const broken = snapshot.filter(
  (l) => l.coordinates && typeof l.coordinates.lat === 'number' && !withinCity(l.coordinates)
);
for (const l of broken) {
  delete l.coordinates;
  delete l.coordinateSource;
}

const missing = snapshot.filter((l) => !l.coordinates);
console.log(
  `快照 ${snapshot.length} 条 | 越界清除 ${broken.length} 条 | 待解析 ${missing.length} 条 | 缓存剔除 ${cachePurged} 条 | key ${KEY ? '已配置' : '缺失'}`
);

let fromCache = 0;
let fromAmap = 0;
let unresolved = 0;

for (const l of missing) {
  const community = l.community || '';
  const district = (l.address || '').split(' ')[0] || '';
  const cached = geocache[community];
  if (cached && withinCity(cached)) {
    l.coordinates = { lat: cached.lat, lng: cached.lng };
    l.coordinateSource = cached.source || 'geocache';
    fromCache++;
    continue;
  }
  const query = [CITY, district, community].filter(Boolean).join(' ');
  const geo = await geocode(query);
  if (geo && withinCity(geo)) {
    l.coordinates = geo;
    l.coordinateSource = 'amap';
    geocache[community] = {
      lat: geo.lat,
      lng: geo.lng,
      source: 'amap',
      resolvedAt: new Date().toISOString().slice(0, 10),
    };
    fromAmap++;
  } else {
    unresolved++;
  }
  await new Promise((r) => setTimeout(r, 250)); // 高德 QPS 很紧，串行 + 间隔
}

console.log(`重解析结果：缓存命中 ${fromCache} | 高德 ${fromAmap} | 仍未解析 ${unresolved}`);

if (!DRY) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 1), 'utf-8');
  fs.writeFileSync(GEOCACHE, JSON.stringify(geocache, null, 1), 'utf-8');
  console.log('已写回 data-58-snapshot.json 与 data-58-geocache.json');
} else {
  console.log('--dry：未写回');
}
