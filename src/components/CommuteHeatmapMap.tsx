import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  getCityCenter,
  getCandidateApproxCoordinates,
  getCandidateCoordsForCity,
  getWorkplaceCoordinates,
  calculateCommuteRadiusMeters,
  loadGoogleMapsSdk,
  getGoogleMapsApiKey,
  onGoogleMapsAuthFailure,
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
} from 'lucide-react';

interface CommuteHeatmapMapProps {
  candidates: CandidateProperty[];
  city: string;
  workplace: string;
  maxCommuteMinutes: number;
  onUpdateMaxCommuteMinutes?: (minutes: number) => void;
  isDark?: boolean;
  className?: string;
}

export type EnrichedCandidate = CandidateProperty & {
  resolvedCoords: LatLng;
  commuteMin: number;
  isComfortable: boolean;
  isWithinLimit: boolean;
  overMinutes: number;
};

export const CommuteHeatmapMap: React.FC<CommuteHeatmapMapProps> = ({
  candidates,
  city,
  workplace,
  maxCommuteMinutes = 35,
  onUpdateMaxCommuteMinutes,
  isDark = false,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const circlesRef = useRef<any[]>([]);
  const workplaceMarkerRef = useRef<any>(null);

  const [mapEngine, setMapEngine] = useState<'google' | 'radar'>('google');
  const [loading, setLoading] = useState(true);
  const [authErrorNotice, setAuthErrorNotice] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('subway');
  const [showHeatOverlay, setShowHeatOverlay] = useState(true);
  const [onlyShowWithinLimit, setOnlyShowWithinLimit] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<EnrichedCandidate | null>(null);

  // Radar pan & zoom state
  const [radarZoom, setRadarZoom] = useState(1);
  const [radarPan, setRadarPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const cityCenter = useMemo(() => getCityCenter(city), [city]);
  const workplaceCoords = useMemo(
    () => getWorkplaceCoordinates(workplace, cityCenter),
    [workplace, cityCenter]
  );

  // Listen to Google Maps auth failure globally
  useEffect(() => {
    const unsub = onGoogleMapsAuthFailure(() => {
      console.warn('Google Maps 授权失败，已自动无缝切换到空间动态雷达等时圈');
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
        console.warn('检测到 Google 地图界面加载异常，已自动无缝切换到高精度雷达等时圈');
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

  // Comfortable commute threshold (e.g. 25 min or 65% of max limit)
  const comfortableMinutes = useMemo(() => {
    return Math.max(15, Math.round(Math.min(25, maxCommuteMinutes * 0.65)));
  }, [maxCommuteMinutes]);

  // Radiuses in meters
  const comfortableRadiusM = useMemo(
    () => calculateCommuteRadiusMeters(comfortableMinutes, transitMode),
    [comfortableMinutes, transitMode]
  );
  const maxRadiusM = useMemo(
    () => calculateCommuteRadiusMeters(maxCommuteMinutes, transitMode),
    [maxCommuteMinutes, transitMode]
  );

  // Compute resolved candidate coordinates
  const candidatesWithCoords = useMemo(() => {
    return candidates.map((cand, idx) => {
      const coords = getCandidateCoordsForCity(cand, cityCenter, idx);
      const commuteMin = cand.commuteMinutes || 30;
      const isComfortable = commuteMin <= comfortableMinutes;
      const isWithinLimit = commuteMin <= maxCommuteMinutes;
      const overMinutes = isWithinLimit ? 0 : commuteMin - maxCommuteMinutes;

      return {
        ...cand,
        resolvedCoords: coords,
        commuteMin,
        isComfortable,
        isWithinLimit,
        overMinutes,
      };
    });
  }, [candidates, cityCenter, comfortableMinutes, maxCommuteMinutes]);

  // Filtered candidates based on toggle
  const visibleCandidates = useMemo(() => {
    if (!onlyShowWithinLimit) return candidatesWithCoords;
    return candidatesWithCoords.filter((c) => c.isWithinLimit);
  }, [candidatesWithCoords, onlyShowWithinLimit]);

  // Statistics
  const stats = useMemo(() => {
    const total = candidatesWithCoords.length;
    const withinCount = candidatesWithCoords.filter((c) => c.isWithinLimit).length;
    const comfortableCount = candidatesWithCoords.filter((c) => c.isComfortable).length;
    const overCount = total - withinCount;
    const avgMinutes =
      total > 0
        ? Math.round(
            candidatesWithCoords.reduce((acc, c) => acc + c.commuteMin, 0) / total
          )
        : 0;

    return { total, withinCount, comfortableCount, overCount, avgMinutes };
  }, [candidatesWithCoords]);

  // Initialize Google Maps instance with graceful fallback
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      try {
        setLoading(true);
        const apiKey = await getGoogleMapsApiKey();
        await loadGoogleMapsSdk(apiKey, 5000);

        if (isCancelled || !mapContainerRef.current) return;

        const google = (window as any).google;
        if (!google?.maps?.Map) {
          throw new Error('Google Maps SDK 未就绪');
        }

        if (!mapInstanceRef.current) {
          const map = new google.maps.Map(mapContainerRef.current, {
            center: workplaceCoords,
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
        } else {
          mapInstanceRef.current.setCenter(workplaceCoords);
        }

        setMapEngine('google');
        setLoading(false);
      } catch (err: any) {
        console.warn('Google Maps unavailable in sandbox, switching to Radar Commute Map:', err?.message);
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
  }, [workplaceCoords]);

  // Sync Google Maps Overlays (Isochrone Circles & Workplace Marker)
  useEffect(() => {
    if (mapEngine !== 'google' || !mapInstanceRef.current || loading) return;

    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!google?.maps) return;

    // Clear old circles
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    // Clear old workplace marker
    if (workplaceMarkerRef.current) {
      if (typeof workplaceMarkerRef.current.setMap === 'function') {
        workplaceMarkerRef.current.setMap(null);
      } else if (workplaceMarkerRef.current.map) {
        workplaceMarkerRef.current.map = null;
      }
      workplaceMarkerRef.current = null;
    }

    if (showHeatOverlay) {
      // Zone 2 Outer Circle (达标通勤圈)
      const maxCircle = new google.maps.Circle({
        strokeColor: '#f59e0b',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#fbbf24',
        fillOpacity: 0.14,
        map,
        center: workplaceCoords,
        radius: maxRadiusM,
        clickable: false,
      });

      // Zone 1 Inner Circle (舒适黄金圈)
      const comfortableCircle = new google.maps.Circle({
        strokeColor: '#10b981',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#34d399',
        fillOpacity: 0.22,
        map,
        center: workplaceCoords,
        radius: comfortableRadiusM,
        clickable: false,
      });

      circlesRef.current = [maxCircle, comfortableCircle];
    }

    // Workplace Marker
    const { AdvancedMarkerElement } = google.maps.marker || {};
    if (AdvancedMarkerElement) {
      const pinContainer = document.createElement('div');
      pinContainer.className = 'cursor-pointer transform hover:scale-105 transition-transform z-50';
      pinContainer.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 9999px;
          font-family: monospace;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
          border: 2px solid #ffffff;
          background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
          color: #ffffff;
        ">
          <span>🏢</span>
          <span>${workplace || '工作地点'}</span>
        </div>
      `;

      workplaceMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: workplaceCoords,
        title: `工作地: ${workplace || '市中心商务区'}`,
        content: pinContainer,
      });
    } else {
      workplaceMarkerRef.current = new google.maps.Marker({
        position: workplaceCoords,
        map,
        title: `工作地: ${workplace || '市中心商务区'}`,
      });
    }
  }, [
    mapEngine,
    workplaceCoords,
    workplace,
    comfortableRadiusM,
    maxRadiusM,
    showHeatOverlay,
    loading,
  ]);

  // Sync Google Maps Candidate Markers
  useEffect(() => {
    if (mapEngine !== 'google' || !mapInstanceRef.current || loading) return;

    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!google?.maps) return;

    // Clear previous candidate markers
    markersRef.current.forEach((marker) => {
      if (typeof marker.setMap === 'function') {
        marker.setMap(null);
      } else if (marker.map) {
        marker.map = null;
      }
    });
    markersRef.current.clear();

    const { AdvancedMarkerElement } = google.maps.marker || {};

    visibleCandidates.forEach((candidate) => {
      const isSelected = activeCandidate?.id === candidate.id;
      const position = {
        lat: candidate.resolvedCoords.lat,
        lng: candidate.resolvedCoords.lng,
      };

      // Color scheme based on commute category
      let bgColor = '#10b981'; // green
      let tagText = `${candidate.commuteMin}m 舒适`;
      if (!candidate.isComfortable && candidate.isWithinLimit) {
        bgColor = '#f59e0b'; // amber
        tagText = `${candidate.commuteMin}m 达标`;
      } else if (!candidate.isWithinLimit) {
        bgColor = '#f43f5e'; // rose red
        tagText = `${candidate.commuteMin}m 超时+${candidate.overMinutes}m`;
      }

      if (AdvancedMarkerElement) {
        const pinContainer = document.createElement('div');
        pinContainer.className = `cursor-pointer transition-all duration-200 transform ${
          isSelected ? 'scale-115 z-40' : 'hover:scale-105 z-20'
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
            box-shadow: 0 4px 10px rgba(0,0,0,0.22);
            border: 2px solid ${isSelected ? '#ffffff' : 'rgba(255,255,255,0.85)'};
            background-color: ${bgColor};
            color: #ffffff;
          ">
            <span>¥${candidate.rent}</span>
            <span style="
              font-size: 9px;
              opacity: 0.95;
              padding: 1px 4px;
              border-radius: 4px;
              background-color: rgba(0,0,0,0.25);
            ">${tagText}</span>
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: `${candidate.community} - 单程通勤 ${candidate.commuteMin} 分钟`,
          content: pinContainer,
        });

        marker.addListener('click', () => {
          setActiveCandidate(candidate);
        });

        markersRef.current.set(candidate.id, marker);
      } else {
        const marker = new google.maps.Marker({
          position,
          map,
          title: `${candidate.community} - 单程通勤 ${candidate.commuteMin} 分钟`,
        });
        marker.addListener('click', () => {
          setActiveCandidate(candidate);
        });
        markersRef.current.set(candidate.id, marker);
      }
    });
  }, [mapEngine, visibleCandidates, activeCandidate, loading]);

  // Center map on workplace
  const handleCenterWorkplace = () => {
    if (mapEngine === 'google' && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(workplaceCoords);
      mapInstanceRef.current.setZoom(12);
    } else {
      setRadarPan({ x: 0, y: 0 });
      setRadarZoom(1);
    }
  };

  // Fit all candidates and workplace in view
  const handleFitAll = () => {
    if (mapEngine === 'google' && mapInstanceRef.current && (window as any).google?.maps) {
      const google = (window as any).google;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(workplaceCoords);
      visibleCandidates.forEach((c) => bounds.extend(c.resolvedCoords));
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
              <span>· 达标房源: <strong>{stats.withinCount}/{stats.total}</strong> 套</span>
              <span>· 候选均时: <strong>{stats.avgMinutes}</strong> 分钟</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
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
              title="切换为本地高精度动态雷达等时圈（离线高可用）"
            >
              <Compass className="w-3 h-3" />
              <span>动态雷达等时圈</span>
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

      {/* Network / Auth Notice Banner */}
      {authErrorNotice && (
        <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Google 地图网络连接受限，已无缝切换至「高精度动态雷达等时圈」（等时圈与测算均正常工作）</span>
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

      {/* Main Map Viewport */}
      <div
        className="relative flex-1 min-h-[420px] sm:min-h-[480px] w-full bg-slate-950 overflow-hidden select-none"
        onMouseDown={mapEngine === 'radar' ? handleMouseDown : undefined}
        onMouseMove={mapEngine === 'radar' ? handleMouseMove : undefined}
        onMouseUp={mapEngine === 'radar' ? handleMouseUp : undefined}
      >
        {/* Google Maps Container */}
        <div
          ref={mapContainerRef}
          className={`absolute inset-0 w-full h-full ${mapEngine === 'google' ? 'block' : 'hidden'}`}
        />

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
                <defs>
                  {/* Comfortable Inner Gradient (Green) */}
                  <radialGradient id="comfortGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="85%" stopColor="#10b981" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
                  </radialGradient>

                  {/* Acceptable Outer Gradient (Amber) */}
                  <radialGradient id="acceptableGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
                    <stop offset="85%" stopColor="#f59e0b" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                  </radialGradient>
                </defs>

                {/* Commute Heatmap Concentric Circles */}
                {showHeatOverlay && (
                  <>
                    {/* Outer Acceptable Zone (≤ maxCommuteMinutes) */}
                    <circle
                      cx="50%"
                      cy="50%"
                      r={Math.min(260, Math.max(120, maxCommuteMinutes * 4.2))}
                      fill="url(#acceptableGradient)"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />

                    {/* Inner Comfortable Zone (≤ comfortableMinutes) */}
                    <circle
                      cx="50%"
                      cy="50%"
                      r={Math.min(180, Math.max(70, comfortableMinutes * 4.2))}
                      fill="url(#comfortGradient)"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    />
                  </>
                )}

                {/* Background Distance Marks */}
                <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="rgba(255,255,255,0.06)" />
                <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.06)" />
              </svg>

              {/* Dynamic Heatmap Zone Labels */}
              {showHeatOverlay && (
                <>
                  <div
                    style={{
                      left: `calc(50% + ${Math.min(180, Math.max(70, comfortableMinutes * 4.2)) + 6}px)`,
                      top: 'calc(50% - 10px)',
                    }}
                    className="absolute text-[10px] font-mono-code font-bold text-emerald-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-emerald-500/40 pointer-events-none whitespace-nowrap shadow-xs"
                  >
                    🟢 舒适通勤区 (≤{comfortableMinutes}m / ~{(comfortableRadiusM / 1000).toFixed(1)}km)
                  </div>

                  <div
                    style={{
                      left: `calc(50% + ${Math.min(260, Math.max(120, maxCommuteMinutes * 4.2)) + 6}px)`,
                      top: 'calc(50% + 14px)',
                    }}
                    className="absolute text-[10px] font-mono-code font-bold text-amber-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-500/40 pointer-events-none whitespace-nowrap shadow-xs"
                  >
                    🟡 达标上限圈 (≤{maxCommuteMinutes}m / ~{(maxRadiusM / 1000).toFixed(1)}km)
                  </div>
                </>
              )}

              {/* Workplace Benchmark Center Pin */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center z-30">
                <div className="w-5 h-5 rounded-full bg-indigo-600 ring-6 ring-indigo-500/30 flex items-center justify-center text-[10px] text-white font-bold shadow-lg animate-pulse">
                  🏢
                </div>
                <div className="mt-1 text-[11px] font-mono-code font-bold text-white bg-indigo-950/95 px-2 py-0.5 rounded-full border border-indigo-500/50 shadow-md whitespace-nowrap">
                  工作地: {workplace || `${city}商圈`}
                </div>
              </div>

              {/* Candidate Property Markers Placed by Relative Offsets */}
              {visibleCandidates.map((candidate) => {
                const isSelected = activeCandidate?.id === candidate.id;
                // Calculate projected pixels relative to workplace
                const latDiff = candidate.resolvedCoords.lat - workplaceCoords.lat;
                const lngDiff = candidate.resolvedCoords.lng - workplaceCoords.lng;
                const cosLat = Math.cos((workplaceCoords.lat * Math.PI) / 180);

                const scale = 3600;
                const offsetX = lngDiff * cosLat * scale;
                const offsetY = -latDiff * scale;

                let tagBg = 'bg-emerald-600 border-emerald-300 text-white';
                let tagLabel = `${candidate.commuteMin}m 舒适`;

                if (!candidate.isComfortable && candidate.isWithinLimit) {
                  tagBg = 'bg-amber-600 border-amber-300 text-white';
                  tagLabel = `${candidate.commuteMin}m 达标`;
                } else if (!candidate.isWithinLimit) {
                  tagBg = 'bg-rose-600 border-rose-300 text-white';
                  tagLabel = `${candidate.commuteMin}m 超时+${candidate.overMinutes}m`;
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
                      {candidate.community} · 地铁步行 {candidate.walkToSubwayMin}m
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

              <div className="text-right shrink-0">
                <div className="text-base font-bold font-mono-code text-rose-400">
                  ¥{activeCandidate.rent}
                </div>
                <div className="text-[10px] text-slate-400 font-mono-code">/月</div>
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
                <span className="text-slate-400 block">步行至地铁站</span>
                <span className="font-mono-code font-bold text-slate-200">
                  {activeCandidate.walkToSubwayMin} 分钟
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">往返全年累耗</span>
                <span className="font-mono-code font-bold text-slate-200">
                  {Math.round(((activeCandidate.commuteMin * 2 * 250) / 60))} 小时/年
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend Explanations */}
      <div
        className={`px-4 py-2.5 flex flex-wrap items-center justify-between border-t text-[11px] shrink-0 gap-2 ${
          isDark ? 'bg-neutral-900 text-neutral-400 border-neutral-800' : 'bg-white text-neutral-500 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              舒适通勤圈 (≤{comfortableMinutes}m)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              达标上限圈 (≤{maxCommuteMinutes}m)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-300" />
            <span className="font-medium text-rose-700 dark:text-rose-400">
              超时疲劳区 (&gt;{maxCommuteMinutes}m)
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono-code text-neutral-400">
          *根据设定通勤时间与出行方式实时生成等时覆盖半径，支持拖拽平移与点击房源联动
        </div>
      </div>
    </div>
  );
};
