import React, { useState } from 'react';
import { PlanTemplate, RentalPlan } from '../types/rental';
import { PRESET_TEMPLATES } from '../data/defaultTemplates';
import { getCustomTemplates } from '../utils/storage';
import { Plus, X, Layers, Check } from 'lucide-react';

interface NewPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlan: (name: string, city: string, targetDate: string, templateId?: string) => void;
}

export const NewPlanModal: React.FC<NewPlanModalProps> = ({
  isOpen,
  onClose,
  onCreatePlan,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('2026 新城市租房规划');
  const [city, setCity] = useState('');
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('graduate_budget');

  const customTemplates = getCustomTemplates();
  const allTemplates = [...PRESET_TEMPLATES, ...customTemplates];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreatePlan(name.trim(), city.trim(), targetDate, selectedTemplateId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                新建租房规划方案
              </h3>
              <p className="text-[11px] text-slate-500">
                可选择套用现成模板，快速初始化打分权重与防坑核验清单
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 font-medium mb-1">规划名称 *</label>
            <input
              type="text"
              required
              placeholder="例：2026 北京海淀工作租房"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">目标城市</label>
              <input
                type="text"
                placeholder="例：北京 / 杭州 / 广州"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">计划入住日期</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              选择初始继承模板 (推荐)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {allTemplates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                    selectedTemplateId === t.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-xs truncate">{t.name}</div>
                    <div
                      className={`text-[10px] truncate ${
                        selectedTemplateId === t.id ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {t.tag} · {t.description.slice(0, 16)}...
                    </div>
                  </div>
                  {selectedTemplateId === t.id && (
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
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
              确认创建方案
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
