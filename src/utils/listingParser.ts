/**
 * Smart natural language listing text extractor
 * Parses pasted text from Beike, Xianyu, Xiaohongshu, Douban, or WeChat messages.
 */

export interface ParsedListing {
  title?: string;
  community?: string;
  rent?: number;
  areaSqMeters?: number;
  walkToSubwayMin?: number;
  commuteMinutes?: number;
  floor?: string;
  depositTerms?: string;
  landlordType?: 'landlord' | 'sublessor' | 'agency' | 'apartment';
  utilitiesType?: 'residential' | 'commercial' | 'included';
  pros?: string[];
  contactPhone?: string;
  amenities?: string[];
}

export function parseListingText(raw: string): ParsedListing {
  if (!raw || !raw.trim()) return {};

  const text = raw.trim();
  const result: ParsedListing = {};

  // 1. Extract Rent (e.g., 2600元/月, 2500/月, 月租2300, 租金 2800)
  const rentMatch =
    text.match(/(?:租金|月租|房租|每月|price)[:：\s]*([1-9]\d{2,4})\s*(?:元|\/月|块)?/i) ||
    text.match(/([1-9]\d{2,4})\s*(?:元\/月|元每月|\/月|块\/月|元)/) ||
    text.match(/\b([1-9]\d{2,4})\b/);
  if (rentMatch && rentMatch[1]) {
    const rentNum = parseInt(rentMatch[1], 10);
    if (rentNum >= 300 && rentNum <= 50000) {
      result.rent = rentNum;
    }
  }

  // 2. Extract Area (e.g., 25平米, 30㎡, 35平, 40平方米)
  const areaMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:平米|平方米|平|㎡)/i) ||
    text.match(/(?:面积)[:：\s]*(\d+(?:\.\d+)?)/i);
  if (areaMatch && areaMatch[1]) {
    result.areaSqMeters = parseFloat(areaMatch[1]);
  }

  // 3. Extract Subway / Walk minutes
  const walkMatch =
    text.match(/(?:步行|走路|走)\s*(\d+)\s*(?:分钟|min)/i) ||
    text.match(/(?:距|距离)[^，,\n]{1,20}(?:地铁|站)\s*(\d+)\s*(?:分钟|米)/);
  if (walkMatch && walkMatch[1]) {
    result.walkToSubwayMin = parseInt(walkMatch[1], 10);
  }

  // 4. Extract Floor (e.g., 6F/18F, 6楼/18层, 电梯5楼)
  const floorMatch =
    text.match(/(?:(\d+)\s*(?:F|层|楼)\s*\/\s*(\d+)\s*(?:F|层|楼))/) ||
    text.match(/((?:电梯|楼梯)?\s*\d+\s*(?:F|层|楼))/);
  if (floorMatch) {
    result.floor = floorMatch[0].trim();
  }

  // 5. Extract Community name (look for quotes, brackets, or after 小区/位于)
  // Clean out common prefixes like "【58同城】" or "【安居客】"
  let cleanTextForCommunity = text
    .replace(/【(?:58同城|安居客|贝壳|自如|链家|闲鱼)】/g, '')
    .replace(/我在(?:58同城|安居客|贝壳|闲鱼)发现了一套好房[:：]?/g, '');

  const communityMatch =
    cleanTextForCommunity.match(/【([^】]+)】/) ||
    cleanTextForCommunity.match(/\[([^\]]+)\]/) ||
    cleanTextForCommunity.match(/(?:小区|坐标|位于|地址)[:：\s]*([^\s，,。；;]+)/) ||
    cleanTextForCommunity.match(/([^\s，,。；;]{2,10}(?:苑|家园|公寓|花园|大厦|新村|一区|二区|三区|四区|社区|华府|名苑|里|坊|庄|村))/);
  if (communityMatch && communityMatch[1]) {
    result.community = communityMatch[1].trim();
  }

  // 6. Landlord type
  if (text.includes('58同城') || text.includes('安居客')) {
    // Usually individual or agent on 58
    if (text.includes('个人') || text.includes('房东直租')) {
      result.landlordType = 'landlord';
    } else {
      result.landlordType = 'agency';
    }
  } else if (text.includes('自如') || text.includes('泊寓') || text.includes('冠寓') || text.includes('公寓')) {
    result.landlordType = 'apartment';
  } else if (text.includes('房东直租') || text.includes('房东本人') || text.includes('一手房东') || text.includes('个人房源') || text.includes('无中介费')) {
    result.landlordType = 'landlord';
  } else if (text.includes('转租') || text.includes('原租客')) {
    result.landlordType = 'sublessor';
  } else if (text.includes('中介') || text.includes('佣金') || text.includes('经纪人') || text.includes('服务费')) {
    result.landlordType = 'agency';
  }

  // 7. Deposit Terms
  const depositMatch = text.match(/(押[一二三]付[一二三六])/);
  if (depositMatch) {
    result.depositTerms = depositMatch[1];
  } else if (text.includes('押一付一')) {
    result.depositTerms = '押一付一';
  }

  // 8. Utilities
  if (text.includes('民用水电') || text.includes('民用')) {
    result.utilitiesType = 'residential';
  } else if (text.includes('商用') || text.includes('1.5元/度') || text.includes('商业水电')) {
    result.utilitiesType = 'commercial';
  } else if (text.includes('包水电') || text.includes('包含水电')) {
    result.utilitiesType = 'included';
  }

  // 9. Phone Number
  const phoneMatch = text.match(/(?:电话|联系方式|手机|微信|V|vx)[:：\s]*(1[3-9]\d{9})/i) || text.match(/\b(1[3-9]\d{9})\b/);
  if (phoneMatch && phoneMatch[1]) {
    result.contactPhone = phoneMatch[1];
  }

  // 10. Pros & Amenities
  const pros: string[] = [];
  const amenities: string[] = [];

  const checkMap: Record<string, string> = {
    '朝南': '采光优良南向',
    '独卫': '独立卫生间',
    '阳台': '独立晾晒阳台',
    '民用水电': '市政民用水电',
    '电梯': '带电梯',
    '无中介费': '免中介服务费',
    '近地铁': '紧邻地铁站',
    '精装修': '精装拎包入住',
    '燃气': '可通燃气做饭',
  };

  for (const [key, label] of Object.entries(checkMap)) {
    if (text.includes(key)) {
      pros.push(label);
      if (['独卫', '阳台', '电梯', '燃气'].includes(key)) {
        amenities.push(key);
      }
    }
  }

  if (pros.length > 0) result.pros = pros;
  if (amenities.length > 0) result.amenities = amenities;

  // Title fallback
  if (!result.title) {
    const com = result.community || '房源';
    const rentStr = result.rent ? `${result.rent}元/月` : '';
    const proStr = pros.slice(0, 2).join(' · ');
    result.title = `${com} ${proStr || rentStr}`.trim();
  }

  return result;
}
