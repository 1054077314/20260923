import React, { useState, useEffect } from 'react';
import { RentalPlan } from '../types/rental';
import { CommuteHeatmapMap } from './CommuteHeatmapMap';
import type { TransitMode } from '../utils/mapUtils';
import { computeCommuteStats } from '../utils/commuteStats';
import { useCandidatePool } from '../utils/useCandidatePool';
import { useCommuteRoutes } from '../utils/useCommuteRoutes';
import { Flame, MapPin } from 'lucide-react';

interface CommuteModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  onNavigateToMatrix?: () => void;
  focusMode?: boolean;
  theme?: 'light' | 'dark';
}

export const CommuteModule: React.FC<CommuteModuleProps> = ({
  plan,
  onUpdatePlan,
  onNavigateToMatrix,
  focusMode,
  theme = 'light',
}) => {
  const budget = plan.budget;
  const shortlist = plan.candidates || [];
  const isDark = theme === 'dark';

  // 数据池模式：默认 all（全部真实快照房源，按当前城市/预算过滤）；
  // 只有用户明确切到 shortlist 时才限制到手动导入的已选候选。
  const [poolMode, setPoolMode] = useState<'all' | 'shortlist'>('all');

  const [city, setCity] = useState(plan.city || '乌鲁木齐');
  const [workplace, setWorkplace] = useState(budget.workplace || '');
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState(budget.maxCommuteMinutes || 35);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(5);
  const [farePerTrip, setFarePerTrip] = useState(4); // 默认单程地铁/公交 4 元

  // 真实路线状态：坐标与耗时全部来自高德实际路线规划，拿不到就诚实显示不可用
  const [transitMode, setTransitMode] = useState<TransitMode>('subway');

  // 全量真实房源快照：按当前城市拉取（server 端无截断），预算过滤在候选池里统一做
  const maxRent = budget.maxMonthlyRent || 0;
  const { pool: fullPool, snapshotMeta, snapshotError } = useCandidatePool({
    shortlist,
    city,
    maxMonthlyRent: maxRent,
  });

  const candidates = poolMode === 'all' ? fullPool : shortlist;

  // 工作地定位与逐房源真实路线耗时：统一走共享 hook，拿不到即不可用
  const { workplaceState, routeInfo } = useCommuteRoutes({
    candidates,
    city,
    workplace: budget.workplace,
    transitMode,
  });

  useEffect(() => {
    setCity(plan.city || '乌鲁木齐');
  }, [plan.city]);

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    onUpdatePlan({
      ...plan,
      city: newCity,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateMaxCommute = (mins: number) => {
    setMaxCommuteMinutes(mins);
    onUpdatePlan({
      ...plan,
      budget: { ...plan.budget, maxCommuteMinutes: mins },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleWorkplaceBlur = () => {
    if (workplace !== budget.workplace) {
      onUpdatePlan({
        ...plan,
        budget: { ...plan.budget, workplace },
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // 耗时仅来自真实路线规划结果；拿不到 = null（显示不可用），绝不兜底编造
  const candidateStats = computeCommuteStats(candidates, routeInfo, {
    workDaysPerWeek,
    farePerTrip,
  });

  // 可达过滤：默认只展示真实耗时 ≤ 上限的房源；超时 / 路线不可用 / 测算中的默认收起
  const [onlyReachable, setOnlyReachable] = useState(true);
  const reachableStats = candidateStats.filter(
    (s) => s.oneWayMin != null && s.oneWayMin <= maxCommuteMinutes
  );
  const routesPending = candidateStats.some((s) => s.routeState === 'loading');
  const displayedStats = onlyReachable ? reachableStats : candidateStats;

  const availableStats = candidateStats.filter((s) => s.oneWayMin != null);
  const sortedByTime = [...availableStats].sort((a, b) => (a.oneWayMin || 0) - (b.oneWayMin || 0));
  const bestCommute = sortedByTime[0] || null;
  const worstCommute = sortedByTime[sortedByTime.length - 1] || null;

  const savedHours =
    bestCommute && worstCommute && bestCommute.id !== worstCommute.id
      ? (worstCommute.annualHours || 0) - (bestCommute.annualHours || 0)
      : 0;

  // Theme styling helpers
  const cardBg = isDark
    ? 'bg-neutral-900/40 border-neutral-800/90 text-neutral-200'
    : 'bg-white border-neutral-200/90 text-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)]';
  const headerBorder = isDark ? 'border-neutral-800' : 'border-neutral-200/80';
  const headerTitle = isDark ? 'text-neutral-300' : 'text-neutral-900';
  const labelColor = isDark ? 'text-neutral-400' : 'text-neutral-600';
  const inputBg = isDark
    ? 'bg-neutral-900/60 border-neutral-800 focus:border-neutral-500 focus:bg-neutral-900 text-neutral-200'
    : 'bg-white border-neutral-200 focus:border-neutral-400 focus:bg-white text-neutral-900 focus:ring-1 focus:ring-neutral-200 shadow-2xs';

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* Title Section */}
      <div className="pt-2 pb-1 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className={`font-editorial italic text-3xl sm:text-4xl tracking-tight font-normal ${
              isDark ? 'text-neutral-100' : 'text-neutral-950'
            }`}
          >
            通勤对比
          </h1>
          <p
            className={`font-mono-code text-[11px] sm:text-xs tracking-[0.22em] uppercase mt-1.5 ${
              isDark ? 'text-neutral-500' : 'text-neutral-500'
            }`}
          >
            COMMUTE TIME, TRANSIT ROUTE & ANNUAL FATIGUE MATRIX
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono-code font-semibold border transition-all shadow-xs ${
            showHeatmap
              ? isDark
                ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                : 'bg-rose-50 text-rose-700 border-rose-300 shadow-2xs'
              : isDark
              ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
          title="切换通勤等时圈热力图显示"
        >
          <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-rose-500' : 'text-neutral-400'}`} />
          <span>{showHeatmap ? '通勤热力图 (已展开)' : '展开通勤热力图'}</span>
        </button>
      </div>

      {/* Commute Heatmap Map Overlay Section */}
      {showHeatmap && (
        <div className="w-full">
          <CommuteHeatmapMap
            candidates={candidates}
            city={city}
            workplace={workplace}
            maxCommuteMinutes={maxCommuteMinutes}
            onUpdateMaxCommuteMinutes={handleUpdateMaxCommute}
            isDark={isDark}
            transitMode={transitMode}
            onTransitModeChange={setTransitMode}
            workplaceState={workplaceState}
            routeMinutes={Object.fromEntries(candidateStats.map((s) => [s.id, s.oneWayMin]))}
            routeSegments={Object.fromEntries(
              candidateStats.filter((s) => s.routeState === 'ok').map((s) => [s.id, (s as any).segments as any[] | undefined])
            )}
            onOpenComparison={onNavigateToMatrix}
          />
        </div>
      )}

      {/* 3-Column Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Column 1: Commute Parameters */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`flex items-center gap-2 border-b pb-2 ${headerBorder}`}>
            <span className={`text-xs font-semibold ${headerTitle}`}>通勤目标与参数</span>
            <span className="font-mono-code text-[11px] text-neutral-400">// PARAMETERS</span>
          </div>

          <div className="space-y-5 text-xs">
            {/* 目标城市与定位 */}
            <div className="space-y-1.5 p-3 rounded-lg border border-rose-200/60 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <label className={`block font-semibold flex items-center gap-1.5 ${isDark ? 'text-rose-300' : 'text-rose-900'}`}>
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>目标城市 (地图锚定)</span>
                </label>
                <span className="font-mono-code text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                  {city || '乌鲁木齐'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onBlur={() => handleCityChange(city)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCityChange(city);
                  }}
                  placeholder="如：乌鲁木齐 / 北京 / 杭州"
                  className={`flex-1 rounded px-2.5 py-1.5 text-xs font-mono-code outline-none border transition-colors ${inputBg}`}
                />
                <button
                  type="button"
                  onClick={() => handleCityChange('乌鲁木齐')}
                  title="立即重置为乌鲁木齐"
                  className={`px-2 py-1.5 rounded text-[11px] font-mono-code font-bold border transition-colors cursor-pointer ${
                    city === '乌鲁木齐'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : isDark
                      ? 'border-neutral-700 hover:border-neutral-600 text-neutral-300'
                      : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  乌鲁木齐
                </button>
              </div>

              {/* 常用城市直选标签 */}
              <div className="flex flex-wrap gap-1 pt-1">
                {['乌鲁木齐', '北京', '上海', '广州', '深圳', '杭州', '成都', '西安'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCityChange(c)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                      city === c
                        ? 'bg-rose-600 text-white border-rose-600 font-bold'
                        : isDark
                        ? 'border-neutral-800 hover:border-neutral-700 text-neutral-400'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 工作地点 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>工作地 / 目标商圈</label>
              <input
                type="text"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                onBlur={handleWorkplaceBlur}
                placeholder="如：友好商圈 / 铁路局 / 高新区"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
              {city.includes('乌鲁木齐') && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {[
                    { label: '友好商圈', wp: '沙依巴克区 友好商圈' },
                    { label: '铁路局/北京路', wp: '新市区 铁路局商圈' },
                    { label: '高新区软件园', wp: '高新区 软件园' },
                    { label: '经开万达', wp: '经开区 万达广场' },
                    { label: '国际大巴扎', wp: '天山区 国际大巴扎' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setWorkplace(chip.wp);
                        onUpdatePlan({
                          ...plan,
                          budget: { ...plan.budget, workplace: chip.wp },
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                        workplace.includes(chip.label)
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : isDark
                          ? 'border-neutral-800 hover:border-neutral-700 text-neutral-400'
                          : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 单程通勤时间上限 */}
            <div className="space-y-1.5 p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <label className={`block font-semibold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                  单程通勤上限
                </label>
                <span className="font-mono-code font-bold text-sm text-amber-600 dark:text-amber-400">
                  {maxCommuteMinutes} 分钟
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="70"
                step="5"
                value={maxCommuteMinutes}
                onChange={(e) => handleUpdateMaxCommute(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono-code">
                <span>15m 步行圈</span>
                <span>35m 舒适</span>
                <span>45m 极限</span>
                <span>60m+ 超时</span>
              </div>
            </div>

            {/* 每周工作天数 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>每周通勤天数</label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 6, 7].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setWorkDaysPerWeek(days)}
                    className={`py-2 rounded text-xs font-mono-code transition-colors border ${
                      workDaysPerWeek === days
                        ? isDark
                          ? 'bg-neutral-800 border-neutral-600 text-neutral-100 font-semibold'
                          : 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                        : isDark
                        ? 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500 hover:text-neutral-300'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    {days} 天/周
                  </button>
                ))}
              </div>
            </div>

            {/* 单程预估票价 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>单程公共交通票价 (元)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={farePerTrip}
                onChange={(e) => setFarePerTrip(Number(e.target.value) || 0)}
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
              {!focusMode && (
                <span className="text-[11px] text-neutral-400">按地铁/公交常规单程乘车费估算</span>
              )}
            </div>

            {/* 提示备忘 (Hidden in Focus Mode) */}
            {!focusMode && (
              <div
                className={`pt-3 text-[11px] leading-relaxed border-t ${
                  isDark ? 'text-neutral-500 border-neutral-800/60' : 'text-neutral-500 border-neutral-200/60'
                }`}
              >
                单程耗时每多 15 分钟，全年累计往返约多耗费 125 小时在路上，相当于多上了半个月班。
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Candidates Commute List */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`flex items-center justify-between border-b pb-2 ${headerBorder}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${headerTitle}`}>候选房源通勤测算</span>
              <span className="font-mono-code text-[11px] text-neutral-400">
                // CANDIDATES ({candidates.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* 数据源切换：默认展示全部真实房源，仅用户明确切换才限制到已选候选 */}
              <button
                type="button"
                onClick={() => setPoolMode('all')}
                className={`px-2 py-1 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                  poolMode === 'all'
                    ? isDark
                      ? 'bg-rose-950/70 text-rose-300 border-rose-800 font-bold'
                      : 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                    : isDark
                    ? 'border-neutral-800 text-neutral-400 hover:text-neutral-300'
                    : 'border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
                title="展示当前城市+预算下所有真实快照房源"
              >
                全部真实房源 ({fullPool.length})
              </button>
              <button
                type="button"
                onClick={() => setPoolMode('shortlist')}
                className={`px-2 py-1 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                  poolMode === 'shortlist'
                    ? isDark
                      ? 'bg-rose-950/70 text-rose-300 border-rose-800 font-bold'
                      : 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                    : isDark
                    ? 'border-neutral-800 text-neutral-400 hover:text-neutral-300'
                    : 'border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
                title="仅展示在「房源对比」中手动导入的已选候选"
              >
                已选候选 ({shortlist.length})
              </button>
              {onNavigateToMatrix && (
                <button
                  onClick={onNavigateToMatrix}
                  className={`text-[11px] font-mono-code transition-colors ${
                    isDark
                      ? 'text-neutral-400 hover:text-neutral-200'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  + 添加房源
                </button>
              )}
            </div>
          </div>

          {snapshotError && (
            <div className="p-2.5 rounded bg-rose-950/20 border border-rose-800/40 text-rose-500 dark:text-rose-300 text-[11px] font-mono-code">
              ⚠ 真实房源快照不可用：{snapshotError}。当前仅展示已选候选，不会生成模拟数据。
            </div>
          )}
          {!snapshotError && poolMode === 'all' && snapshotMeta && (
            <div className="text-[10px] font-mono-code text-neutral-400">
              数据源：{snapshotMeta} · 已按当前预算 ≤ ¥{maxRent || '无上限'}/月过滤 · 通勤达标情况以高德真实路线为准
            </div>
          )}
          {/* 可达过滤开关：只看可达 / 展开全部（含超时与不可用） */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOnlyReachable(true)}
              className={`px-2 py-1 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                onlyReachable
                  ? isDark
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800 font-bold'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                  : isDark
                  ? 'border-neutral-800 text-neutral-400 hover:text-neutral-300'
                  : 'border-neutral-200 text-neutral-600 hover:text-neutral-900'
              }`}
              title="只展示真实耗时在单程上限内的房源"
            >
              只看可达 ({reachableStats.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyReachable(false)}
              className={`px-2 py-1 rounded text-[10px] font-mono-code border transition-colors cursor-pointer ${
                !onlyReachable
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-200 border-neutral-700 font-bold'
                    : 'bg-neutral-100 text-neutral-800 border-neutral-300 font-bold'
                  : isDark
                  ? 'border-neutral-800 text-neutral-400 hover:text-neutral-300'
                  : 'border-neutral-200 text-neutral-600 hover:text-neutral-900'
              }`}
              title="展开全部：含超时、路线不可用与测算中的房源"
            >
              展开全部 ({candidateStats.length})
            </button>
            {routesPending && (
              <span className="text-[10px] font-mono-code text-neutral-400">路线测算中…</span>
            )}
          </div>

          {candidates.length === 0 ? (
            <div
              className={`p-8 text-center border border-dashed rounded-lg text-xs ${
                isDark
                  ? 'border-neutral-800 text-neutral-500'
                  : 'border-neutral-200 bg-white text-neutral-400'
              }`}
            >
              {poolMode === 'shortlist'
                ? '已选候选为空，请切换「全部真实房源」或在「03 // 房源对比」中导入房源。'
                : snapshotError
                ? '真实房源快照不可用，且已选候选为空。'
                : `当前城市/预算条件下没有匹配的真实快照房源（预算上限 ¥${maxRent}/月）。`}
            </div>
          ) : displayedStats.length === 0 ? (
            <div
              className={`p-8 text-center border border-dashed rounded-lg text-xs ${
                isDark
                  ? 'border-neutral-800 text-neutral-500'
                  : 'border-neutral-200 bg-white text-neutral-400'
              }`}
            >
              {routesPending
                ? '真实路线测算中，耗时结果陆续返回后可达房源会自动出现。'
                : `当前上限 ${maxCommuteMinutes} 分钟内没有可达的真实房源（共测算 ${candidateStats.length} 套）。可放宽上限或点「展开全部」查看超时明细。`}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedStats.map((item) => {
                const isFastest = bestCommute?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isFastest
                        ? isDark
                          ? 'bg-neutral-900/70 border-emerald-500/40 ring-1 ring-emerald-500/20'
                          : 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200 shadow-xs'
                        : isDark
                        ? 'bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700'
                        : 'bg-white border-neutral-200/90 hover:border-neutral-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              isDark ? 'text-neutral-200' : 'text-neutral-900'
                            }`}
                          >
                            {item.title}
                          </span>
                          {isFastest && (
                            <span
                              className={`font-mono-code text-[10px] px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                                  : 'text-emerald-700 bg-emerald-100 border-emerald-300 font-semibold'
                              }`}
                            >
                              FASTEST 最短通勤
                            </span>
                          )}
                          {!isFastest && item.oneWayMin != null && item.oneWayMin > maxCommuteMinutes && (
                            <span
                              className={`font-mono-code text-[10px] px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                                  : 'text-rose-700 bg-rose-100 border-rose-300 font-semibold'
                              }`}
                            >
                              超时 +{item.oneWayMin - maxCommuteMinutes}m
                            </span>
                          )}
                          {!isFastest && item.oneWayMin != null && item.oneWayMin <= maxCommuteMinutes && (
                            <span
                              className={`font-mono-code text-[10px] px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? 'text-emerald-400/90 bg-emerald-950/40 border-emerald-800/40'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              符合时限
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {item.community || '未指定小区'} · 租金 ¥{item.rent}/月
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono-code text-lg font-bold ${
                            isDark ? 'text-neutral-100' : 'text-neutral-950'
                          }`}
                        >
                          {item.oneWayMin != null ? (
                            <>
                              {item.oneWayMin}{' '}
                              <span className="text-xs font-normal text-neutral-400">min</span>
                            </>
                          ) : item.routeState === 'loading' ? (
                            <span className="text-xs font-mono-code text-neutral-400">查询中…</span>
                          ) : (
                            <span
                              className="text-xs font-mono-code text-rose-500"
                              title={item.routeReason || ''}
                            >
                              不可用
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {item.oneWayMin != null ? '单程总耗时 · 高德实际路线' : '单程总耗时'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar showing commute strain */}
                    <div className="space-y-1 my-3">
                      <div
                        className={`w-full rounded-full h-1.5 overflow-hidden ${
                          isDark ? 'bg-neutral-950' : 'bg-neutral-100'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            (item.oneWayMin ?? 99) <= 30
                              ? 'bg-emerald-500'
                              : (item.oneWayMin ?? 99) <= 45
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{
                            width: item.oneWayMin != null ? `${Math.min(100, (item.oneWayMin / 75) * 100)}%` : '0%',
                          }}
                        />
                      </div>
                    </div>

                    {/* Commute details */}
                    <div
                      className={`grid grid-cols-3 gap-2 pt-2 border-t text-[11px] ${
                        isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                      }`}
                    >
                      <div>
                        <span className="text-neutral-400 block">步行至站点</span>
                        <span
                          className={`font-mono-code font-medium ${
                            isDark ? 'text-neutral-300' : 'text-neutral-800'
                          }`}
                        >
                          {item.walkMin != null ? item.walkMin + ' 分钟' : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">全年往返耗时</span>
                        <span
                          className={`font-mono-code font-medium ${
                            isDark ? 'text-neutral-300' : 'text-neutral-800'
                          }`}
                        >
                          {item.annualHours != null ? item.annualHours + ' 小时/年' : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">全年交通票价</span>
                        <span
                          className={`font-mono-code font-medium ${
                            isDark ? 'text-neutral-300' : 'text-neutral-800'
                          }`}
                        >
                          {item.annualFare != null ? '¥' + item.annualFare : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Commute Verdict */}
        <div className="lg:col-span-3 space-y-6">
          <div className={`rounded-lg p-6 space-y-6 border ${cardBg}`}>
            <div className={`flex items-center gap-2 border-b pb-2 ${headerBorder}`}>
              <span className={`text-xs font-semibold ${headerTitle}`}>通勤决策结论</span>
              <span className="font-mono-code text-[11px] text-neutral-400">// VERDICT</span>
            </div>

            {workplaceState.status === 'unavailable' && (
              <div className="p-2.5 rounded bg-rose-950/20 border border-rose-800/40 text-rose-500 dark:text-rose-300 text-[11px] font-mono-code mb-3">
                ⚠ 真实路线暂不可用：{workplaceState.reason}。耗时与结论不会使用估算值。
              </div>
            )}
            {bestCommute ? (
              <>
                <div className="space-y-2">
                  <div className={`text-xs font-medium ${labelColor}`}>通勤最优选</div>
                  <div
                    className={`text-base font-semibold truncate ${
                      isDark ? 'text-neutral-100' : 'text-neutral-900'
                    }`}
                  >
                    {bestCommute.title}
                  </div>
                  <div
                    className={`font-mono-code text-2xl font-bold ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    {bestCommute.oneWayMin}{' '}
                    <span className="text-xs text-neutral-400 font-normal">分钟/单程</span>
                  </div>
                  <div className="h-0.5 bg-emerald-500 w-14 rounded-full" />
                </div>

                <div className="space-y-3 text-xs pt-1">
                  <div
                    className={`flex justify-between items-center border-b pb-2.5 ${
                      isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                    }`}
                  >
                    <span className={labelColor}>全年最少路途耗时</span>
                    <span
                      className={`font-mono-code font-medium ${
                        isDark ? 'text-neutral-200' : 'text-neutral-900'
                      }`}
                    >
                      {bestCommute.annualHours} 小时
                    </span>
                  </div>

                  {worstCommute && savedHours > 0 && (
                    <div
                      className={`flex justify-between items-center border-b pb-2.5 ${
                        isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                      }`}
                    >
                      <span className={labelColor}>相比最远方案省下</span>
                      <span
                        className={`font-mono-code font-semibold ${
                          isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                      >
                        {savedHours} 小时/年
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pb-1">
                    <span className={labelColor}>预估年交通费</span>
                    <span
                      className={`font-mono-code font-medium ${
                        isDark ? 'text-neutral-200' : 'text-neutral-900'
                      }`}
                    >
                      ¥{bestCommute.annualFare}
                    </span>
                  </div>
                </div>

                {!focusMode && (
                  <div className={`pt-3 border-t ${headerBorder}`}>
                    <div
                      className={`font-mono-code text-[11px] tracking-wide font-medium ${
                        isDark ? 'text-emerald-400' : 'text-emerald-600'
                      }`}
                    >
                      COMMUTE VERDICT // 优先选择单程 ≤ 40 分钟房源
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-neutral-400 text-xs py-4">
                {candidates.length > 0
                  ? '当前没有任何房源拿到真实路线耗时（坐标或路线不可用），按规则不提供估算结论。'
                  : '暂无候选房源进行测算。请添加房源后查看对比。'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
