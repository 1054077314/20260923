import React, { useState } from 'react';
import {
  RentalPlan,
  CandidateProperty,
} from '../types/rental';
import {
  calculateCandidateMonthlyTotal,
} from '../utils/calculations';
import {
  CandidateFilterState,
  RentRange,
  filterCandidates,
  isCandidateFilterActive,
  sortCandidates,
} from '../utils/candidateFilter';
import { mergeImportedCandidates } from '../utils/listingPipeline';
import { useCommuteRoutes } from '../utils/useCommuteRoutes';
import { getWalkToStation } from '../utils/commuteStats';
import { NeighborhoodSearchModal } from './NeighborhoodSearchModal';
import { LiveListingScraperModal } from './LiveListingScraperModal';
import { CandidatePropertiesMap } from './CandidatePropertiesMap';
import {
  Building2,
  Globe,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Layers,
  X,
  Search,
  Filter,
  RotateCcw,
  Check,
  Tag,
  Compass,
  Star,
} from 'lucide-react';

interface ComparisonMatrixProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  onSelectCandidateForInspection?: (candidateId: string) => void;
  focusMode?: boolean;
  theme?: 'light' | 'dark';
}

const PRESET_AMENITIES = [
  '独立卫浴',
  '燃气厨房',
  '阳台晾晒',
  '智能门锁',
  '洗衣机',
  '冰箱',
  '空调',
  '带电梯',
  '停车位',
  '集中供暖',
  '朝南采光',
  '宽带入户',
];

