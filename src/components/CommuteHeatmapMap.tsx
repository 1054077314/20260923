import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  getCityCenter,
  loadAmapSdk,
  TransitMode,
  LatLng,
} from '../utils/mapUtils';
import {
  Compass,
  Navigation,
  Clock,
  Briefcase,
  Layers,
  ZoomIn,
  ZoomOut,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Flame,
  Bike,
  Train,
  Car,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import {
  EnrichedCommuteCandidate,
  annualHoursFromOneWay,
  enrichListingsForMap,
  getWalkToStation,
} from '../utils/commuteStats';

interface CommuteHeatmapMapProps {
  candidates: CandidateProperty[];
  city: string;
  workplace: string;
  maxCommuteMinutes: number;
  onUpdateMaxCommuteMinutes?: (minutes: number) => void;
  isDark?: boolean;
  className?: string;
  transitMode: TransitMode;
  onTransitModeChange: (mode: TransitMode) => void;
  workplaceState: { status: 'loading' | 'ok' | 'unavailable'; coord?: LatLng; reason?: string };
  routeMinutes?: Record<string, number | null | undefined>;
  routeSegments?: Record<string, any[] | undefined>;
  routesPending?: boolean;
  onOpenComparison?: () => void;
}

export type EnrichedCandidate = EnrichedCommuteCandidate;

export const CommuteHeatmapMap: React.FC<CommuteHeatmapMapProps> = ({
  candidates,
  city,
  workplace,
  maxCommuteMinutes = 35,
  onUpdateMaxCommuteMinutes,
  isDark = false,
  className = '',
  transitMode,
  onTransitModeChange,
  workplaceState = { status: 'loading' },
  routeMinutes = {},
  routeSegments = {},
  routesPending = false,
  onOpenComparison,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const amapMapRef = useRef<any>(null);
  const amapOverlaysRef = useRef<any[]>([]);

  const [mapEngine, setMapEngine] = useState<'amap' | 'radar'>('amap');
  const [amapStatus, setAmapStatus] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [amapNotice, setAmapNotice] = useState('');
  const setTransitMode = onTransitModeChange;
  const [showHeatOverlay, setShowHeatOverlay] = useState(true);
  const [onlyShowWithinLimit, setOnlyShowWithinLimit] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<EnrichedCandidate | null>(null);

  // Radar pan & zoom state
  const [radarZoom, setRadarZoom] = useState(1);
  const [radarPan, setRadarPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const cityCenter = useMemo(() => getCityCenter(city), [city]);
  // 真实定位：仅使用高德地理编码结果；拿不到 = null（不画工作地标记，不参与耗时）
  const workplaceCoords: LatLng | null =
    workplaceState.status === 'ok' && workplaceState.coord ? workplaceState.coord : null;
  // 地图视野中心：有真实工作地用工作地，否则回落城市中心（仅作视野）
  const displayCenter: LatLng = workplaceCoords || cityCenter;

  // 富化与统计统一走 commuteStats（唯一口径），组件只保留“仅看达标”UI 开关
  const { plotted: candidatesWithCoords, coverage } = useMemo(
    () => enrichListingsForMap(candidates, routeMinutes, maxCommuteMinutes),
    [candidates, routeMinutes, maxCommuteMinutes]
  );
  const stats = coverage;
  const noCoordCount = coverage.noCoordCount;

  // Filtered candidates based on toggle
  const visibleCandidates = useMemo(() => {
    if (!onlyShowWithinLimit) return candidatesWithCoords;
    return candidatesWithCoords.filter((c) => c.isWithinLimit);
  }, [candidatesWithCoords, onlyShowWithinLimit]);

  // 自动选中第一个可作图房源，便于直接展示真实路线
  useEffect(() => {
    if (!activeCandidate && visibleCandidates.length > 0) {
      setActiveCandidate(visibleCandidates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCandidates.length]);

  // 高德底图初始化：key 类型不符 / 网络受限时自动回落雷达等时圈
  useEffect(() => {
    let cancelled = false;

    async function initAmap() {
      if (!mapContainerRef.current) return;
      try {
        const res = await fetch('/api/amap-js-key').then((r) => r.json());
        const key = res?.key;
        if (!key) throw new Error('服务端未配置 AMAP_KEY');
        await loadAmapSdk(key, 8000);
        if (cancelled || !mapContainerRef.current) return;
        const AMap = (window as any).AMap;
        if (!AMap?.Map) throw new Error('高德 JS API 未就绪');

        if (!amapMapRef.current) {
          const map = new AMap.Map(mapContainerRef.current, {
            center: [displayCenter.lng, displayCenter.lat],
            zoom: 12,
            mapStyle: isDark ? 'amap://styles/grey' : 'amap://styles/normal',
            viewMode: '2D',
          });
          amapMapRef.current = map;
        } else {
          amapMapRef.current.setCenter([displayCenter.lng, displayCenter.lat]);
        }
        setAmapStatus('ok');
        setMapEngine('amap');
      } catch (err: any) {
        if (!cancelled) {
          console.warn('高德底图不可用，回落雷达等时圈:', err?.message);
          setAmapStatus('failed');
          setAmapNotice(err?.message || '高德底图不可用');
          setMapEngine('radar');
        }
      }
    }

    initAmap();

    return () => {
      cancelled = true;
    };
  }, [displayCenter.lng, displayCenter.lat, isDark]);

  // 价格标签配色：与雷达视图同一套通勤分档
  const pillStyle = (c: EnrichedCandidate, isSelected: boolean) => {
    let bg = '#6b7280';
    let tag = c.commuteMin != null ? `${c.commuteMin}m 舒适` : '路线不可用';
    if (c.commuteMin != null && !c.isComfortable && c.isWithinLimit) {
      bg = '#f59e0b';
      tag = `${c.commuteMin}m 达标`;
    } else if (c.commuteMin != null && !c.isWithinLimit) {
      bg = '#f43f5e';
      tag = `${c.commuteMin}m 超时+${c.overMinutes}m`;
    } else if (c.commuteMin != null) {
      bg = '#10b981';
    }
    return { bg, tag, border: isSelected ? '#ffffff' : 'rgba(255,255,255,0.85)' };
  };

  // 高德底图覆盖物：候选价格标签 + 工作地标 + 选中房源真实路线折线
  useEffect(() => {
    if (mapEngine !== 'amap' || amapStatus !== 'ok') return;
    const AMap = (window as any).AMap;
    const map = amapMapRef.current;
    if (!AMap?.Marker || !map) return;

    amapOverlaysRef.current.forEach((o) => map.remove(o));
    amapOverlaysRef.current = [];

    const esc = (s: any) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    visibleCandidates.forEach((candidate) => {
      const isSelected = activeCandidate?.id === candidate.id;
      const { bg, tag, border } = pillStyle(candidate, isSelected);
      const marker = new AMap.Marker({
        position: [candidate.resolvedCoords.lng, candidate.resolvedCoords.lat],
        anchor: 'bottom-center',
        zIndex: isSelected ? 40 : 20,
        content: `
          <div style="
            display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:9999px;
            font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;
            box-shadow:0 4px 10px rgba(0,0,0,0.22);
            border:2px solid ${border};background-color:${bg};color:#ffffff;cursor:pointer;
          ">
            <span>¥${candidate.rent}</span>
            <span style="font-size:9px;opacity:0.95;padding:1px 4px;border-radius:4px;background-color:rgba(0,0,0,0.25)">${esc(tag)}</span>
          </div>`,
      });
      marker.on('click', () => setActiveCandidate(candidate));
      amapOverlaysRef.current.push(marker);
    });

    if (workplaceCoords) {
      const wm = new AMap.Marker({
        position: [workplaceCoords.lng, workplaceCoords.lat],
        anchor: 'bottom-center',
        zIndex: 50,
        content: `
          <div style="
            display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:9999px;
            font-family:monospace;font-size:11px;font-weight:800;white-space:nowrap;
            box-shadow:0 4px 14px rgba(79,70,229,0.4);border:2px solid #ffffff;
            background:linear-gradient(135deg,#4f46e5 0%,#312e81 100%);color:#ffffff;
          ">
            <span>🏢</span>
            <span>${esc(workplace || '工作地点')}</span>
          </div>`,
      });
      amapOverlaysRef.current.push(wm);
    }

    // 选中房源的真实公交路线（高德规划结果，points 为 [lng,lat]）
    const segs = activeCandidate ? routeSegments[activeCandidate.id] : null;
    if (segs) {
      segs.forEach((seg: any) => {
        const line = new AMap.Polyline({
          path: seg.points.map((p: [number, number]) => [p[0], p[1]]),
          strokeColor: seg.type === 'walk' ? '#94a3b8' : '#e11d48',
          strokeWeight: seg.type === 'walk' ? 4 : 6,
          strokeOpacity: 0.95,
          strokeStyle: seg.type === 'walk' ? 'dashed' : 'solid',
          bubble: true,
        });
        amapOverlaysRef.current.push(line);
      });
    }

    map.add(amapOverlaysRef.current);
  }, [mapEngine, amapStatus, visibleCandidates, activeCandidate, routeSegments, workplaceCoords]);

  // Center map on workplace
  const handleCenterWorkplace = () => {
    if (mapEngine === 'amap' && amapMapRef.current) {
      amapMapRef.current.setCenter([displayCenter.lng, displayCenter.lat]);
      amapMapRef.current.setZoom(12);
    } else {
      setRadarPan({ x: 0, y: 0 });
      setRadarZoom(1);
    }
  };

  // Fit all candidates and workplace in view
  const handleFitAll = () => {
    if (mapEngine === 'amap' && amapMapRef.current && amapOverlaysRef.current.length > 0) {
      amapMapRef.current.setFitView(amapOverlaysRef.current, false, [40, 40, 40, 40]);
    } else {
      setRadarPan({ x: 0, y: 0 });
      setRadarZoom(1);
    }
  };

  // Drag handlers for Radar Map
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: radarPan.x,
      panY: radarPan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setRadarPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Quick preset pills
  const presets = [20, 30, 40, 45, 60];

  return (
    <div
      className={`rounded-xl overflow-hidden border shadow-sm flex flex-col transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      } ${className}`}
    >
      {/* Module Title & Stats Toolbar */}
      <div
        className={`px-4 py-3 border-b shrink-0 flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-neutral-50/90 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-2 font-mono-code">
              <span>通勤热力覆盖图 // COMMUTE ISOCHRONE HEATMAP</span>
            </div>
            <div className="text-[11px] opacity-80 flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="font-semibold text-rose-500 font-mono-code">📍 {city || '乌鲁木齐'}</span>
              <span>· <strong className="text-indigo-500">🏢 {workplace || `${city || '乌鲁木齐'}核心区`}</strong></span>
              {routesPending ? (
                <span>· <strong className="text-indigo-500 animate-pulse">真实路线测算中…</strong>（首次约 1-2 分钟，随后走缓存秒出）</span>
              ) : (
                <>
                  <span>· 达标房源: <strong>{stats.withinCount}/{stats.total}</strong> 套（仅计真实路线）</span>
                  <span>· 候选均时: <strong>{stats.avgMinutes || '—'}</strong> 分钟</span>
                </>
              )}
              {noCoordCount > 0 && <span>· 无真实坐标 {noCoordCount} 套未上图</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Engine Switcher */}
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 bg-neutral-100/80 dark:bg-neutral-800/80 text-[10px] font-mono-code mr-1">
            <button
              type="button"
              onClick={() => {
                setMapEngine('amap');
                if (amapStatus === 'failed') {
                  setAmapStatus('loading');
                  setAmapNotice('');
                }
              }}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                mapEngine === 'amap'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="高德地图实景底图"
            >
              <Layers className="w-3 h-3" />
              <span>高德地图</span>
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('radar')}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                mapEngine === 'radar'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="本地动态雷达等时圈（离线兜底）"
            >
              <Compass className="w-3 h-3" />
              <span>雷达等时圈</span>
            </button>
          </div>

          <div className="flex items-center rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => setRadarZoom((z) => Math.min(2.5, z + 0.2))}
              title="放大"
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRadarZoom((z) => Math.max(0.6, z - 0.2))}
              title="缩小"
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-l border-neutral-200 dark:border-neutral-700"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCenterWorkplace}
            title="回到工作地点为中心"
            className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5 text-indigo-500" />
            <span>定位工作地</span>
          </button>

          <button
            type="button"
            onClick={handleFitAll}
            title="全览所有候选与热力圈"
            className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>全览</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHeatOverlay(!showHeatOverlay)}
            title="开关热力图色彩叠加"
            className={`p-1.5 rounded text-xs border transition-colors ${
              showHeatOverlay
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'
            }`}
          >
            {showHeatOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive Commute Control Bar */}
      <div
        className={`px-4 py-2.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-neutral-100'
        }`}
      >
        {/* Commute Time Limit Slider & Presets */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium text-neutral-600 dark:text-neutral-400">通勤上限:</span>
            <span className="font-mono-code font-bold text-sm text-amber-600 dark:text-amber-400">
              {maxCommuteMinutes} 分钟
            </span>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="range"
              min="15"
              max="70"
              step="5"
              value={maxCommuteMinutes}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (onUpdateMaxCommuteMinutes) onUpdateMaxCommuteMinutes(val);
              }}
              className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  if (onUpdateMaxCommuteMinutes) onUpdateMaxCommuteMinutes(preset);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-mono-code border transition-colors ${
                  maxCommuteMinutes === preset
                    ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-2xs'
                    : isDark
                    ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-400'
                    : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                }`}
              >
                {preset}m
              </button>
            ))}
          </div>
        </div>

        {/* Transit Mode & Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => setTransitMode('subway')}
              className={`px-2 py-1 flex items-center gap-1 transition-colors ${
                transitMode === 'subway'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Train className="w-3 h-3" />
              <span>地铁/公交</span>
            </button>
            <button
              type="button"
              onClick={() => setTransitMode('bike')}
              className={`px-2 py-1 flex items-center gap-1 border-l border-neutral-200 dark:border-neutral-800 transition-colors ${
                transitMode === 'bike'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Bike className="w-3 h-3" />
              <span>单车骑行</span>
            </button>
            <button
              type="button"
              onClick={() => setTransitMode('car')}
              className={`px-2 py-1 flex items-center gap-1 border-l border-neutral-200 dark:border-neutral-800 transition-colors ${
                transitMode === 'car'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Car className="w-3 h-3" />
              <span>驾车打车</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={onlyShowWithinLimit}
              onChange={(e) => setOnlyShowWithinLimit(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>仅看达标房源 ({stats.withinCount})</span>
          </label>
        </div>
      </div>

      {/* AMap Failure Notice Banner */}
      {mapEngine === 'radar' && amapNotice && (
        <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>高德底图不可用（{amapNotice}），已切换至本地雷达等时圈；路线数据不受影响</span>
          </div>
          <button
            type="button"
            onClick={() => setAmapNotice('')}
            className="hover:opacity-75 font-mono-code text-[11px] underline ml-2 cursor-pointer"
          >
            忽略
          </button>
        </div>
      )}

      {/* Main Map Viewport */}
      <div
        className="relative flex-1 min-h-[420px] sm:min-h-[480px] w-full bg-slate-950 overflow-hidden select-none"
        onMouseDown={mapEngine === 'radar' ? handleMouseDown : undefined}
        onMouseMove={mapEngine === 'radar' ? handleMouseMove : undefined}
        onMouseUp={mapEngine === 'radar' ? handleMouseUp : undefined}
      >
        {/* AMap Basemap Container（AMap 会改写容器为 relative，需外层壳撑高） */}
        <div className={`absolute inset-0 ${mapEngine === 'amap' ? 'block' : 'hidden'}`}>
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Dynamic Radar Commute Heatmap Canvas Engine */}
        {mapEngine === 'radar' && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing bg-radial from-slate-900 to-slate-950">
            <div
              className="relative w-full h-full transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${radarPan.x}px, ${radarPan.y}px) scale(${radarZoom})`,
                transformOrigin: 'center center',
              }}
            >
              {/* Radar Coordinate Grid & Concentric Commute Rings */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Background Distance Marks */}
                <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="rgba(255,255,255,0.06)" />
                <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.06)" />
              </svg>

              {/* Selected listing's REAL AMap transit route drawn on radar canvas
                  (same px projection as candidate markers; center-anchored svg) */}
              {(() => {
                const segs = activeCandidate ? routeSegments[activeCandidate.id] : null;
                if (!segs || segs.length === 0) return null;
                const projectPt = (p: [number, number]): [number, number] => {
                  const lngDiff = p[0] - displayCenter.lng;
                  const latDiff = p[1] - displayCenter.lat;
                  const cosLat = Math.cos((displayCenter.lat * Math.PI) / 180);
                  return [lngDiff * cosLat * 3600, -latDiff * 3600];
                };
                return (
                  <svg
                    style={{ position: 'absolute', left: '50%', top: '50%', width: 1, height: 1, overflow: 'visible' }}
                    className="pointer-events-none"
                  >
                    {segs.map((seg: any, i: number) => (
                      <polyline
                        key={`seg-${i}`}
                        points={seg.points.map((p: [number, number]) => projectPt(p).join(',')).join(' ')}
                        fill="none"
                        stroke={seg.type === 'walk' ? '#94a3b8' : '#f43f5e'}
                        strokeWidth={seg.type === 'walk' ? 3 : 5}
                        strokeDasharray={seg.type === 'walk' ? '6 4' : undefined}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.95}
                      />
                    ))}
                    {segs
                      .filter((seg: any) => seg.type === 'bus')
                      .flatMap((seg: any, gi: number) => [seg.points[0], seg.points[seg.points.length - 1]])
                      .map((p: [number, number], i: number) => {
                        const [x, y] = projectPt(p);
                        return <circle key={`stop-${i}`} cx={x} cy={y} r={5} fill="#ffffff" stroke="#e11d48" strokeWidth={3} />;
                      })}
                  </svg>
                );
              })()}

              {/* Workplace Benchmark Center Pin */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center z-30">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-lg ${workplaceCoords ? 'bg-indigo-600 ring-6 ring-indigo-500/30 animate-pulse' : 'bg-neutral-600 ring-6 ring-neutral-500/20'}`}>
                  {workplaceCoords ? '🏢' : '?'}
                </div>
                <div className="mt-1 text-[11px] font-mono-code font-bold text-white bg-indigo-950/95 px-2 py-0.5 rounded-full border border-indigo-500/50 shadow-md whitespace-nowrap">
                  {workplaceCoords ? `工作地: ${workplace || `${city}商圈`}` : '工作地未定位（仅视野中心）'}
                </div>
              </div>

              {/* Candidate Property Markers Placed by Relative Offsets */}
              {visibleCandidates.map((candidate) => {
                const isSelected = activeCandidate?.id === candidate.id;
                // Calculate projected pixels relative to workplace
                const latDiff = candidate.resolvedCoords.lat - displayCenter.lat;
                const lngDiff = candidate.resolvedCoords.lng - displayCenter.lng;
                const cosLat = Math.cos((displayCenter.lat * Math.PI) / 180);

                const scale = 3600;
                const offsetX = lngDiff * cosLat * scale;
                const offsetY = -latDiff * scale;

                let tagBg = 'bg-neutral-600 border-neutral-300 text-white';
                let tagLabel = candidate.commuteMin != null ? `${candidate.commuteMin}m 舒适` : '路线不可用';

                if (candidate.commuteMin != null && !candidate.isComfortable && candidate.isWithinLimit) {
                  tagBg = 'bg-amber-600 border-amber-300 text-white';
                  tagLabel = `${candidate.commuteMin}m 达标`;
                } else if (candidate.commuteMin != null && !candidate.isWithinLimit) {
                  tagBg = 'bg-rose-600 border-rose-300 text-white';
                  tagLabel = `${candidate.commuteMin}m 超时+${candidate.overMinutes}m`;
                } else if (candidate.commuteMin != null) {
                  tagBg = 'bg-emerald-600 border-emerald-300 text-white';
                }

                return (
                  <div
                    key={candidate.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCandidate(candidate);
                    }}
                    style={{
                      left: `calc(50% + ${offsetX}px)`,
                      top: `calc(50% + ${offsetY}px)`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group ${
                      isSelected ? 'z-40 scale-110' : 'z-20 hover:scale-105'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono-code text-xs font-bold shadow-lg border transition-all ${tagBg} ${
                        isSelected ? 'ring-2 ring-white shadow-rose-500/40' : ''
                      }`}
                    >
                      <MapPin className="w-3 h-3 text-white" />
                      <span>¥{candidate.rent}</span>
                      <span className="text-[10px] font-medium opacity-90 pl-0.5">
                        {tagLabel}
                      </span>
                    </div>

                    {/* Community Title Tooltip on Hover */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-black/95 text-slate-200 text-[10px] px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none">
                      {(() => {
                        const ws = getWalkToStation(candidate.segments);
                        const walk = ws ? `${ws.walkMin}分` : candidate.walkToSubwayMin != null ? `${candidate.walkToSubwayMin}m` : '—';
                        const station = ws ? `至 ${ws.station}` : '';
                        return `${candidate.community} · 步行${walk}${station}`;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Candidate Commute Inspector Card */}
        {activeCandidate && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md p-3.5 rounded-xl bg-slate-900/95 text-white backdrop-blur-md shadow-2xl border border-slate-700 z-30 animate-fadeIn text-xs space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-bold text-white line-clamp-1 text-sm">
                    {activeCandidate.title || activeCandidate.community}
                  </div>
                  {activeCandidate.isComfortable ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold font-mono-code">
                      舒适通勤圈
                    </span>
                  ) : activeCandidate.isWithinLimit ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-semibold font-mono-code">
                      符合时限要求
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-semibold font-mono-code">
                      超出设定上限 {activeCandidate.overMinutes} 分钟
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{activeCandidate.community} · {activeCandidate.address || '地址待更新'}</span>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center gap-1.5">
                {activeCandidate.sourceUrl && (
                  <a
                    href={activeCandidate.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-600 flex items-center gap-1 text-[10px] font-mono-code"
                    title={`打开原始挂牌页（${activeCandidate.sourcePlatform || '来源平台'}）`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    直达
                  </a>
                )}
                <div>
                  <div className="text-base font-bold font-mono-code text-rose-400">
                    ¥{activeCandidate.rent}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono-code">/月</div>
                </div>
              </div>
            </div>

            {/* Commute Route Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block">单程总耗时</span>
                <span className={`font-mono-code font-bold ${
                  activeCandidate.isComfortable
                    ? 'text-emerald-400'
                    : activeCandidate.isWithinLimit
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {activeCandidate.commuteMin} 分钟
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">步行至首乘站</span>
                <span className="font-mono-code font-bold text-slate-200">
                  {(() => {
                    const ws = getWalkToStation(routeSegments[activeCandidate.id]);
                    if (ws) return `${ws.walkMin} 分钟 · ${ws.station}`;
                    if (activeCandidate.walkToSubwayMin != null)
                      return `${activeCandidate.walkToSubwayMin} 分钟`;
                    return activeCandidate.commuteMin != null ? '路线无步行段' : '—';
                  })()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">往返全年累耗</span>
                <span className="font-mono-code font-bold text-slate-200">
                  {activeCandidate.commuteMin != null
                    ? `${annualHoursFromOneWay(activeCandidate.commuteMin, 5)} 小时/年`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 选中房源的真实公交路线摘要 + 多房源切换对比 */}
        {(() => {
          const list = visibleCandidates;
          if (list.length === 0) return null;
          const sel = activeCandidate && list.some((c) => c.id === activeCandidate.id)
            ? activeCandidate
            : list[0];
          const selIdx = list.findIndex((c) => c.id === sel.id);
          const segs = routeSegments[sel.id] || [];
          const mins = routeMinutes[sel.id];

          const cycle = (dir: number) => {
            const next = list[(selIdx + dir + list.length) % list.length];
            setActiveCandidate(next);
          };

          return (
            <div className="absolute left-2 right-2 bottom-2 z-30">
              <div
                className={`rounded-lg border shadow-lg backdrop-blur-sm p-3 text-[11px] ${
                  isDark
                    ? 'bg-neutral-900/90 border-neutral-700 text-neutral-200'
                    : 'bg-white/95 border-neutral-200 text-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{sel.title}</span>
                    {mins != null ? (
                      <span className="font-mono-code font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {mins} min · 高德实际路线
                      </span>
                    ) : (
                      <span className="font-mono-code text-rose-500 shrink-0">路线不可用</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => cycle(-1)}
                      className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="上一套房源"
                    >
                      ‹
                    </button>
                    <span className="font-mono-code text-[10px] text-neutral-400 px-0.5">
                      {selIdx + 1}/{list.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => cycle(1)}
                      className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="下一套房源"
                    >
                      ›
                    </button>
                    {onOpenComparison && (
                      <button
                        type="button"
                        onClick={onOpenComparison}
                        className="ml-1 px-2 py-0.5 rounded border border-indigo-400/60 text-indigo-500 dark:text-indigo-300 hover:bg-indigo-500/10"
                      >
                        去对比全部房源
                      </button>
                    )}
                    {sel.sourceUrl && (
                      <a
                        href={sel.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 px-2 py-0.5 rounded border border-emerald-400/60 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1"
                        title={`打开原始挂牌页（${sel.sourcePlatform || '来源平台'}）`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        直达房源
                      </a>
                    )}
                  </div>
                </div>

                {mins == null ? (
                  <div className="text-[10px] text-neutral-400">
                    未拿到真实路线（坐标或路线规划不可用），不提供估算值。
                  </div>
                ) : segs.length === 0 ? (
                  <div className="text-[10px] text-neutral-400">
                    公交线路详情未返回（总耗时 {mins} 分钟来自高德）。
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {segs.map((seg: any, i: number) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-neutral-400">→</span>}
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono-code ${
                            seg.type === 'walk'
                              ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 font-semibold'
                          }`}
                        >
                          {seg.type === 'walk'
                            ? `🚶 步行 ${seg.minutes}分钟`
                            : `🚇 ${seg.lineName} ${seg.minutes}分钟（${seg.boardingStop}→${seg.alightingStop}）`}
                        </span>
                      </React.Fragment>
                    ))}
                    <span className="text-neutral-400 font-mono-code ml-1">
                      换乘 {Math.max(0, segs.filter((s: any) => s.type === 'bus').length - 1)} 次 · 步行合计{' '}
                      {segs.filter((s: any) => s.type === 'walk').reduce((a: number, s: any) => a + (s.minutes || 0), 0)} 分钟
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer Legend Explanations */}
      <div
        className={`px-4 py-2.5 flex flex-wrap items-center justify-between border-t text-[11px] shrink-0 gap-2 ${
          isDark ? 'bg-neutral-900 text-neutral-400 border-neutral-800' : 'bg-white text-neutral-500 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0 rounded-none" style={{ borderTop: '3px dashed #94a3b8' }} />
            <span className="font-medium text-slate-600 dark:text-slate-300">步行段（虚线）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-rose-500 rounded" />
            <span className="font-medium text-rose-600 dark:text-rose-400">公交/地铁段（实线）</span>
          </div>
          <span className="font-mono-code text-[10px]">路线来自高德实时公交规划 · 点击房源圆点切换路线</span>
        </div>

        <div className="text-[10px] font-mono-code text-neutral-400">
          *地图上展示的是选中房源到工作地的真实公交/地铁线路与步行段，无半径模拟；拿不到真实路线时显示不可用
        </div>
      </div>
    </div>
  );
};
