/**
 * 房源数据唯一链路：58 原始条目 → CandidateProperty，以及候选池的去重 / 预算筛选。
 *
 * 全前端只有这里做「原始房源数据 → 候选房源对象」的转换与合并：
 *  - 快照房源（/api/58-snapshot）与抓取结果（/api/fetch-58-listings、/api/fetch-live-listings）
 *    走同一个转换函数，字段缺省一律留空，绝不编造默认值。
 *  - 合并候选池时只有一套去重键与一套预算规则。
 */

import {
  CandidateProperty,
  CoordinateSource,
  LandlordType,
  ListingSource,
  UtilitiesType,
} from '../types/rental';

/** 后端返回的原始房源条目（字段可能缺省，禁止在转换时臆造取值） */
export interface Raw58Listing {
  id?: string;
  title?: string;
  community?: string;
  address?: string;
  rent?: number | null;
  areaSqMeters?: number | null;
  roomType?: string | null;
  floor?: string | null;
  subwayStation?: string | null;
  walkToSubwayMin?: number | null;
  commuteMinutes?: number | null;
  landlordType?: string | null;
  utilitiesType?: string | null;
  depositTerms?: string | null;
  pros?: string[];
  cons?: string[];
  notes?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  coordinates?: { lat: number; lng: number } | null;
  coordinateSource?: CoordinateSource | null;
  capturedAt?: string | null;
}

const LANDLORD_TYPES: LandlordType[] = [
  'direct_landlord',
  'intermediary',
  'brand_apartment',
  'sublessor',
  'unknown',
];

const UTILITIES_TYPES: UtilitiesType[] = ['residential', 'commercial', 'unknown'];

/** 房源身份去重键：标题 + 小区 + 租金 */
export function candidateDedupeKey(item: {
  title?: string | null;
  community?: string | null;
  rent?: number | null;
}): string {
  const rent = typeof item.rent === 'number' ? String(item.rent) : '';
  return `${item.title || ''}|${item.community || ''}|${rent}`;
}

