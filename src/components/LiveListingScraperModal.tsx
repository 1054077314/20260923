import React, { useState } from 'react';
import {
  X,
  Globe,
  Building2,
  CheckSquare,
  Square,
  ArrowRight,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  Database,
  Layers,
  Upload
} from 'lucide-react';
import { CandidateProperty } from '../types/rental';
import {
  Raw58Listing,
  rawListingKey,
  raw58ToCandidate,
} from '../utils/listingPipeline';
import {
  collect58Snapshot,
  fetchScrapedListings,
  import58SnapshotFiles,
} from '../utils/listingSources';

interface LiveListingScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity?: string;
  defaultBudgetMax?: number;
  onBatchImport: (candidates: CandidateProperty[]) => void;
}

export type ScraperDataSource = '58_direct' | 'google_grounding';

export const LiveListingScraperModal: React.FC<LiveListingScraperModalProps> = ({
  isOpen,
  onClose,
  defaultCity = '乌鲁木齐',
  defaultBudgetMax = 2500,
  onBatchImport,
}) => {
  const isUrumqi = defaultCity.includes('乌') || defaultCity.includes('新疆');
  const [dataSource, setDataSource] = useState<ScraperDataSource>('58_direct');
  const [city, setCity] = useState(defaultCity);
  const [district, setDistrict] = useState(isUrumqi ? '新市区' : '西湖区');
  const [subwayStation, setSubwayStation] = useState(isUrumqi ? '1号线 铁路局' : '2号线 古翠路');
  const [budgetMin, setBudgetMin] = useState(Math.max(800, defaultBudgetMax - 1000));
  const [budgetMax, setBudgetMax] = useState(defaultBudgetMax);
  const [roomType, setRoomType] = useState('主卧独卫/一室一厅');
  const [keywords, setKeywords] = useState(
    isUrumqi ? '市政集中供暖 民水电 近1号线地铁/BRT' : '民用水电 近地铁 独立阳台'
  );

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [listings, setListings] = useState<Raw58Listing[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchSources, setSearchSources] = useState<{ title: string; url: string }[]>([]);
  const [freshness, setFreshness] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchListings = async () => {
    setLoading(true);
    setHasFetched(true);
    setErrorMsg(null);
    try {
      const endpoint =
        dataSource === '58_direct' ? '/api/fetch-58-listings' : '/api/fetch-live-listings';

      const payload =
        dataSource === '58_direct'
          ? {
              city,
              district,
              budgetMin,
              budgetMax,
              roomType,
              subwayStation,
            }
          : {
              city,
              district,
              subwayStation,
              budgetMin,
              budgetMax,
              roomType,
              keywords,
            };

      const result = await fetchScrapedListings({ endpoint, payload });
      if (!result.success) {
        throw new Error(result.error || '获取房源数据失败');
      }

      setListings(result.listings);
      setSearchSources(result.sources);
      setSelectedIds(new Set(result.listings.map((l) => rawListingKey(l))));
      setFreshness(result.dataSource);
    } catch (err: any) {
      console.error('Fetch listings error:', err);
      setErrorMsg(err.message || '网络请求超时，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  };

  // One-click browser collection: server spawns a real Edge session that opens
  // 58 list pages, auto-paginates, and feeds the existing import pipeline.
  // A visible browser window may pop up to let you solve an anti-bot slider.
  const [collectBusy, setCollectBusy] = useState(false);
  const handleBrowserCollect = async () => {
    setCollectBusy(true);
    setSnapshotMsg('正在启动真实浏览器自动采集（可能弹出 Edge 窗口，若遇验证码请拖动滑块）…');
    try {
      const data = await collect58Snapshot({ city, pages: 3, headful: true });
      if (!data.success) throw new Error(data.error || '自动采集失败');
      const coordInfo = data.coordinatesResolved || {};
      setSnapshotMsg(
        `✓ 采集完成：导入 ${data.imported} 条（保留 ${data.retainedFromPrevious} 条，共 ${data.totalInSnapshot} 条，${data.capturedAt} 采集）· 坐标命中 ${coordInfo.geocacheOrDict || 0}`
      );
      await handleFetchListings();
    } catch (err: any) {
      console.error('Browser collect error:', err);
      setSnapshotMsg(err.message || '自动采集失败');
    } finally {
      setCollectBusy(false);
    }
  };

  // Snapshot refresh: upload user-saved 58 list pages (Ctrl+S), server parses
  // honestly and rewrites data-58-snapshot.json, then auto re-fetches listings.
  const handleImportSnapshot = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setSnapshotBusy(true);
    setSnapshotMsg(null);
    try {
      const files = await Promise.all(
        Array.from(fileList).map(
          (f) =>
            new Promise<{ name: string; content: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve({ name: f.name, content: base64 });
              };
              reader.onerror = () => reject(new Error(`读取文件失败：${f.name}`));
              reader.readAsDataURL(f);
            })
        )
      );

      const data = await import58SnapshotFiles(files);
      if (!data.success) throw new Error(data.error || '快照导入失败');

      const coordInfo = data.coordinatesResolved || {};
      setSnapshotMsg(
        `已导入 ${data.imported} 条真实房源（${data.capturedAt} 采集）· 坐标命中 ${coordInfo.geocacheOrDict || 0} 条`
      );
      await handleFetchListings();
    } catch (err: any) {
      console.error('Import snapshot error:', err);
      setSnapshotMsg(err.message || '快照导入失败');
    } finally {
      setSnapshotBusy(false);
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
      setSelectedIds(new Set(listings.map((l) => rawListingKey(l))));
    }
  };

  const handleConfirmImport = () => {
    const toImport = listings.filter((l) => selectedIds.has(rawListingKey(l)));
    if (toImport.length === 0) {
      alert('请至少勾选一套房源以导入对比清单');
      return;
    }

    // 统一走 Raw58Listing → CandidateProperty 转换：抓取结果里没有的字段一律留空，
    // 打分保持未评（0 分）、配套与杂费不臆造，由用户在房源对比中自行录入
    const converted: CandidateProperty[] = toImport.map((item) =>
      raw58ToCandidate(item, { idPrefix: 'cand-' })
    );

    onBatchImport(converted);
    onClose();
  };

  const getPlatformBadge = (platform?: string) => {
    if (platform?.includes('58')) {
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
    if (platform?.includes('贝壳') || platform?.includes('链家')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
    if (platform?.includes('豆瓣')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (platform?.includes('闲鱼')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#0f0f11] text-neutral-200 rounded-2xl shadow-2xl border border-neutral-800/80 w-full max-w-4xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-[#141417] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700/60 flex items-center justify-center text-neutral-200 shadow-inner">
              {dataSource === '58_direct' ? (
                <Building2 className="w-5 h-5 text-orange-400" />
              ) : (
                <Globe className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-neutral-100 tracking-tight">
                  实时房源抓取与检索引擎
                </h2>
                <span
                  className={`text-[10px] font-mono-code px-2 py-0.5 rounded border font-semibold ${
                    dataSource === '58_direct'
                      ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {dataSource === '58_direct' ? '58同城直连' : 'Google Grounding'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {dataSource === '58_direct'
                  ? '直接对接 58 同城租赁列表页，毫秒级提取最新真实房源并结构化解析坐标与规格。'
                  : '调用 Google Search 搜索引擎全网实时检索 58同城、安居客、贝壳、豆瓣等平台最新房源。'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Source Switcher Segment */}
        <div className="px-6 py-2.5 bg-[#18181c] border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium shrink-0">数据源选择:</span>
            <div className="flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setDataSource('58_direct')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  dataSource === '58_direct'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>58直连数据源</span>
              </button>

              <button
                type="button"
                onClick={() => setDataSource('google_grounding')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  dataSource === 'google_grounding'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>全网智能检索</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500 font-mono-code hidden sm:block">
            {dataSource === '58_direct' ? '直连城市频道 · 精准小区经纬度' : '全网聚合 · 多渠道挂牌分析'}
          </div>
        </div>

        {/* Search Parameter Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-[#121215] space-y-3 shrink-0">
          {dataSource === '58_direct' && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                disabled={collectBusy}
                onClick={handleBrowserCollect}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-colors ${
                  collectBusy
                    ? 'border-neutral-700 text-neutral-500 cursor-wait'
                    : 'border-orange-500/60 text-orange-400 hover:bg-orange-500/10 font-semibold'
                }`}
              >
                {collectBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                <span>{collectBusy ? '浏览器采集中…' : '浏览器自动采集（自动翻页·3页·可能弹窗）'}</span>
              </button>
              <label
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-colors ${
                  snapshotBusy
                    ? 'border-neutral-700 text-neutral-500 cursor-wait'
                    : 'border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10'
                }`}
              >
                <Upload className="w-3 h-3" />
                <span>{snapshotBusy ? '正在导入快照…' : '导入快照更新（选已保存的 58 页面 .html）'}</span>
                <input
                  type="file"
                  multiple
                  accept=".html,.htm"
                  disabled={snapshotBusy}
                  onChange={(e) => {
                    handleImportSnapshot(e.target.files);
                    e.currentTarget.value = '';
                  }}
                  className="hidden"
                />
              </label>
              {snapshotMsg && (
                <span className={snapshotMsg.includes('失败') || snapshotMsg.includes('为 0') ? 'text-rose-400' : 'text-emerald-400'}>
                  {snapshotMsg}
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
            <div>
              <label className="block text-neutral-400 mb-1 font-medium text-[11px]">目标城市</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="如：杭州"
                className="w-full px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-medium text-[11px]">目标区域/板块</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="如：西湖区/古翠路"
                className="w-full px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-medium text-[11px]">地铁线/站点</label>
              <input
                type="text"
                value={subwayStation}
                onChange={(e) => setSubwayStation(e.target.value)}
                placeholder="如：2号线 古翠路"
                className="w-full px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-medium text-[11px]">月租预算区间 (元)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(Number(e.target.value))}
                  className="w-1/2 px-1.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code text-center text-xs outline-none focus:border-orange-500/60"
                />
                <span className="text-neutral-600">-</span>
                <input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className="w-1/2 px-1.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code text-center text-xs outline-none focus:border-orange-500/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-medium text-[11px]">期望户型</label>
              <input
                type="text"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="主卧独卫/一室一厅"
                className="w-full px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono-code focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFetchListings}
                disabled={loading}
                className={`w-full py-1.5 px-3 rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                  dataSource === '58_direct'
                    ? 'bg-orange-600 hover:bg-orange-500 text-white disabled:bg-orange-950 disabled:text-neutral-500'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-950 disabled:text-neutral-500'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>抓取中...</span>
                  </>
                ) : (
                  <>
                    {dataSource === '58_direct' ? (
                      <Building2 className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{dataSource === '58_direct' ? '抓取 58 房源' : '全网检索房源'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {dataSource === 'google_grounding' && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span className="shrink-0 font-medium">附加偏好词：</span>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="如：民用水电 近地铁 独立阳台 房东直租"
                className="flex-1 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 text-[11px] outline-none focus:border-indigo-500/60"
              />
              <span className="text-neutral-500 hidden sm:inline">
                *将通过智能检索多渠道近期匹配房源
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0a0a0c]">
          {freshness && !errorMsg && (
            <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[11px] font-mono-code flex items-center gap-2">
              <Database className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span>数据来源：{freshness}{listings.length > 0 ? ` · 本次加载 ${listings.length} 条` : ''}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Initial Blank State before search */}
          {!loading && !hasFetched && listings.length === 0 && !errorMsg && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
                {dataSource === '58_direct' ? (
                  <Building2 className="w-6 h-6 text-orange-400" />
                ) : (
                  <Globe className="w-6 h-6 text-indigo-400" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-200">
                  点击上方「{dataSource === '58_direct' ? '抓取 58 房源' : '全网检索房源'}」开始获取
                </h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  {dataSource === '58_direct'
                    ? `系统将直接读取 58 同城 ${city} 频道列表页，提取在租房源规格与坐标。`
                    : `系统将检索 58同城、安居客、贝壳找房、豆瓣等平台在 ${city} ${district} 符合预算的最新挂牌房源。`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFetchListings}
                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                  dataSource === '58_direct'
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                开始立即抓取
              </button>
            </div>
          )}

          {/* Explicit 0 results state after search */}
          {!loading && hasFetched && listings.length === 0 && !errorMsg && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-200">
                  未抓取到房源数据 (共 0 套)
                </h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  本次未从 58 列表页解析到有效房源卡片（系统严格遵循真实抓取原则，绝不提供伪造模拟数据）。
                  可能原因：58 平台反爬拦截、当前网络限制或该筛选条件下暂无挂牌。
                </p>
              </div>
              <button
                type="button"
                onClick={handleFetchListings}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-all border border-neutral-700"
              >
                重新尝试抓取
              </button>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="py-16 text-center space-y-4">
              <Loader2
                className={`w-8 h-8 animate-spin mx-auto ${
                  dataSource === '58_direct' ? 'text-orange-400' : 'text-indigo-400'
                }`}
              />
              <div className="space-y-1">
                <div className="font-bold text-sm text-neutral-200">
                  {dataSource === '58_direct'
                    ? '正在直连 58 同城列表页并解析房源卡片...'
                    : '正在全网检索 58同城、安居客、贝壳找房挂牌信息...'}
                </div>
                <div className="text-xs text-neutral-500 font-mono-code">
                  检索区域：{city} {district} {subwayStation} · 预算：{budgetMin}~{budgetMax}元
                </div>
              </div>
            </div>
          )}

          {/* Fetched Listings List */}
          {!loading && listings.length > 0 && (
            <div className="space-y-3">
              {/* Batch Action Bar */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 font-medium"
                >
                  {selectedIds.size === listings.length ? (
                    <CheckSquare className="w-4 h-4 text-orange-400" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-600" />
                  )}
                  <span>
                    全选全部 {listings.length} 套房源 (已选 {selectedIds.size} 套)
                  </span>
                </button>

                <div className="text-[11px] text-neutral-500 font-mono-code">
                  房源数据已结构化 · 支持一键导入对比清单
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {listings.map((item) => {
                  const listingKey = rawListingKey(item);
                  const isChecked = selectedIds.has(listingKey);
                  return (
                    <div
                      key={listingKey}
                      onClick={() => toggleSelect(listingKey)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer select-none space-y-3 relative ${
                        isChecked
                          ? 'border-orange-500/60 bg-orange-950/20 shadow-xs ring-1 ring-orange-500/30'
                          : 'border-neutral-800 bg-[#121216] hover:border-neutral-700'
                      }`}
                    >
                      {/* Top Row: Title + Platform Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <button
                            type="button"
                            className="mt-0.5 text-orange-400 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(listingKey);
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-orange-400" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-600" />
                            )}
                          </button>
                          <div>
                            <h4 className="font-bold text-xs text-neutral-100 line-clamp-1">
                              {item.title}
                            </h4>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5 font-mono-code">
                              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                              <span className="truncate">
                                {[item.community, item.address].filter(Boolean).join(' · ') || '地址待补充'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded border shrink-0 ${getPlatformBadge(
                            item.sourcePlatform
                          )}`}
                        >
                          {item.sourcePlatform || '58同城'}
                        </span>
                      </div>

                      {/* Specs Row */}
                      <div className="grid grid-cols-4 gap-2 py-2 px-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800/80 text-center font-mono-code text-xs">
                        <div>
                          <div className="text-[10px] text-neutral-500">月租金</div>
                          <div className="font-bold text-rose-400 text-sm">
                            {item.rent != null ? `¥${item.rent}` : '未标注'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-500">面积</div>
                          <div className="font-semibold text-neutral-200">
                            {item.areaSqMeters != null ? `${item.areaSqMeters}㎡` : '未标注'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-500">楼层</div>
                          <div className="font-medium text-neutral-300 truncate">
                            {item.floor || '未标注'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-500">步行地铁</div>
                          <div className="font-medium text-neutral-300">
                            {item.walkToSubwayMin != null ? `${item.walkToSubwayMin}分钟` : '未测'}
                          </div>
                        </div>
                      </div>

                      {/* Pros tags & Landlord Type */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {item.landlordType && (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono-code border border-neutral-700/50">
                            {item.landlordType === 'direct_landlord'
                              ? '房东直租'
                              : item.landlordType === 'sublessor'
                              ? '原租客转租'
                              : item.landlordType === 'brand_apartment'
                              ? '品牌公寓'
                              : '正规中介'}
                          </span>
                        )}

                        {item.utilitiesType && (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono-code border border-neutral-700/50">
                            {item.utilitiesType === 'residential' ? '民水民电' : '商用水电'}
                          </span>
                        )}

                        {item.depositTerms && (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono-code border border-neutral-700/50">
                            {item.depositTerms}
                          </span>
                        )}

                        {(item.pros || []).slice(0, 3).map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-mono-code"
                          >
                            [+] {p}
                          </span>
                        ))}
                      </div>

                      {/* Source Link & Notes */}
                      {item.notes && (
                        <div className="text-[11px] text-neutral-400 line-clamp-1 italic border-t border-neutral-800/80 pt-1.5 flex items-center justify-between">
                          <span className="truncate">备注：{item.notes}</span>
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-neutral-500 hover:text-neutral-300 shrink-0 ml-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reference Citations */}
              {searchSources.length > 0 && (
                <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                  <div className="font-semibold text-neutral-300">检索引用来源：</div>
                  <div className="flex flex-wrap gap-2">
                    {searchSources.slice(0, 4).map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline max-w-xs truncate"
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
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-[#141417] flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-neutral-400 font-mono-code">
            已勾选 <strong className="text-orange-400 font-bold">{selectedIds.size}</strong> 套房源
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-medium transition-colors"
            >
              关闭
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedIds.size === 0}
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>一键批量导入候选清单 ({selectedIds.size})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
