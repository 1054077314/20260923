import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  getCityCenter,
  getExplicitCoordinates,
  loadAmapSdk,
  LatLng,
} from '../utils/mapUtils';
import {
  MapPin,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  Home,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Map as MapIcon,
} from 'lucide-react';

interface CandidatePropertiesMapProps {
  candidates: CandidateProperty[];
  city: string;
  selectedCandidateId?: string | null;
  onSelectCandidate?: (candidateId: string) => void;
  isDark?: boolean;
  className?: string;
  onCloseMap?: () => void;
}

export const CandidatePropertiesMap: React.FC<CandidatePropertiesMapProps> = ({
  candidates,
  city,
  selectedCandidateId,
  onSelectCandidate,
  isDark = false,
  className = '',
  onCloseMap,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const amapMapRef = useRef<any>(null);
  const amapMarkersRef = useRef<any[]>([]);

  const [mapEngine, setMapEngine] = useState<'amap' | 'radar'>('amap');
  const [amapStatus, setAmapStatus] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [amapNotice, setAmapNotice] = useState('');
  const [activeProperty, setActiveProperty] = useState<CandidateProperty | null>(null);
  const [radarZoom, setRadarZoom] = useState(1);
  const [radarPan, setRadarPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const cityCenter = useMemo(() => getCityCenter(city), [city]);

  // 只有显式真实坐标才上图；解析不出 = 不画点，绝不锚定到城市中心冒充位置
  const candidatesWithCoords = useMemo(() => {
    return candidates
      .map((cand) => {
        const coords = getExplicitCoordinates(cand);
        return coords ? { ...cand, resolvedCoords: coords } : null;
      })
      .filter((c): c is typeof candidates[number] & { resolvedCoords: LatLng } => c !== null);
  }, [candidates]);

  // Sync active property from prop
  useEffect(() => {
    if (selectedCandidateId) {
      const found = candidatesWithCoords.find((c) => c.id === selectedCandidateId);
      if (found) {
        setActiveProperty(found);
        if (mapEngine === 'amap' && amapMapRef.current) {
          amapMapRef.current.setCenter([found.resolvedCoords.lng, found.resolvedCoords.lat]);
        }
      }
    }
  }, [selectedCandidateId, candidatesWithCoords, mapEngine]);

  // 高德底图初始化：失败自动回落雷达拓扑视图
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
            center: [cityCenter.lng, cityCenter.lat],
            zoom: 12,
            mapStyle: isDark ? 'amap://styles/grey' : 'amap://styles/normal',
            viewMode: '2D',
          });
          amapMapRef.current = map;
        } else {
          amapMapRef.current.setCenter([cityCenter.lng, cityCenter.lat]);
        }
        setAmapStatus('ok');
        setMapEngine('amap');
      } catch (err: any) {
        if (!cancelled) {
          console.warn('高德底图不可用，回落雷达拓扑:', err?.message);
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
  }, [cityCenter.lng, cityCenter.lat, isDark]);

  // 高德底图标记：候选价格气泡
  useEffect(() => {
    if (mapEngine !== 'amap' || amapStatus !== 'ok') return;
    const AMap = (window as any).AMap;
    const map = amapMapRef.current;
    if (!AMap?.Marker || !map) return;

    amapMarkersRef.current.forEach((m) => map.remove(m));
    amapMarkersRef.current = [];

    const esc = (s: any) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    candidatesWithCoords.forEach((candidate) => {
      const isSelected = selectedCandidateId === candidate.id;
      const marker = new AMap.Marker({
        position: [candidate.resolvedCoords.lng, candidate.resolvedCoords.lat],
        anchor: 'bottom-center',
        zIndex: isSelected ? 40 : 20,
        content: `
          <div style="
            display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:9999px;
            font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;
            box-shadow:0 4px 12px rgba(0,0,0,0.18);
            border:2px solid ${isSelected ? '#6366f1' : '#ffffff'};
            background-color:${isSelected ? '#4f46e5' : '#0f172a'};color:#ffffff;cursor:pointer;
          ">
            <span>${candidate.rent > 0 ? `¥${candidate.rent}` : '租金待核'}</span>
            <span style="font-size:9px;opacity:0.85;padding:1px 4px;border-radius:4px;background-color:rgba(255,255,255,0.2)">${
              candidate.walkToSubwayMin != null ? candidate.walkToSubwayMin + 'm' : '—'
            }</span>
          </div>`,
      });
      marker.on('click', () => {
        setActiveProperty(candidate);
        if (onSelectCandidate) onSelectCandidate(candidate.id);
      });
      amapMarkersRef.current.push(marker);
    });

    map.add(amapMarkersRef.current);
  }, [mapEngine, amapStatus, candidatesWithCoords, selectedCandidateId, onSelectCandidate]);

  const handleResetToCity = () => {
    if (mapEngine === 'amap' && amapMapRef.current) {
      amapMapRef.current.setCenter([cityCenter.lng, cityCenter.lat]);
      amapMapRef.current.setZoom(12);
    } else {
      setRadarPan({ x: 0, y: 0 });
      setRadarZoom(1);
    }
    setActiveProperty(null);
  };

  const handleFitAllCandidates = () => {
    if (candidatesWithCoords.length === 0) return;
    if (mapEngine === 'amap' && amapMapRef.current && amapMarkersRef.current.length > 0) {
      amapMapRef.current.setFitView(amapMarkersRef.current, false, [40, 40, 40, 40]);
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

  return (
    <div
      className={`rounded-xl overflow-hidden border shadow-sm flex flex-col transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      } ${className}`}
    >
      {/* Map Header Toolbar */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between border-b shrink-0 flex-wrap gap-2 ${
          isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-neutral-50/90 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5 font-mono-code">
              <span>{city} 候选房源地理坐标拓扑</span>
            </div>
            <div className="text-[10px] opacity-70 flex items-center gap-1 font-mono-code">
              <span>中心: {cityCenter.lat.toFixed(4)}, {cityCenter.lng.toFixed(4)}</span>
              <span>· 已标注 {candidatesWithCoords.length} 套</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
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
              title="本地动态空间雷达拓扑（离线兜底）"
            >
              <Compass className="w-3 h-3" />
              <span>空间雷达拓扑</span>
            </button>
          </div>

          {mapEngine === 'radar' && (
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
          )}

          <button
            type="button"
            onClick={handleResetToCity}
            title="回到城市中心"
            className="p-1.5 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
          >
            <Navigation className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">城市中心</span>
          </button>

          <button
            type="button"
            onClick={handleFitAllCandidates}
            disabled={candidatesWithCoords.length === 0}
            title="全览所有候选房源"
            className="p-1.5 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700 disabled:opacity-40 text-neutral-600 dark:text-neutral-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">全览</span>
          </button>

          {onCloseMap && (
            <button
              type="button"
              onClick={onCloseMap}
              title="收起地图视图"
              className="p-1.5 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700 text-neutral-500 transition-colors ml-1"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* AMap Failure Notice Banner */}
      {mapEngine === 'radar' && amapNotice && (
        <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>高德底图不可用（{amapNotice}），已切换至空间雷达拓扑</span>
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

      {/* Map Container Viewport */}
      <div
        className="relative flex-1 min-h-[380px] sm:min-h-[440px] w-full bg-slate-950 overflow-hidden select-none"
        onMouseDown={mapEngine === 'radar' ? handleMouseDown : undefined}
        onMouseMove={mapEngine === 'radar' ? handleMouseMove : undefined}
        onMouseUp={mapEngine === 'radar' ? handleMouseUp : undefined}
      >
        {/* AMap Basemap Container（AMap 会改写容器为 relative，需外层壳撑高） */}
        <div className={`absolute inset-0 ${mapEngine === 'amap' ? 'block' : 'hidden'}`}>
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Interactive Geospatial Radar Canvas Engine */}
        {mapEngine === 'radar' && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing bg-radial from-slate-900 to-slate-950">
          {/* Grid Lines & Concentric Radar Rings */}
          <div
            className="relative w-full h-full transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${radarPan.x}px, ${radarPan.y}px) scale(${radarZoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Radar Coordinate Grid SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-800/80">
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="50%" cy="50%" r="42%" fill="url(#radarGlow)" />
              <circle cx="50%" cy="50%" r="100" fill="none" strokeDasharray="3 3" />
              <circle cx="50%" cy="50%" r="180" fill="none" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="260" fill="none" strokeDasharray="4 4" />
              <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="rgba(255,255,255,0.06)" />
              <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.06)" />
            </svg>

            {/* Distance Labels */}
            <div className="absolute left-[calc(50%+105px)] top-[calc(50%-10px)] text-[9px] font-mono-code text-slate-500 pointer-events-none">
              ~1.5 km
            </div>
            <div className="absolute left-[calc(50%+185px)] top-[calc(50%-10px)] text-[9px] font-mono-code text-slate-500 pointer-events-none">
              ~3.0 km
            </div>
            <div className="absolute left-[calc(50%+265px)] top-[calc(50%-10px)] text-[9px] font-mono-code text-slate-500 pointer-events-none">
              ~5.0 km
            </div>

            {/* City Center Benchmark Pin */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
              <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/30 animate-pulse" />
              <div className="mt-1 text-[10px] font-mono-code text-indigo-300 bg-slate-900/90 px-1.5 py-0.5 rounded border border-indigo-500/30 shadow-xs whitespace-nowrap">
                {city}基准中心点
              </div>
            </div>

            {/* Candidate Property Markers */}
            {candidatesWithCoords.map((candidate) => {
              const isSelected = selectedCandidateId === candidate.id;
              // Calculate projected pixels relative to center
              // 1 deg lat ≈ 111km, 1 deg lng ≈ 111km * cos(lat)
              const latDiff = candidate.resolvedCoords.lat - cityCenter.lat;
              const lngDiff = candidate.resolvedCoords.lng - cityCenter.lng;
              const cosLat = Math.cos((cityCenter.lat * Math.PI) / 180);

              // Scale factor for visualization viewport
              const scale = 3600;
              const offsetX = lngDiff * cosLat * scale;
              const offsetY = -latDiff * scale;

              return (
                <div
                  key={candidate.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveProperty(candidate);
                    if (onSelectCandidate) onSelectCandidate(candidate.id);
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono-code text-xs font-bold shadow-lg border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-white ring-2 ring-indigo-400 shadow-indigo-500/40'
                        : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <MapPin className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                    <span>{candidate.rent > 0 ? `¥${candidate.rent}` : '租金待核'}</span>
                    <span className="text-[10px] font-normal opacity-80 pl-0.5">
                      {candidate.walkToSubwayMin != null ? `${candidate.walkToSubwayMin}m` : '—'}
                    </span>
                  </div>

                  {/* Community Title Tooltip on Hover */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-black/90 text-slate-200 text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                    {candidate.community} · {candidate.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Selected Property Bottom Floating Card */}
        {activeProperty && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm p-3 rounded-xl bg-slate-900/95 text-white backdrop-blur-md shadow-2xl border border-slate-700 z-30 animate-fadeIn text-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-white line-clamp-1">
                  {activeProperty.title || activeProperty.community}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{activeProperty.community} · {activeProperty.address}</span>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center gap-1.5">
                {activeProperty.sourceUrl && (
                  <a
                    href={activeProperty.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-600 flex items-center gap-1 text-[10px] font-mono-code"
                    title={`打开原始挂牌页（${activeProperty.sourcePlatform || '来源平台'}）`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    直达
                  </a>
                )}
                <div>
                  <div className="text-sm font-bold font-mono-code text-rose-400">
                    {activeProperty.rent > 0 ? `¥${activeProperty.rent}` : '租金待核'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono-code">/月</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
              <span className="text-slate-300">
                🚇 距地铁步行约 <strong>{activeProperty.walkToSubwayMin != null ? activeProperty.walkToSubwayMin : '—'}</strong> 分钟
              </span>

              {activeProperty.weightedScore && (
                <span className="font-mono-code px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60">
                  评分: {activeProperty.weightedScore.toFixed(0)}分
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Legend */}
      <div
        className={`px-3.5 py-2 flex items-center justify-between border-t text-[11px] shrink-0 ${
          isDark ? 'bg-neutral-900 text-neutral-400 border-neutral-800' : 'bg-white text-neutral-500 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-600 dark:bg-indigo-600" />
            <span>房源价格气泡</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-indigo-200" />
            <span>当前选中聚焦</span>
          </div>
        </div>

        <div className="text-[10px] font-mono-code">
          *支持鼠标拖拽平移与点击房源聚焦
        </div>
      </div>
    </div>
  );
};
