import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  getCityCenter,
  getCandidateApproxCoordinates,
  getCandidateCoordsForCity,
  loadGoogleMapsSdk,
  getGoogleMapsApiKey,
  onGoogleMapsAuthFailure,
  LatLng,
} from '../utils/mapUtils';
import {
  MapPin,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  RefreshCw,
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
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);

  const [mapEngine, setMapEngine] = useState<'google' | 'radar'>('google');
  const [loading, setLoading] = useState(true);
  const [authErrorNotice, setAuthErrorNotice] = useState(false);
  const [activeProperty, setActiveProperty] = useState<CandidateProperty | null>(null);
  const [radarZoom, setRadarZoom] = useState(1);
  const [radarPan, setRadarPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const cityCenter = useMemo(() => getCityCenter(city), [city]);

  // Listen to Google Maps auth failure globally
  useEffect(() => {
    const unsub = onGoogleMapsAuthFailure(() => {
      console.warn('Google Maps 授权失败，自动无缝切换到空间雷达等时圈');
      setMapEngine('radar');
      setLoading(false);
      setAuthErrorNotice(true);
    });
    return unsub;
  }, []);

  // Detect Google Maps grey error overlay in the DOM and auto-recover
  useEffect(() => {
    if (mapEngine !== 'google' || !mapContainerRef.current) return;
    const observer = new MutationObserver(() => {
      const container = mapContainerRef.current;
      if (
        container &&
        (container.querySelector('.gm-err-container') ||
          container.textContent?.includes('此页面未能正确加载') ||
          container.textContent?.includes('糟糕！出了点问题'))
      ) {
        console.warn('检测到 Google 地图界面异常，自动切换到高精度雷达拓扑视图');
        setMapEngine('radar');
        setLoading(false);
        setAuthErrorNotice(true);
      }
    });

    observer.observe(mapContainerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [mapEngine]);

  // Compute resolved coordinates for every candidate
  const candidatesWithCoords = useMemo(() => {
    return candidates.map((cand, idx) => {
      const coords = getCandidateCoordsForCity(cand, cityCenter, idx);
      return {
        ...cand,
        resolvedCoords: coords,
      };
    });
  }, [candidates, cityCenter]);

  // Initialize Google Maps instance with graceful fallback
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      try {
        setLoading(true);

        const apiKey = await getGoogleMapsApiKey();
        // Load with 5s timeout; falls back gracefully if network is restricted
        await loadGoogleMapsSdk(apiKey, 5000);

        if (isCancelled || !mapContainerRef.current) return;

        const google = (window as any).google;
        if (!google?.maps?.Map) {
          throw new Error('Google Maps SDK 未就绪');
        }

        if (!mapInstanceRef.current) {
          const map = new google.maps.Map(mapContainerRef.current, {
            center: cityCenter,
            zoom: 12,
            mapId: 'DEMO_MAP_ID',
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          });

          mapInstanceRef.current = map;
          infoWindowRef.current = new google.maps.InfoWindow();
        } else {
          mapInstanceRef.current.setCenter(cityCenter);
        }

        setMapEngine('google');
        setLoading(false);
      } catch (err: any) {
        console.warn('Google Maps unavailable, switching to Interactive Radar Map:', err?.message);
        if (!isCancelled) {
          setMapEngine('radar');
          setLoading(false);
          setAuthErrorNotice(true);
        }
      }
    }

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [cityCenter]);

  // Sync Markers for Google Maps when in google engine mode
  useEffect(() => {
    if (mapEngine !== 'google' || !mapInstanceRef.current || loading) return;

    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((marker) => {
      if (typeof marker.setMap === 'function') {
        marker.setMap(null);
      } else if (marker.map) {
        marker.map = null;
      }
    });
    markersRef.current.clear();

    const { AdvancedMarkerElement } = google.maps.marker || {};

    candidatesWithCoords.forEach((candidate) => {
      const isSelected = selectedCandidateId === candidate.id;
      const position = {
        lat: candidate.resolvedCoords.lat,
        lng: candidate.resolvedCoords.lng,
      };

      if (AdvancedMarkerElement) {
        const pinContainer = document.createElement('div');
        pinContainer.className = `cursor-pointer transition-all duration-200 transform ${
          isSelected ? 'scale-110 z-50' : 'hover:scale-105 z-10'
        }`;

        pinContainer.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 9999px;
            font-family: monospace;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.18);
            border: 2px solid ${isSelected ? '#6366f1' : '#ffffff'};
            background-color: ${isSelected ? '#4f46e5' : '#0f172a'};
            color: #ffffff;
          ">
            <span>¥${candidate.rent}</span>
            <span style="
              font-size: 9px;
              opacity: 0.85;
              padding: 1px 4px;
              border-radius: 4px;
              background-color: rgba(255,255,255,0.2);
            ">${candidate.walkToSubwayMin}m</span>
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: candidate.title || candidate.community,
          content: pinContainer,
        });

        marker.addListener('click', () => {
          setActiveProperty(candidate);
          if (onSelectCandidate) onSelectCandidate(candidate.id);
        });

        markersRef.current.set(candidate.id, marker);
      } else {
        const marker = new google.maps.Marker({
          position,
          map,
          title: candidate.title || candidate.community,
        });
        marker.addListener('click', () => {
          setActiveProperty(candidate);
          if (onSelectCandidate) onSelectCandidate(candidate.id);
        });
        markersRef.current.set(candidate.id, marker);
      }
    });
  }, [mapEngine, candidatesWithCoords, selectedCandidateId, loading, onSelectCandidate]);

  // Sync active property from prop
  useEffect(() => {
    if (selectedCandidateId) {
      const found = candidatesWithCoords.find((c) => c.id === selectedCandidateId);
      if (found) {
        setActiveProperty(found);
        if (mapEngine === 'google' && mapInstanceRef.current) {
          mapInstanceRef.current.panTo({
            lat: found.resolvedCoords.lat,
            lng: found.resolvedCoords.lng,
          });
        }
      }
    }
  }, [selectedCandidateId, candidatesWithCoords, mapEngine]);

  const handleResetToCity = () => {
    if (mapEngine === 'google' && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(cityCenter);
      mapInstanceRef.current.setZoom(12);
    } else {
      setRadarPan({ x: 0, y: 0 });
      setRadarZoom(1);
    }
    setActiveProperty(null);
  };

  const handleFitAllCandidates = () => {
    if (candidatesWithCoords.length === 0) return;
    if (mapEngine === 'google' && mapInstanceRef.current && (window as any).google?.maps) {
      const google = (window as any).google;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(cityCenter);
      candidatesWithCoords.forEach((c) => bounds.extend(c.resolvedCoords));
      mapInstanceRef.current.fitBounds(bounds);
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
              onClick={() => setMapEngine('radar')}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                mapEngine === 'radar'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="切换为本地动态空间雷达拓扑"
            >
              <Compass className="w-3 h-3" />
              <span>空间雷达拓扑</span>
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('google')}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer ${
                mapEngine === 'google'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="切换为 Google Maps 实景底图"
            >
              <Layers className="w-3 h-3" />
              <span>Google 地图</span>
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

      {/* Network / Auth Notice Banner */}
      {authErrorNotice && (
        <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Google 地图网络连接受限，已无缝切换至「高精度空间雷达拓扑」（房源坐标均正常工作）</span>
          </div>
          <button
            type="button"
            onClick={() => setAuthErrorNotice(false)}
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
        {/* Google Maps Viewport Container */}
        <div
          ref={mapContainerRef}
          className={`absolute inset-0 w-full h-full ${mapEngine === 'google' ? 'block' : 'hidden'}`}
        />

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
                      <span>¥{candidate.rent}</span>
                      <span className="text-[10px] font-normal opacity-80 pl-0.5">
                        {candidate.walkToSubwayMin}m
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

              <div className="text-right shrink-0">
                <div className="text-sm font-bold font-mono-code text-rose-400">
                  ¥{activeProperty.rent}
                </div>
                <div className="text-[10px] text-slate-400 font-mono-code">/月</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
              <span className="text-slate-300">
                🚇 距地铁步行约 <strong>{activeProperty.walkToSubwayMin}</strong> 分钟
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
