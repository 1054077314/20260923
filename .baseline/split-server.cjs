// 一次性手术脚本：把 server.ts 内已迁移的块替换为模块导入。跑完即删。
const fs = require('fs');
const p = 'server.ts';
let s = fs.readFileSync(p, 'utf8');
const cut = (startMarker, endMarker, { keepEnd = true } = {}) => {
  const i = s.indexOf(startMarker);
  if (i < 0) throw new Error('start not found: ' + startMarker.slice(0, 60));
  const j = s.indexOf(endMarker, i + startMarker.length);
  if (j < 0) throw new Error('end not found: ' + endMarker.slice(0, 60));
  const end = keepEnd ? j : j + endMarker.length;
  s = s.slice(0, i) + s.slice(end);
};

// A: 坐标字典 + CITY_TO_58_CODE + resolveListingCoordinates -> import
cut(
  '\n// Local coordinate mapping database for deterministic city and district fallback',
  '  return { lat: 30.2741, lng: 120.1551 };\n}\n',
  { keepEnd: false }
);
// B: parse58HtmlListings 整块（含 /** 头）
cut(
  '\n/**\n * Parse 58.com HTML listings page and extract structured rental data with coordinates',
  '\n/**\n * Geocode cache: community name'
);
// C+D: geocache 读写 + resolveDict + geocodeViaAmap + stripTags + parse58SnapshotHtml（含 /** 头）
cut(
  '\n/**\n * Geocode cache: community name',
  '\n/**\n * Snapshot import endpoint:'
);
// E: route cache + amap 解析（含 /** 头）
cut(
  '\n/**\n * Real route planning via AMap Web Service',
  "\napp.post('/api/route-time'"
);

const headerImports = `import { CITY_TO_58_CODE, resolveDictCoordinates } from './server/cityDict.js';
import { parse58HtmlListings, parse58SnapshotHtml } from './server/parse58.js';
import { geocodeViaAmap, readGeocache, writeGeocache } from './server/geocode.js';
import {
  AMAP_MODE_ENDPOINTS,
  amapFetchJson,
  parseAmapRoute,
  parseAmapTransitSegments,
  readRouteCache,
  writeRouteCache,
} from './server/route.js';
import type { RouteCacheEntry } from './server/route.js';
`;
const anchor = "import dotenv from 'dotenv';\n";
if (!s.includes(anchor)) throw new Error('header anchor missing');
s = s.replace(anchor, anchor + headerImports);

fs.writeFileSync(p, s, 'utf8');
console.log('done, server.ts bytes:', s.length);
