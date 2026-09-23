import React, { useState } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  X,
  Search,
  MapPin,
  ExternalLink,
  Loader2,
  Sparkles,
  Train,
  ShoppingCart,
  UtensilsCrossed,
  Hospital,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
} from 'lucide-react';

interface NeighborhoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: CandidateProperty | null;
  defaultCity?: string;
  onSaveToCandidate?: (
    candidateId: string,
    amenitiesSummary: string,
    sources: { title: string; url: string }[]
  ) => void;
}

export const NeighborhoodSearchModal: React.FC<NeighborhoodSearchModalProps> = ({
  isOpen,
  onClose,
  candidate,
  defaultCity = '',
  onSaveToCandidate,
}) => {
  const [city, setCity] = useState(defaultCity || '杭州');
  const [community, setCommunity] = useState(candidate?.community || candidate?.title || '');
  const [address, setAddress] = useState(candidate?.address || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    sources: { title: string; url: string }[];
    searchQueries: string[];
    query: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync candidate info when modal opens or candidate changes
  React.useEffect(() => {
    if (candidate) {
      setCommunity(candidate.community || candidate.title || '');
      setAddress(candidate.address || '');
      if (candidate.neighborhoodInfo?.summary) {
        setResult({
          content: candidate.neighborhoodInfo.summary,
          sources: candidate.neighborhoodInfo.sources || [],
          searchQueries: [],
          query: `${defaultCity} ${candidate.community || ''}`,
        });
      } else {
        setResult(null);
      }
    } else {
      setCommunity('');
      setAddress('');
      setResult(null);
    }
    setError(null);
  }, [candidate, defaultCity, isOpen]);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!community.trim() && !address.trim()) {
      setError('请输入小区名称或大致位置/门牌地址');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/amenities-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          community: community.trim(),
          address: address.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '检索失败，请稍后重试');
      }

      setResult({
        content: data.content,
        sources: data.sources || [],
        searchQueries: data.searchQueries || [],
        query: data.query,
      });

      // If tied to a candidate, automatically cache it
      if (candidate && onSaveToCandidate) {
        onSaveToCandidate(candidate.id, data.content, data.sources || []);
      }
    } catch (err: any) {
      setError(err.message || '网络连接异常，无法检索周边生活配套');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">周边生活配套检索</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/60 text-indigo-100 font-mono">
                  Google Search Grounding
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                实时检索真实网络数据：地铁出入口距离、商超菜场、夜市烟火及租客风评避坑
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 shrink-0 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <div className="sm:col-span-3">
              <label className="block text-slate-500 font-medium mb-1">城市</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="城市，如：杭州"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-slate-800"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-slate-500 font-medium mb-1">小区/公寓名称 *</label>
              <input
                type="text"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                placeholder="如：翠苑一区 / 浅水湾花园"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium focus:outline-hidden focus:border-slate-800"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-slate-500 font-medium mb-1">大概地址 (选填)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="如：文一路 / 近地铁2号线"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                当前目标房源：{candidate ? candidate.title : '通用地标检索'}
              </span>
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>实时联网检索中...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>开始检索周边配套</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={handleSearch}
                className="text-[11px] underline font-medium hover:text-rose-900"
              >
                重试
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-5 h-5 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  正在检索【{city} · {community || address}】周边真实信息...
                </div>
                <div className="text-[11px] text-slate-400">
                  Google Search Grounding 正在排查地铁、商超菜场、外卖便利及潜在避坑点
                </div>
              </div>
            </div>
          )}

          {!loading && !result && (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-700">
                  输入小区名称后点击“开始检索周边配套”
                </div>
                <div className="text-[11px] text-slate-400 max-w-md mx-auto">
                  基于 Google 实时网络搜索，自动为你查明该小区距最近地铁站几米、周边有没有大超市菜场、楼下外卖宵夜多不多，以及网友常吐槽的噪音痛点。
                </div>
              </div>

              {/* Quick Suggestions */}
              {candidate && (
                <div className="pt-2">
                  <button
                    onClick={handleSearch}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>一键检索「{candidate.community || candidate.title}」</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && result && (
            <div className="space-y-4">
              {/* Action Tools */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>检索结果（{result.query}）</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? '已复制' : '复制内容'}</span>
                  </button>
                  <button
                    onClick={handleSearch}
                    className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>刷新</span>
                  </button>
                </div>
              </div>

              {/* Formatted Markdown Content */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-700 leading-relaxed space-y-3 whitespace-pre-line font-sans">
                {result.content}
              </div>

              {/* Grounding Web Sources / Citations */}
              {result.sources && result.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>网络搜索参考来源 ({result.sources.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {result.sources.slice(0, 6).map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] flex items-center justify-between gap-2 transition-colors truncate"
                      >
                        <span className="truncate">{src.title || src.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-slate-400">
            {candidate ? `正在针对房源「${candidate.title}」比选` : '可随时用于任意备选小区'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              关闭
            </button>
            {result && candidate && onSaveToCandidate && (
              <button
                onClick={() => {
                  onSaveToCandidate(candidate.id, result.content, result.sources);
                  onClose();
                }}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
              >
                保存到该房源备忘
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
