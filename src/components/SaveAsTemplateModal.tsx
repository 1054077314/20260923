import React, { useState } from 'react';
import { RentalPlan, PlanTemplate } from '../types/rental';
import { BookmarkPlus, X, Check } from 'lucide-react';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: RentalPlan;
  onSaveTemplate: (template: PlanTemplate) => void;
}

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  isOpen,
  onClose,
  plan,
  onSaveTemplate,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(`${plan.name} (模板)`);
  const [tag, setTag] = useState(plan.city || '自拟方案');
  const [description, setDescription] = useState(
    `复用了 ¥${plan.budget.maxMonthlyRent}/月的预算体系及当前自定的评价权重与看房防坑清单。`
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTemplate: PlanTemplate = {
      id: `tmpl-${Date.now()}`,
      name: name.trim(),
      tag: tag.trim() || '自定义',
      description: description.trim(),
      badgeColor: 'indigo',
      defaultData: {
        name: name.trim(),
        city: plan.city,
        targetDate: plan.targetDate,
        status: 'planning',
        budget: plan.budget,
        weights: plan.weights,
        inspectionCategories: plan.inspectionCategories,
        contractChecklist: plan.contractChecklist,
        movingTasks: plan.movingTasks,
        handoverRecord: {
          waterMeter: '',
          electricMeter: '',
          gasMeter: '',
          keysCount: 2,
          applianceInventory: [],
          remarks: '',
        },
        candidates: [], // Clean candidates for reusable template
        monthlyExpenses: [],
      },
    };

    onSaveTemplate(newTemplate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookmarkPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                存为可复用租房模板
              </h3>
              <p className="text-[11px] text-slate-500">
                将当前的预算准则、打分权重和排查清单保存为个人预设
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 font-medium mb-1">模板名称 *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">分类标签</label>
            <input
              type="text"
              placeholder="例：毕业生/高新通勤/自由职业/情侣合居"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">模板描述</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
            >
              保存至模板库
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
