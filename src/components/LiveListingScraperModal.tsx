import React, { useState } from 'react';
import {
  X,
  Globe,
  Search,
  Sparkles,
  Building2,
  CheckCircle2,
  CheckSquare,
  Square,
  ArrowRight,
  ExternalLink,
  MapPin,
  Clock,
  Home,
  Tag,
  Loader2,
  AlertCircle,
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import { CandidateProperty, LandlordType, UtilitiesType } from '../types/rental';

interface LiveListingScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity?: string;
  defaultBudgetMax?: number;
  onBatchImport: (candidates: CandidateProperty[]) => void;
}

interface FetchedListing {
  id: string;
  title: string;
  community: string;
  address: string;
  rent: number;
  areaSqMeters: number;
  floor: string;
  subwayStation: string;
  walkToSubwayMin: number;
  commuteMinutes: number;
  landlordType: LandlordType;
  utilitiesType: UtilitiesType;
  depositTerms: string;
  pros: string[];
  cons: string[];
  sourcePlatform: string;
  notes: string;
  sourceUrl?: string;
}

export const LiveListingScraperModal: React.FC<LiveListingScraperModalProps> = ({
  isOpen,
  onClose,
  defaultCity = '杭州',
  defaultBudgetMax = 2800,
  onBatchImport,
}) => {
  const [city, setCity] = useState(defaultCity);
  const [district, setDistrict] = useState('西湖区');
  const [subwayStation, setSubwayStation] = useState('2号线 古翠路');
  const [budgetMin, setBudgetMin] = useState(Math.max(1000, defaultBudgetMax - 1000));
  const [budgetMax, setBudgetMax] = useState(defaultBudgetMax);
  const [roomType, setRoomType] = useState('主卧独卫/一室一厅');
  const [keywords, setKeywords] = useState('民用水电 近地铁 独立阳台');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [listings, setListings] = useState<FetchedListing[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchSources, setSearchSources] = useState<{ title: string; url: string }[]>([]);

  if (!isOpen) return null;

  const handleFetchListings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fetch-live-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          district,
          subwayStation,
          budgetMin,
          budgetMax,
          roomType,
          keywords,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '获取全网实时房源数据失败');
      }

      setListings(data.listings || []);
      setSearchSources(data.sources || []);
      // Default select all fetched listings
      setSelectedIds(new Set((data.listings || []).map((l: FetchedListing) => l.id)));
    } catch (err: any) {
      console.error('Scrape listings error:', err);
      setErrorMsg(err.message || '网络请求超时，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === listings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listings.map((l) => l.id)));
    }
  };

  const handleConfirmImport = () => {
    const toImport = listings.filter((l) => selectedIds.has(l.id));
    if (toImport.length === 0) {
      alert('请至少勾选一套房源以导入对比清单');
      return;
    }

    const converted: CandidateProperty[] = toImport.map((item) => ({
      id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      community: item.community || item.title,
      address: item.address || `${city} ${item.community}`,
      subwayStation: item.subwayStation || '',
      walkToSubwayMin: item.walkToSubwayMin || 8,
      commuteMinutes: item.commuteMinutes || 25,
      areaSqMeters: item.areaSqMeters || 25,
      floor: item.floor || '6F/18F 电梯',
      rent: item.rent,
      utilitiesType: item.utilitiesType || 'residential',
      extraMonthlyFees: {
        propertyFee: 0,
        internetFee: 0,
        waterElectricityEst: item.utilitiesType === 'commercial' ? 180 : 80,
        cleaningFee: 0,
        other: 0,
      },
      depositTerms: item.depositTerms || '押一付一',
      landlordType: item.landlordType || 'direct_landlord',
      agencyFeeAmount: item.landlordType === 'intermediary' ? Math.round(item.rent * 0.35) : 0,
      amenities: ['民用水电', '独立卫浴', '阳台晾晒', '带电梯', '空调'],
      pros: item.pros || [],
      cons: item.cons || [],
      contactName: item.sourcePlatform || '平台挂牌房源',
      contactPhone: '',
      inspectionStatus: 'pending',
      checklistResults: {},
      ratings: {
        priceValue: 8,
        commute: item.walkToSubwayMin <= 6 ? 9 : 7,
        lightingVentilation: 8,
        soundproof: 7,
        spaceLayout: 8,
        surroundings: 8,
        hygieneSafety: 8,
      },
      weightedScore: 78,
      notes: `【${item.sourcePlatform || '全网抓取'}】${item.notes || ''}`,
    }));

    onBatchImport(converted);
    onClose();
  };

  const getPlatformBadge = (platform: string) => {
    if (platform?.includes('58')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (platform?.includes('贝壳') || platform?.includes('链家')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (platform?.includes('豆瓣')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (platform?.includes('闲鱼')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-neutral-100 text-neutral-800 border-neutral-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">
                  全网实时房源抓取与检索引擎
                </h2>
                <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold">
                  Google Search Grounding
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                调用搜索引擎实时检索 58同城、安居客、贝壳、豆瓣租房、闲鱼等各大平台的最新在租房源与真实挂牌价。
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Parameter Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 bg-white space-y-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
            <div>
              <label className="block text-neutral-600 mb-1 font-medium text-[11px]">目标城市</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="如：杭州"
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1 font-medium text-[11px]">目标区域/板块</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="如：西湖区/古翠路"
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1 font-medium text-[11px]">地铁线/站点</label>
              <input
                type="text"
                value={subwayStation}
                onChange={(e) => setSubwayStation(e.target.value)}
                placeholder="如：2号线 古翠路"
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1 font-medium text-[11px]">月租预算区间 (元)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(Number(e.target.value))}
                  className="w-1/2 px-1.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code text-center text-xs outline-none"
                />
                <span className="text-neutral-400">-</span>
                <input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className="w-1/2 px-1.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code text-center text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-600 mb-1 font-medium text-[11px]">期望户型</label>
              <input
                type="text"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="主卧独卫/一室一厅"
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 text-neutral-900 font-mono-code focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFetchListings}
                disabled={loading}
                className="w-full py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>全网抓取中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>立即抓取房源</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="shrink-0 font-medium">附加偏好词：</span>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="如：民用水电 近地铁 独立阳台 房东直租"
              className="flex-1 px-2 py-1 rounded border border-neutral-200 text-neutral-800 text-[11px] outline-none"
            />
            <span className="text-neutral-400 hidden sm:inline">
              *将自动检索 58同城/安居客/贝壳/豆瓣租房近期匹配房源
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Initial Blank State */}
          {!loading && listings.length === 0 && !errorMsg && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-800">
                  点击上方「立即抓取房源」开始全网检索
                </h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  系统将利用搜索引擎实时爬取 58同城、安居客、贝壳找房、豆瓣等各大平台在 {city} {district} 符合预算的最新挂牌房源并完成规格结构化。
                </p>
              </div>
              <button
                type="button"
                onClick={handleFetchListings}
                className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs"
              >
                开始全网实时抓取
              </button>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-neutral-800">
                  正在实时抓取 58同城、安居客、贝壳找房等平台挂牌信息...
                </div>
                <div className="text-xs text-neutral-500 font-mono-code">
                  [Google Search Grounding] 检索区域：{city} {district} {subwayStation} · 预算：{budgetMin}~{budgetMax}元
                </div>
              </div>
            </div>
          )}

          {/* Fetched Listings List */}
          {!loading && listings.length > 0 && (
            <div className="space-y-3">
              {/* Batch Action Bar */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-100">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-neutral-700 hover:text-neutral-900 font-medium"
                >
                  {selectedIds.size === listings.length ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400" />
                  )}
                  <span>
                    全选全部 {listings.length} 套房源 (已选 {selectedIds.size} 套)
                  </span>
                </button>

                <div className="text-[11px] text-neutral-400 font-mono-code">
                  检索匹配成功 · 点击卡片勾选或取消
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {listings.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer select-none space-y-3 relative ${
                        isChecked
                          ? 'border-indigo-500/80 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-500/30'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      {/* Top Row: Title + Platform Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <button
                            type="button"
                            className="mt-0.5 text-indigo-600 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(item.id);
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-400" />
                            )}
                          </button>
                          <div>
                            <h4 className="font-bold text-xs text-neutral-900 line-clamp-1">
                              {item.title}
                            </h4>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{item.community} · {item.address}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded border shrink-0 ${getPlatformBadge(
                            item.sourcePlatform
                          )}`}
                        >
                          {item.sourcePlatform || '58同城/全网'}
                        </span>
                      </div>

                      {/* Specs Row */}
                      <div className="grid grid-cols-4 gap-2 py-2 px-2.5 rounded-lg bg-neutral-50/80 border border-neutral-100 text-center font-mono-code text-xs">
                        <div>
                          <div className="text-[10px] text-neutral-400">月租金</div>
                          <div className="font-bold text-rose-600 text-sm">¥{item.rent}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400">面积</div>
                          <div className="font-semibold text-neutral-800">{item.areaSqMeters}㎡</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400">楼层</div>
                          <div className="font-medium text-neutral-700 truncate">{item.floor}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400">步行地铁</div>
                          <div className="font-medium text-neutral-700">{item.walkToSubwayMin}分钟</div>
                        </div>
                      </div>

                      {/* Pros tags & Landlord Type */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono-code">
                          {item.landlordType === 'direct_landlord'
                            ? '房东直租'
                            : item.landlordType === 'sublessor'
                            ? '原租客转租'
                            : item.landlordType === 'brand_apartment'
                            ? '品牌公寓'
                            : '正规中介'}
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono-code">
                          {item.utilitiesType === 'residential' ? '民水民电' : '商用水电'}
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono-code">
                          {item.depositTerms}
                        </span>

                        {(item.pros || []).slice(0, 3).map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100"
                          >
                            ✓ {p}
                          </span>
                        ))}
                      </div>

                      {/* Source Link & Notes */}
                      {item.notes && (
                        <div className="text-[11px] text-neutral-500 line-clamp-1 italic border-t border-neutral-100 pt-1.5">
                          备注：{item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reference Citations from Google Search */}
              {searchSources.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 space-y-1">
                  <div className="font-semibold text-neutral-700">实时检索引用来源：</div>
                  <div className="flex flex-wrap gap-2">
                    {searchSources.slice(0, 4).map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline max-w-xs truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-neutral-500">
            已勾选 <strong className="text-indigo-600 font-bold">{selectedIds.size}</strong> 套房源
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-medium transition-colors"
            >
              关闭
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedIds.size === 0}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white font-semibold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>一键批量导入对比清单 ({selectedIds.size})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