/** 原始条目在前端列表中的稳定标识（用于列表选中态，不参与展示） */
export function rawListingKey(raw: Raw58Listing): string {
  return raw.id ? String(raw.id) : candidateDedupeKey(raw);
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

let fallbackIdSeq = 0;

/**
 * 58 原始条目 → 候选房源对象。
 * 缺失字段留空（''/undefined/0）并保持「未评分」状态，不填充任何推测值。
 */
export function raw58ToCandidate(
  raw: Raw58Listing,
  options: { idPrefix?: string; source?: ListingSource } = {}
): CandidateProperty {
  const prefix = options.idPrefix ?? 'raw-';
  const id = raw.id
    ? `${prefix}${raw.id}`
    : `${prefix}raw-${stableHash(candidateDedupeKey(raw))}-${++fallbackIdSeq}`;

  // 来源未标明即为 'unknown'：不猜测也不留 undefined，界面据此显示「待核实」
  const landlordType: LandlordType = LANDLORD_TYPES.includes(raw.landlordType as LandlordType)
    ? (raw.landlordType as LandlordType)
    : 'unknown';
  const utilitiesType: UtilitiesType = UTILITIES_TYPES.includes(raw.utilitiesType as UtilitiesType)
    ? (raw.utilitiesType as UtilitiesType)
    : 'unknown';

  // 坐标与来源一起收口：无合法坐标时来源强制 unknown，绝不保留来历不明的坐标
  const coordinates =
    raw.coordinates &&
    typeof raw.coordinates.lat === 'number' &&
    typeof raw.coordinates.lng === 'number'
      ? { lat: raw.coordinates.lat, lng: raw.coordinates.lng }
      : undefined;
  const coordinateSource: CoordinateSource = coordinates
    ? raw.coordinateSource || 'explicit'
    : 'unknown';

  const notes = [
    raw.notes,
    raw.sourcePlatform ? `平台: ${raw.sourcePlatform}` : '',
    raw.sourceUrl ? `来源: ${raw.sourceUrl}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id,
    title: raw.title || raw.community || '（无标题房源）',
    community: raw.community || '',
    address: raw.address || '',
    subwayStation: raw.subwayStation || '',
    walkToSubwayMin: raw.walkToSubwayMin ?? undefined,
    commuteMinutes: raw.commuteMinutes ?? undefined,
    areaSqMeters: typeof raw.areaSqMeters === 'number' ? raw.areaSqMeters : 0,
    floor: raw.floor || '',
    rent: typeof raw.rent === 'number' ? raw.rent : 0,
    utilitiesType,
    extraMonthlyFees: {
      propertyFee: 0,
      internetFee: 0,
      waterElectricityEst: 0,
      cleaningFee: 0,
      other: 0,
    },
    landlordType,
    depositTerms: raw.depositTerms || '',
    ratings: {
      priceValue: 0,
      commute: 0,
      lightingVentilation: 0,
      soundproof: 0,
      spaceLayout: 0,
      surroundings: 0,
      hygieneSafety: 0,
    },
    pros: raw.pros || [],
    cons: raw.cons || [],
    notes,
    contactName: '',
    contactPhone: '',
    inspectionStatus: 'pending',
    checklistResults: {},
    coordinates,
    coordinateSource,
    source: options.source ?? 'snapshot58',
    sourceUrl: raw.sourceUrl || '',
    sourcePlatform: raw.sourcePlatform || '',
  };
}

const CN_ROOM_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 从 roomType（如「主卧(5室)」）或标题（如「3室1厅」）解析室数；解析不出返回 null */
export function parseRoomCount(item: { roomType?: string | null; title?: string | null }): number | null {
  const sources = [item.roomType || '', item.title || ''];
  for (const text of sources) {
    const m = text.match(/([1-9一二两三四五六七八九])\s*室/);
    if (m) return CN_ROOM_NUM[m[1]] ?? Number(m[1]);
  }
  return null;
}

/** 用户硬性约束：超过 3 室的房源一律不进候选池（4室及以上整租/合租都超需求） */
export const MAX_ROOM_COUNT = 3;

export function isWithinRoomLimit(roomType: string | null | undefined, title: string | null | undefined): boolean {
  const n = parseRoomCount({ roomType, title });
  return n == null || n <= MAX_ROOM_COUNT;
}

/** 预算筛选：无上限时全部通过 */
export function isWithinBudget(rent: number, maxMonthlyRent: number): boolean {
  return !maxMonthlyRent || rent <= maxMonthlyRent;
}

export interface CandidatePool {
  /** 已选候选在前，快照房源在后；已按去重键与预算上限处理 */
  pool: CandidateProperty[];
  shortlistCount: number;
  snapshotKeptCount: number;
}

/**
 * 合并候选池：已选候选全量保留（不受预算上限裁掉），
 * 快照房源按去重键排除与已选候选重复的条目，并按预算上限过滤。
 */
export function buildCandidatePool(params: {
  shortlist: CandidateProperty[];
  snapshot: CandidateProperty[];
  maxMonthlyRent: number;
}): CandidatePool {
  const { shortlist, snapshot, maxMonthlyRent } = params;
  const seen = new Set(shortlist.map((c) => candidateDedupeKey(c)));
  const fromSnapshot = snapshot.filter(
    (l) => !seen.has(candidateDedupeKey(l)) && isWithinBudget(l.rent, maxMonthlyRent)
  );

  return {
    pool: [...shortlist, ...fromSnapshot],
    shortlistCount: shortlist.length,
    snapshotKeptCount: fromSnapshot.length,
  };
}

/**
 * 批量导入已选候选前的去重：与既有候选重复的条目跳过，返回实际新增项与跳过数。
 */
export function mergeImportedCandidates(
  existing: CandidateProperty[],
  incoming: CandidateProperty[]
): { merged: CandidateProperty[]; added: number; skipped: number } {
  const seen = new Set(existing.map((c) => candidateDedupeKey(c)));
  const fresh: CandidateProperty[] = [];

  for (const item of incoming) {
    const key = candidateDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(item);
  }

  return {
    merged: [...existing, ...fresh],
    added: fresh.length,
    skipped: incoming.length - fresh.length,
  };
}
