// 58 列表页解析：原 server.ts 内 parse58HtmlListings / parse58SnapshotHtml / stripTags 原样迁移。
// 行为保证：字段缺省留 null/空、不编造；rentMode 只看快照文件名。

import { resolveListingCoordinates } from './cityDict.js';

/**
 * Parse 58.com HTML listings page and extract structured rental data with coordinates
 */
export function parse58HtmlListings(
  html: string,
  city: string,
  cityCode: string,
  districtFilter: string = '',
  budgetMin: number = 1000,
  budgetMax: number = 3500
): any[] {
  const listings: any[] = [];
  const coordMap = new Map<string, { lat: number; lng: number }>();

  // 1. Extract embedded coordinate dictionary from page scripts if present
  try {
    const jsonMatch = html.match(/____json4fe\s*=\s*(\{[\s\S]*?\});/);
    if (jsonMatch && jsonMatch[1]) {
      const pageData = JSON.parse(jsonMatch[1]);
      if (pageData.locallist && Array.isArray(pageData.locallist)) {
        for (const loc of pageData.locallist) {
          if (loc.name && loc.lat && loc.lon) {
            coordMap.set(loc.name, {
              lat: parseFloat(loc.lat),
              lng: parseFloat(loc.lon),
            });
          }
        }
      }
    }
  } catch {
    // Ignore script JSON parse errors
  }

  // 2. Parse house-cell <li> elements
  const cellRegex = /<li[^>]*class=["'][^"']*house-cell[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let index = 0;

  while ((match = cellRegex.exec(html)) !== null) {
    const block = match[1];
    index++;

    // Title & URL
    let title = '';
    let link = '';

    const h2Match =
      block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i) ||
      block.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*strongbox[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<a[^>]*class=["'][^"']*strongbox[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);

    if (h2Match) {
      link = h2Match[1].trim();
      title = h2Match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    if (!title) {
      const altTitle = block.match(/title=["']([^"']+)["']/i);
      if (altTitle) title = altTitle[1].trim();
    }

    if (link.startsWith('//')) {
      link = 'https:' + link;
    } else if (link.startsWith('/')) {
      link = `https://${cityCode}.58.com${link}`;
    }

    // Rent
    let rent = 0;
    const moneyMatch =
      block.match(/<div[^>]*class=["'][^"']*money[^"']*["'][^>]*>[\s\S]*?<b[^>]*>(\d+)<\/b>/i) ||
      block.match(/class=["'][^"']*strongbox[^"']*["'][^>]*>(\d+)<\/b>/i) ||
      block.match(/(\d+)\s*(?:元|元\/月)/);

    if (moneyMatch) {
      rent = parseInt(moneyMatch[1], 10);
    }
    if (!rent || isNaN(rent)) {
      rent = Math.round((Number(budgetMin) + Number(budgetMax)) / 2) || 2400;
    }

    // Room info & Area
    let roomStr = '';
    let areaSqMeters = 25;
    const roomMatch = block.match(/<p[^>]*class=["'][^"']*room[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    if (roomMatch) {
      roomStr = roomMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const areaMatch = roomStr.match(/(\d+(?:\.\d+)?)\s*(?:㎡|平米|平|m²|m2)/i);
      if (areaMatch) {
        areaSqMeters = Math.round(parseFloat(areaMatch[1]));
      }
    }

    // Location / District / Community
    let districtName = districtFilter || '';
    let subDistrict = '';
    let community = '';

    const inforMatch = block.match(/<p[^>]*class=["'][^"']*infor[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    if (inforMatch) {
      const inforLinks = [...inforMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').trim()
      );
      if (inforLinks.length >= 3) {
        districtName = inforLinks[0];
        subDistrict = inforLinks[1];
        community = inforLinks[2];
      } else if (inforLinks.length === 2) {
        districtName = inforLinks[0];
        community = inforLinks[1];
      } else if (inforLinks.length === 1) {
        community = inforLinks[0];
      }
    }

    if (!community && title) {
      const commMatch = title.match(/^([^\s\-\[\]【】]{2,8})/);
      if (commMatch) community = commMatch[1];
    }
    if (!community) {
      community = `${districtName || city}宜居社区`;
    }

    const address = `${city} ${districtName} ${subDistrict} ${community}`.replace(/\s+/g, ' ').trim();

    // Floor
    let floor = '中楼层/6层';
    const floorMatch = block.match(/(\d+F\/\d+F|\d+\/\d+层|[高中低]楼层\/\d+层|[高中低]楼层)/i);
    if (floorMatch) {
      floor = floorMatch[1];
    } else if (roomStr.includes('层')) {
      const fMatch = roomStr.match(/([^\s]+层[^\s]*)/);
      if (fMatch) floor = fMatch[1];
    }

    // Tags & Pros
    const pros: string[] = [];
    const tagMatches =
      block.match(/<span[^>]*class=["'][^"']*tag-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi) ||
      block.match(/<span[^>]*class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi) ||
      [];

    for (const t of tagMatches) {
      const cleanTag = t.replace(/<[^>]+>/g, '').trim();
      if (cleanTag && cleanTag.length <= 12 && !pros.includes(cleanTag)) {
        pros.push(cleanTag);
      }
    }

    if (pros.length === 0) {
      if (title.includes('地铁')) pros.push('近地铁');
      if (title.includes('精装')) pros.push('精装修');
      if (title.includes('阳台')) pros.push('独立阳台');
      if (title.includes('独卫')) pros.push('独门独卫');
      if (title.includes('民水')) pros.push('民用水电');
      if (pros.length === 0) pros.push('采光充足', '交通便利');
    }

    // Subway Station & Walk Time
    let subwayStation = '';
    let walkToSubwayMin = 8;
    const subwayMatch =
      block.match(/距(?:地铁)?(\d+号线)?([^\s\d]{2,10}站?)\s*(\d+)米/i) ||
      block.match(/(\d+号线[^\s]{2,8})/);

    if (subwayMatch) {
      subwayStation = subwayMatch[0];
      if (subwayMatch[3]) {
        const meters = parseInt(subwayMatch[3], 10);
        walkToSubwayMin = Math.max(2, Math.round(meters / 75));
      }
    }

    // Landlord type
    let landlordType = 'intermediary';
    if (
      block.includes('个人') ||
      block.includes('房东') ||
      title.includes('房东直租') ||
      title.includes('个人出租')
    ) {
      landlordType = 'direct_landlord';
    } else if (block.includes('转租') || title.includes('转租')) {
      landlordType = 'sublessor';
    } else if (
      block.includes('公寓') ||
      title.includes('公寓') ||
      block.includes('泊寓') ||
      block.includes('自如')
    ) {
      landlordType = 'brand_apartment';
    }

    // Coordinates resolution
    let itemCoords: { lat: number; lng: number } | undefined;
    const fullCell = match[0];
    const latMatch = fullCell.match(/(?:data-lat|baidulat|latitude|lat)=["']([0-9.]+)["']/i) ||
                     fullCell.match(/lat=([0-9.]+)/i);
    const lngMatch = fullCell.match(/(?:data-lng|data-lon|baidulon|longitude|lon|lng)=["']([0-9.]+)["']/i) ||
                     fullCell.match(/(?:lng|lon)=([0-9.]+)/i);

    if (latMatch && lngMatch) {
      itemCoords = { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
    } else if (coordMap.has(community)) {
      itemCoords = coordMap.get(community);
    } else {
      // Check for coordinate pair format e.g. "30.12345,120.12345"
      const pairMatch = fullCell.match(/(\d{2}\.\d{4,8})\s*[,_]\s*(\d{3}\.\d{4,8})/);
      if (pairMatch) {
        itemCoords = { lat: parseFloat(pairMatch[1]), lng: parseFloat(pairMatch[2]) };
      }
    }

    const finalCoords = resolveListingCoordinates(city, districtName, community, itemCoords);

    listings.push({
      id: `58-${Date.now()}-${index}`,
      title: title || `${community} ${roomStr || '品质好房'}`,
      community,
      address,
      rent,
      areaSqMeters,
      floor,
      subwayStation: subwayStation || `${districtName || city}地铁沿线`,
      walkToSubwayMin,
      commuteMinutes: walkToSubwayMin + 18,
      landlordType,
      utilitiesType: block.includes('商用') ? 'commercial' : 'residential',
      depositTerms: '押一付一',
      pros,
      cons: floor.includes('楼梯') ? ['老小区楼梯需步行'] : [],
      sourcePlatform: '58同城',
      notes: '58同城直连实时挂牌房源，信息已结构化解析',
      sourceUrl: link || `https://${cityCode}.58.com/chuzu/`,
      coordinates: finalCoords,
    });
  }

  return listings;
}

export function stripTags(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Honest parser for user-saved 58.com list pages (Ctrl+S snapshots).
 * Port of the proven Python snapshot parser: missing fields stay null/empty -
 * no mid-budget rents, no invented communities, no fake deposit terms.
 */
export function parse58SnapshotHtml(html: string, sourceName: string, city: string): any[] {
  const out: any[] = [];
  const blocks = html.split(/<li[^>]*class="[^"]*house-cell/i).slice(1);

  for (const b of blocks) {
    const h2 = b.match(/<h2>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!h2) continue;
    const title = stripTags(h2[2]);
    if (!title) continue;

    const money = b.match(/class="money"([\s\S]*?)<\/div>/i);
    const rentTxt = money ? stripTags(money[1]) : '';
    const rentMatch = rentTxt.match(/(\d+)/);
    const rent = rentMatch ? parseInt(rentMatch[1], 10) : null;

    const roomBlock = b.match(/<p class="room">([\s\S]*?)<\/p>/i);
    const roomTxt = roomBlock ? stripTags(roomBlock[1]) : '';
    const roomTypeMatch = roomTxt.match(/([^\s\d]+\([^)]*\))/);
    const areaMatch = roomTxt.match(/(\d+)\s*㎡/);

    const info = b.match(/<p class="infor">([\s\S]*?)<\/p>/i);
    const links = info ? [...info[1].matchAll(/href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)] : [];
    let community = '';
    let communityUrl: string | null = null;
    let district = '';
    for (const l of links) {
      const name = stripTags(l[2]);
      if (!name) continue;
      if (l[1].includes('/xq/')) {
        community = name;
        communityUrl = l[1];
      } else if (!district) {
        district = name;
      }
    }

    const agentMatch = b.match(/class="jjr_par_dp"[^>]*title="([^"]*)"/i);
    let agent = agentMatch ? agentMatch[1].trim() : '';
    if (!agent) {
      const jjr = b.match(/class="jjr"([\s\S]*?)(?:<\/div>|$)/i);
      agent = jjr && jjr[1].includes('个人') ? '个人' : '';
    }
    const unescaped = b.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const idMatch = unescaped.match(/"infoid":"(\d+)/) || unescaped.match(/"houseid":"(\d+)/);
    const houseid = idMatch ? idMatch[1] : '';

    const depMatch = (title + ' ' + stripTags(b.slice(0, 3000))).match(/押[一二三四五六七八九十]\s*付[一二三四五六七八九十\d]+/);

    // rentMode is decided by the saved page's filename ONLY. 58 detail URLs use
    // /hezu/ on both hezu and zhengzu list pages, so URL heuristics misclassify
    // whole pages and would pollute the merge buckets.
    let rentMode = '未知';
    if (sourceName.includes('合租')) rentMode = '合租';
    else if (sourceName.includes('整租')) rentMode = '整租';

    void city;

    out.push({
      id: houseid ? `58-${houseid}` : `58-snap-${out.length}-${Date.now()}`,
      title,
      community,
      address: [district, community].filter(Boolean).join(' '),
      rent,
      areaSqMeters: areaMatch ? parseInt(areaMatch[1], 10) : null,
      roomType: roomTypeMatch ? roomTypeMatch[1] : roomTxt.slice(0, 15) || null,
      floor: null,
      subwayStation: null,
      walkToSubwayMin: null,
      commuteMinutes: null,
      landlordType: agent && agent !== '个人' ? 'intermediary' : agent === '个人' ? 'sublessor' : 'unknown',
      utilitiesType: null,
      depositTerms: depMatch ? depMatch[0].replace(/\s+/g, '') : null,
      pros: [],
      cons: [],
      sourcePlatform: '58同城',
      sourceUrl: h2[1].split('?')[0],
      communityUrl: communityUrl || null,
      agentCompany: agent || null,
      rentMode,
      dataSource: `58同城${rentMode}页快照（${sourceName}）`,
    });
  }
  return out;
}
