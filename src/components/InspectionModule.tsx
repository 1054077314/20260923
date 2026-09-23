import React, { useState } from 'react';
import {
  RentalPlan,
  InspectionCategory,
  CandidateProperty,
} from '../types/rental';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sun,
  Tv,
  Home,
  Users,
  Plus,
  Info,
  ChevronDown,
  Building,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface InspectionModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  selectedCandidateId?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  utilities: <Zap className="w-4 h-4 text-amber-500" />,
  soundproof_lighting: <Sun className="w-4 h-4 text-amber-500" />,
  air_quality_hygiene: <ShieldAlert className="w-4 h-4 text-rose-500" />,
  appliances_furniture: <Tv className="w-4 h-4 text-blue-500" />,
  security_community: <Home className="w-4 h-4 text-emerald-500" />,
  roommates_neighbors: <Users className="w-4 h-4 text-indigo-500" />,
};

export const InspectionModule: React.FC<InspectionModuleProps> = ({
  plan,
  onUpdatePlan,
  selectedCandidateId,
}) => {
  // If candidates exist, allow user to toggle which candidate's checklist they are checking
  const [activeCandidateId, setActiveCandidateId] = useState<string>(
    selectedCandidateId || plan.candidates[0]?.id || 'general'
  );

  const [activeCategory, setActiveCategory] = useState<string>(
    plan.inspectionCategories[0]?.id || 'utilities'
  );

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDetail, setNewItemDetail] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Active candidate object (if not 'general')
  const currentCandidate = plan.candidates.find((c) => c.id === activeCandidateId);

  // Helper to toggle check status
  const handleToggleCheck = (itemId: string) => {
    if (activeCandidateId === 'general' || !currentCandidate) {
      // Toggle on candidate 0 or store in first candidate as general
      if (plan.candidates.length > 0) {
        const first = plan.candidates[0];
        const nextResults = {
          ...first.checklistResults,
          [itemId]: !first.checklistResults[itemId],
        };
        const updatedCandidates = plan.candidates.map((c, i) =>
          i === 0 ? { ...c, checklistResults: nextResults } : c
        );
        onUpdatePlan({ ...plan, candidates: updatedCandidates, updatedAt: new Date().toISOString() });
      }
      return;
    }

    const currentResults = currentCandidate.checklistResults || {};
    const nextResults = {
      ...currentResults,
      [itemId]: !currentResults[itemId],
    };

    const updatedCandidates = plan.candidates.map((c) =>
      c.id === activeCandidateId ? { ...c, checklistResults: nextResults } : c
    );

    onUpdatePlan({
      ...plan,
      candidates: updatedCandidates,
      updatedAt: new Date().toISOString(),
    });
  };

  const isChecked = (itemId: string): boolean => {
    if (activeCandidateId === 'general') {
      return !!plan.candidates[0]?.checklistResults?.[itemId];
    }
    return !!currentCandidate?.checklistResults?.[itemId];
  };

  // Add custom check item to category
  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;

    const newItem = {
      id: `custom-check-${Date.now()}`,
      title: newItemTitle.trim(),
      detail: newItemDetail.trim() || '无特殊备注',
      isCritical,
    };

    const updatedCategories = plan.inspectionCategories.map((cat) =>
      cat.id === activeCategory ? { ...cat, items: [...cat.items, newItem] } : cat
    );

    onUpdatePlan({
      ...plan,
      inspectionCategories: updatedCategories,
      updatedAt: new Date().toISOString(),
    });

    setNewItemTitle('');
    setNewItemDetail('');
    setIsCritical(false);
    setShowAddModal(false);
  };

  // Stats calculation
  const allItems = plan.inspectionCategories.flatMap((c) => c.items);
  const criticalItems = allItems.filter((i) => i.isCritical);
  const passedCount = allItems.filter((i) => isChecked(i.id)).length;
  const criticalPassedCount = criticalItems.filter((i) => isChecked(i.id)).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              阶段三：实地看房防坑排查与雷区清单
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              看房不能只看精修图片！携带这份涵盖6大系统维度的防坑清单，现场逐项排查“串串房、甲醛、商用水电、反味噪音”。
            </p>
          </div>

          {/* Candidate selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium">当前验房目标:</span>
            {plan.candidates.length > 0 ? (
              <select
                value={activeCandidateId}
                onChange={(e) => setActiveCandidateId(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white shadow-2xs"
              >
                {plan.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.community} - {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                通用排坑单 (未关联具体房源)
              </span>
            )}
          </div>
        </div>

        {/* Progress & Critical Trap Alert */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">整体通过进度</span>
              <span className="text-sm font-extrabold text-slate-900">
                {passedCount} / {allItems.length}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[11px]">关键一票否决项</span>
              <span
                className={`text-sm font-extrabold ${
                  criticalPassedCount === criticalItems.length
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {criticalPassedCount} / {criticalItems.length} 项通过
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>看房秘诀：尽量选择晴天午后或晚上下班时间，分别测试采光与周围噪音</span>
          </div>
        </div>
      </div>

      {/* Categories Tabs & Items Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Navigation (4 Cols) */}
        <div className="lg:col-span-4 space-y-2">
          {plan.inspectionCategories.map((cat) => {
            const catPassed = cat.items.filter((i) => isChecked(i.id)).length;
            const isCurrent = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  isCurrent
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCurrent ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {CATEGORY_ICONS[cat.id] || <Home className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{cat.name}</div>
                    <div
                      className={`text-[11px] truncate ${
                        isCurrent ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {cat.description}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span
                    className={`text-xs font-bold ${
                      catPassed === cat.items.length
                        ? isCurrent
                          ? 'text-emerald-300'
                          : 'text-emerald-600'
                        : isCurrent
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {catPassed}/{cat.items.length}
                  </span>
                </div>
              </button>
            );
          })}

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-2.5 px-3 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-400 bg-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加自定义验房排查项
          </button>
        </div>

        {/* Selected Category Items (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {plan.inspectionCategories
            .filter((cat) => cat.id === activeCategory)
            .map((cat) => (
              <div key={cat.id} className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{cat.name}</span>
                    <span className="text-slate-500 ml-2">· {cat.description}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">点击方框标记通过</span>
                </div>

                <div className="space-y-2.5">
                  {cat.items.map((item) => {
                    const checked = isChecked(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleCheck(item.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                          checked
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : item.isCritical
                            ? 'bg-white border-rose-200 hover:border-rose-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {checked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square
                              className={`w-5 h-5 ${
                                item.isCritical ? 'text-rose-400' : 'text-slate-300'
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className={`text-xs font-bold ${
                                checked
                                  ? 'text-slate-900 line-through opacity-75'
                                  : 'text-slate-900'
                              }`}
                            >
                              {item.title}
                            </h4>
                            {item.isCritical && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                ⚠️ 严查雷区
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Add Custom Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              添加自定义验房排坑项
            </h3>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">所属分类</label>
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              >
                {plan.inspectionCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">排查项目标题 *</label>
              <input
                type="text"
                placeholder="例：测试防盗门猫眼是否带摄像头"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">实操防坑细节 / 检验方式</label>
              <textarea
                rows={3}
                placeholder="例：查看门外是否有可疑记号，猫眼从外侧能否轻易拆卸窥视..."
                value={newItemDetail}
                onChange={(e) => setNewItemDetail(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="critical-check"
                checked={isCritical}
                onChange={(e) => setIsCritical(e.target.checked)}
                className="rounded border-slate-300 accent-slate-900"
              />
              <label htmlFor="critical-check" className="text-slate-700 font-medium">
                标为【⚠️ 关键一票否决项】
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