const PRESET_TAG_FILTERS = [
  { id: 'near_subway', label: '近地铁 (≤10min)' },
  { id: 'residential_utilities', label: '民用水电' },
  { id: 'direct_landlord', label: '房东直租' },
  { id: 'elevator', label: '带电梯' },
  { id: 'south_facing', label: '朝南向' },
];

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  plan,
  onUpdatePlan,
  onSelectCandidateForInspection,
  focusMode,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  // Sorting
  const [sortBy, setSortBy] = useState<'score' | 'rent' | 'commute'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [rentFilter, setRentFilter] = useState<RentRange>('all');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [selectedAmenityFilters, setSelectedAmenityFilters] = useState<string[]>([]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Grounding modal state
  const [groundingModalOpen, setGroundingModalOpen] = useState(false);
  const [selectedGroundingCandidate, setSelectedGroundingCandidate] = useState<CandidateProperty | null>(null);

  const [scraperModalOpen, setScraperModalOpen] = useState(false);
  const [showMapView, setShowMapView] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleBatchImportScrapedListings = (newCandidates: CandidateProperty[]) => {
    // 已选候选与抓取结果共用一套去重键：重复导入同一房源不再产生重复条目
    const { merged, added, skipped } = mergeImportedCandidates(plan.candidates, newCandidates);
    if (added === 0) {
      alert(`本次勾选的 ${skipped} 套房源都已存在于候选清单中，无需重复导入。`);
      return;
    }
    if (skipped > 0) {
      console.info(`批量导入：新增 ${added} 套，跳过重复 ${skipped} 套`);
    }
    onUpdatePlan({
      ...plan,
      candidates: merged,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTogglePin = (candidateId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = plan.candidates.map((c) =>
      c.id === candidateId ? { ...c, isPinned: !c.isPinned } : c
    );
    onUpdatePlan({
      ...plan,
      candidates: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteCandidate = (id: string) => {
    if (confirm('确定删除该房源吗？')) {
      onUpdatePlan({
        ...plan,
        candidates: plan.candidates.filter((c) => c.id !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  };


  const handleStatusChange = (
    candidateId: string,
    status: CandidateProperty['inspectionStatus']
  ) => {
    onUpdatePlan({
      ...plan,
      candidates: plan.candidates.map((c) =>
        c.id === candidateId ? { ...c, inspectionStatus: status } : c
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  // Save neighborhood grounding search to a candidate
  const handleSaveNeighborhoodToCandidate = (
    candidateId: string,
    summary: string,
    sources: { title: string; url: string }[]
  ) => {
    const updated = plan.candidates.map((c) =>
      c.id === candidateId
        ? {
            ...c,
            neighborhoodInfo: {
              lastQueried: new Date().toISOString(),
              summary,
              sources,
            },
          }
        : c
    );
    onUpdatePlan({ ...plan, candidates: updated, updatedAt: new Date().toISOString() });
  };

  // 真实通勤耗时：与通勤页共用同一 hook（高德真实路线），用于展示与排序
  const { routeInfo } = useCommuteRoutes({
    candidates: plan.candidates,
    city: plan.city || '乌鲁木齐',
    workplace: plan.budget.workplace || '',
    transitMode: 'subway',
  });
  const routeMinutes: Record<string, number | null | undefined> = Object.fromEntries(
    plan.candidates.map((c) => {
      const r = routeInfo[c.id];
      return [c.id, r?.state === 'ok' && typeof r.minutes === 'number' ? r.minutes : null];
    })
  );

  // 筛选与排序统一走 candidateFilter（唯一口径），组件只保留 UI 状态
  const filterState: CandidateFilterState = {
    searchQuery,
    rentFilter,
    onlyPinned,
    selectedTagFilters,
    selectedAmenityFilters,
  };
  const filteredCandidates = filterCandidates(plan.candidates, filterState);
  const sortedCandidates = sortCandidates(filteredCandidates, sortBy, sortOrder, routeMinutes);

  const pinnedCount = plan.candidates.filter((c) => c.isPinned).length;

  const hasActiveFilters = isCandidateFilterActive(filterState);

  const handleResetFilters = () => {
    setSearchQuery('');
    setRentFilter('all');
    setOnlyPinned(false);
    setSelectedTagFilters([]);
    setSelectedAmenityFilters([]);
  };

  const handleToggleTagFilter = (tagId: string) => {
    if (selectedTagFilters.includes(tagId)) {
      setSelectedTagFilters(selectedTagFilters.filter((t) => t !== tagId));
    } else {
      setSelectedTagFilters([...selectedTagFilters, tagId]);
    }
  };

  const handleToggleAmenityFilter = (amenity: string) => {
    if (selectedAmenityFilters.includes(amenity)) {
      setSelectedAmenityFilters(selectedAmenityFilters.filter((a) => a !== amenity));
    } else {
      setSelectedAmenityFilters([...selectedAmenityFilters, amenity]);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Title Section */}
      <div className="pt-2 pb-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className={`font-editorial italic text-3xl sm:text-4xl tracking-tight font-normal ${
                isDark ? 'text-neutral-100' : 'text-neutral-950'
              }`}
            >
              房源对比
            </h1>
            <p
              className={`font-mono-code text-[11px] sm:text-xs tracking-[0.22em] uppercase mt-1.5 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              PROPERTY MATRIX & MULTI-CANDIDATE SHORTLIST
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!focusMode && (
              <button
                onClick={() => {
                  setSelectedGroundingCandidate(plan.candidates[0] || null);
                  setGroundingModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code rounded transition-colors border ${
                  isDark
                    ? 'text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
                    : 'text-neutral-700 bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>周边配套检索 (AI Grounding)</span>
              </button>
            )}



            <button
              onClick={() => setScraperModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code font-semibold rounded transition-colors shadow-2xs border ${
                isDark
                  ? 'text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900 border-indigo-700/60'
                  : 'text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border-indigo-200'
              }`}
              title="利用 Google 实时搜索全网抓取 58同城/安居客/贝壳/豆瓣等平台最新房源"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>全网实时抓取房源</span>
            </button>

            <button
              onClick={() => setShowMapView(!showMapView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code font-semibold rounded transition-colors shadow-2xs border ${
                showMapView
                  ? isDark
                    ? 'text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border-emerald-600/70'
                    : 'text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300'
                  : isDark
                  ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                  : 'text-neutral-600 bg-neutral-50 hover:bg-neutral-100 border-neutral-200'
              }`}
              title="切换城市房源地理坐标雷达视图"
            >
              <MapPin className={`w-3.5 h-3.5 ${showMapView ? 'text-emerald-500 fill-emerald-500/20' : 'text-neutral-400'}`} />
              <span>{showMapView ? '地图联动已开启' : '开启地图联动'}</span>
            </button>

          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className={`rounded-lg border p-3.5 space-y-3 ${
          isDark
            ? 'bg-neutral-900/40 border-neutral-800/90'
            : 'bg-white border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        {/* Main Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Keyword Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索小区、路名、地铁站或特征标签..."
              className={`w-full pl-9 pr-8 py-2 rounded border text-xs font-mono-code outline-none ${
                isDark
                  ? 'border-neutral-800 text-neutral-200 bg-neutral-900 focus:border-neutral-500'
                  : 'border-neutral-200 text-neutral-900 bg-white focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Controls & Filter Drawer Toggle */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400 text-[11px]">排序:</span>
            <div
              className={`flex items-center rounded p-0.5 border font-mono-code ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'
              }`}
            >
              <button
                onClick={() => {
                  setSortBy('score');
                  setSortOrder('desc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'score'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                加权评分
              </button>
              <button
                onClick={() => {
                  setSortBy('rent');
                  setSortOrder('asc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'rent'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                租金由低到高
              </button>
              <button
                onClick={() => {
                  setSortBy('commute');
                  setSortOrder('asc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'commute'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                通勤耗时
              </button>
            </div>

            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-mono-code transition-colors ${
                showFilterDrawer || selectedTagFilters.length > 0 || selectedAmenityFilters.length > 0
                  ? isDark
                    ? 'bg-neutral-800 border-neutral-700 text-neutral-200 font-medium'
                    : 'bg-neutral-900 border-neutral-900 text-white font-medium shadow-2xs'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300 shadow-2xs'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>筛选过滤</span>
              {(selectedTagFilters.length > 0 || selectedAmenityFilters.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {selectedTagFilters.length + selectedAmenityFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Rent Range Buttons */}
        <div
          className={`flex flex-wrap items-center gap-1.5 pt-1 text-xs border-t ${
            isDark ? 'border-neutral-800/80' : 'border-neutral-100'
          }`}
        >
          <span className="text-neutral-400 text-[11px] mr-1">租金范围:</span>
          {[
            { id: 'all', label: '不限' },
            { id: 'under1k', label: '≤ 1000' },
            { id: '1k-2k', label: '1000 - 2000' },
            { id: '2k-3.5k', label: '2000 - 3500' },
            { id: 'over3.5k', label: '> 3500' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRentFilter(item.id as RentRange)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono-code transition-colors ${
                rentFilter === item.id
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                    : 'bg-neutral-900 text-white font-semibold shadow-2xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Quick Pinned / Starred Filter */}
          {pinnedCount > 0 && (
            <button
              onClick={() => setOnlyPinned(!onlyPinned)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-colors ml-1 ${
                onlyPinned
                  ? 'bg-amber-500 text-white font-semibold shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/90 hover:bg-amber-100 font-medium'
              }`}
              title="仅显示高亮优选置顶的房源"
            >
              <Star
                className={`w-3 h-3 ${
                  onlyPinned ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'
                }`}
              />
              <span>高亮优选 ({pinnedCount})</span>
            </button>
          )}

          {/* Quick Location Tags */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {PRESET_TAG_FILTERS.slice(0, 3).map((tag) => {
              const active = selectedTagFilters.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTagFilter(tag.id)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extended Filter Drawer (Location Tags & Amenities) */}
        {showFilterDrawer && (
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            {/* Location & Lease Attributes */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>位置与租约属性：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAG_FILTERS.map((tag) => {
                  const active = selectedTagFilters.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTagFilter(tag.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amenities Facilities */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Compass className="w-3 h-3 text-slate-400" />
                <span>配套设施与家电：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_AMENITIES.map((amenity) => {
                  const active = selectedAmenityFilters.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => handleToggleAmenityFilter(amenity)}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filter Stats & Reset */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <div>
            筛选结果：匹配 <strong>{sortedCandidates.length}</strong> 套 / 共 {plan.candidates.length} 套候选房源
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>清空全部筛选</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {sortedCandidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              {hasActiveFilters ? '没有找到符合筛选条件的房源' : '暂未录入任何候选房源'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? '可以尝试放宽租金区间、取消部分配套过滤项或清空搜索关键词。'
                : '点「全网实时抓取房源」导入 58 真实在售房源，即可多维度比选；勾选后加入候选清单。'}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              清空筛选条件
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setScraperModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>全网实时抓取房源</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={showMapView ? 'flex flex-col xl:flex-row gap-4 items-start' : ''}>
          <div className={showMapView ? 'w-full xl:w-[58%] shrink-0' : 'w-full'}>
            <div
              className={
                showMapView
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              }
            >
              {sortedCandidates.map((candidate, index) => {
                const monthlyTotal = calculateCandidateMonthlyTotal(candidate);
                const isTopRank = index === 0 && sortBy === 'score';
                const hasGrounding = !!candidate.neighborhoodInfo?.summary;
                const isSelected = selectedCandidateId === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    id={`candidate-card-${candidate.id}`}
                    onMouseEnter={() => setSelectedCandidateId(candidate.id)}
                    className={`rounded-lg border transition-all flex flex-col justify-between ${
                      isSelected
                        ? isDark
                          ? 'ring-2 ring-indigo-500 shadow-md border-indigo-500/80'
                          : 'ring-2 ring-indigo-500 shadow-md border-indigo-400'
                        : ''
                    } ${
                      candidate.isPinned
                        ? isDark
                          ? 'border-amber-500/50 bg-neutral-900/80 ring-1 ring-amber-500/20'
                          : 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200 shadow-xs'
                        : isTopRank
                        ? isDark
                          ? 'border-neutral-600 bg-neutral-900/60'
                          : 'border-neutral-300 bg-white ring-1 ring-neutral-200 shadow-xs'
                        : isDark
                        ? 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                        : 'border-neutral-200/90 bg-white hover:border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
                    }`}
                  >
                <div className="p-4 space-y-3">
                  {/* Top Bar: Title & Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {candidate.isPinned && (
                          <span
                            className={`font-mono-code text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                              isDark
                                ? 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                                : 'text-amber-700 bg-amber-100 border-amber-300'
                            }`}
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            高亮优选
                          </span>
                        )}
                        {isTopRank && !candidate.isPinned && (
                          <span
                            className={`font-mono-code text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              isDark
                                ? 'text-rose-400 bg-rose-950/60 border-rose-900/50'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            TOP 1 优选
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-400 font-mono-code">
                          #{index + 1}
                        </span>
                      </div>
                      <h3
                        className={`text-sm font-semibold truncate mt-1 ${
                          isDark ? 'text-neutral-100' : 'text-neutral-900'
                        }`}
                      >
                        {candidate.title}
                      </h3>
                      <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span>{candidate.community}</span>
                        {candidate.address && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{candidate.address}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Interactive Star Button for Pinned Highlight */}
                      <button
                        onClick={(e) => handleTogglePin(candidate.id, e)}
                        className={`p-1.5 rounded transition-all ${
                          candidate.isPinned
                            ? isDark
                              ? 'text-amber-400 bg-amber-950/40 border border-amber-800/60'
                              : 'text-amber-600 bg-amber-50 border border-amber-200'
                            : isDark
                            ? 'text-neutral-600 hover:text-amber-400 hover:bg-neutral-800'
                            : 'text-neutral-400 hover:text-amber-500 hover:bg-neutral-100'
                        }`}
                        title={
                          candidate.isPinned
                            ? '取消高亮优选置顶'
                            : '设为高亮优选（固定在最上方对比）'
                        }
                        aria-label={candidate.isPinned ? '取消高亮优选置顶' : '设为高亮优选'}
                      >
                        <Star
                          className={`w-4 h-4 transition-transform active:scale-125 ${
                            candidate.isPinned ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>

                      <div
                        className={`text-right pl-2 border-l ${
                          isDark ? 'border-neutral-800' : 'border-neutral-200'
                        }`}
                      >
                        <div
                          className={`text-lg font-bold font-mono-code ${
                            isDark ? 'text-neutral-100' : 'text-neutral-900'
                          }`}
                        >
                          {candidate.weightedScore || 0}
                        </div>
                        <div className="text-[10px] text-neutral-400">综合得分</div>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Core Specs */}
                  <div
                    className={`rounded p-2.5 border grid grid-cols-2 gap-2 text-xs ${
                      isDark
                        ? 'bg-neutral-950/60 border-neutral-800/80'
                        : 'bg-neutral-50/80 border-neutral-100'
                    }`}
                  >
                    <div>
                      <span className="text-neutral-400 text-[10px] block">月租金</span>
                      <span
                        className={`font-bold font-mono-code text-sm ${
                          isDark ? 'text-neutral-100' : 'text-neutral-950'
                        }`}
                      >
                        {candidate.rent > 0 ? `¥${candidate.rent}` : '租金待核'}
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        含杂费约 ¥{monthlyTotal}/月
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-400 text-[10px] block">通勤耗时</span>
                      <span
                        className={`font-bold font-mono-code text-sm ${
                          isDark ? 'text-neutral-200' : 'text-neutral-900'
                        }`}
                      >
                        {routeMinutes[candidate.id] != null
                          ? `${routeMinutes[candidate.id]} 分钟`
                          : candidate.commuteMinutes != null
                          ? `${candidate.commuteMinutes} 分钟*`
                          : routeInfo[candidate.id]?.state === 'loading'
                          ? '查询中…'
                          : '路线耗时待实测'}
                      </span>
                      <span className="text-[10px] text-neutral-400 block truncate">
                        {routeMinutes[candidate.id] != null
                          ? '高德真实路线'
                          : candidate.commuteMinutes != null
                          ? '手动录入值'
                          : '高德路线不可用'}
                        {' · '}
                        {(() => {
                          const ws = getWalkToStation(routeInfo[candidate.id]?.segments);
                          if (ws) return `步行${ws.walkMin}分钟 至 ${ws.station}`;
                          if (candidate.walkToSubwayMin != null)
                            return `步行${candidate.walkToSubwayMin}m 至 ${candidate.subwayStation || '地铁站'}`;
                          return routeMinutes[candidate.id] != null ? '起点即车站' : '步行至站点待实测';
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Attributes & Amenities (Zero-pill text separators) */}
                  <div
                    className={`text-[11px] flex flex-wrap items-center gap-1.5 ${
                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                  >
                    <span>{candidate.utilitiesType === 'residential' ? '民水民电' : candidate.utilitiesType === 'commercial' ? '商水商电' : '水电待核实'}</span>
                    <span
                      aria-hidden="true"
                      className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                    >
                      ·
                    </span>
                    <span>
                      {candidate.landlordType === 'direct_landlord'
                        ? '房东直租'
                        : candidate.landlordType === 'unknown'
                        ? '出租方待核实'
                        : '中介/公寓'}
                    </span>
                    {candidate.floor && (
                      <>
                        <span
                          aria-hidden="true"
                          className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                        >
                          ·
                        </span>
                        <span>{candidate.floor}</span>
                      </>
                    )}
                    {candidate.areaSqMeters && (
                      <>
                        <span
                          aria-hidden="true"
                          className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                        >
                          ·
                        </span>
                        <span>{candidate.areaSqMeters}㎡</span>
                      </>
                    )}
                  </div>

                  {/* Neighborhood Search Grounding Info Preview / Action Button (Hidden in Focus Mode) */}
                  {!focusMode && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setSelectedGroundingCandidate(candidate);
                          setGroundingModalOpen(true);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded text-xs font-mono-code flex items-center justify-between transition-colors border ${
                          hasGrounding
                            ? isDark
                              ? 'bg-neutral-800/90 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                              : 'bg-neutral-100 border-neutral-300 text-neutral-900 hover:bg-neutral-200/70'
                            : isDark
                            ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400'
                            : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {hasGrounding ? '查看配套检索 (Grounding)' : '检索周边生活配套'}
                          </span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Operations */}
                <div
                  className={`p-3 border-t flex items-center justify-between text-xs ${
                    isDark
                      ? 'border-neutral-800/80 bg-neutral-950/40'
                      : 'border-neutral-100 bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {candidate.sourceUrl && (
                      <a
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1 rounded transition-colors flex items-center gap-1 text-[11px] font-mono-code ${
                          isDark
                            ? 'text-neutral-400 hover:text-emerald-300'
                            : 'text-neutral-400 hover:text-emerald-600'
                        }`}
                        title={`打开原始挂牌页（${candidate.sourcePlatform || '来源平台'}）`}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="hidden sm:inline">直达</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteCandidate(candidate.id)}
                      className={`p-1 rounded transition-colors ${
                        isDark
                          ? 'text-neutral-500 hover:text-rose-400'
                          : 'text-neutral-400 hover:text-rose-600'
                      }`}
                      title="删除房源"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMapView(true);
                        setSelectedCandidateId(candidate.id);
                      }}
                      className={`p-1 rounded transition-colors flex items-center gap-1 text-[11px] font-mono-code ${
                        selectedCandidateId === candidate.id
                          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 font-bold'
                          : isDark
                          ? 'text-neutral-400 hover:text-neutral-200'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                      title="在地图中高亮定位该房源"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">地图</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectCandidateForInspection && (
                      <button
                        onClick={() => onSelectCandidateForInspection(candidate.id)}
                        className={`px-2.5 py-1 text-xs font-mono-code rounded transition-colors ${
                          isDark
                            ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
                            : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
                        }`}
                      >
                        去验房 →
                      </button>
                    )}
                    <select
                      value={candidate.inspectionStatus}
                      onChange={(e) => handleStatusChange(candidate.id, e.target.value as any)}
                      className={`px-2 py-1 text-[11px] font-mono-code rounded border outline-none ${
                        isDark
                          ? 'border-neutral-800 bg-neutral-900 text-neutral-300'
                          : 'border-neutral-200 bg-white text-neutral-800 shadow-2xs'
                      }`}
                    >
                      <option value="pending">待看房</option>
                      <option value="scheduled">已约看</option>
                      <option value="visited">已实地验房</option>
                      <option value="shortlisted">已入选签约</option>
                      <option value="rejected">已淘汰</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>

          {/* Right Column: Candidate Map View */}
          {showMapView && (
            <div className="w-full xl:w-[42%] xl:sticky xl:top-20 shrink-0 space-y-2">
              <CandidatePropertiesMap
                candidates={sortedCandidates}
                city={plan.city}
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={(id) => {
                  setSelectedCandidateId(id);
                  const el = document.getElementById(`candidate-card-${id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }}
                isDark={isDark}
                onCloseMap={() => setShowMapView(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Neighborhood Amenities Search Grounding Modal */}
      <NeighborhoodSearchModal
        isOpen={groundingModalOpen}
        onClose={() => setGroundingModalOpen(false)}
        candidate={selectedGroundingCandidate}
        defaultCity={plan.city}
        onSaveToCandidate={handleSaveNeighborhoodToCandidate}
      />

      {/* Candidate Add/Edit Modal */}
      {/* Live Web Listing Scraper & Search Grounding Modal */}
      <LiveListingScraperModal
        isOpen={scraperModalOpen}
        onClose={() => setScraperModalOpen(false)}
        defaultCity={plan.city}
        defaultBudgetMax={plan.budget.maxMonthlyRent || 2800}
        onBatchImport={handleBatchImportScrapedListings}
      />
    </div>
  );
};
