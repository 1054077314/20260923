import React from 'react';
import { PlanTemplate, RentalPlan } from '../types/rental';
import { PRESET_TEMPLATES } from '../data/defaultTemplates';
import { getCustomTemplates, deleteCustomTemplate } from '../utils/storage';
import {
  Layers,
  Sparkles,
  ArrowRight,
  Trash2,
  X,
  Compass,
  CheckCircle,
  Briefcase,
  GraduationCap,
  Users,
  Laptop,
  PiggyBank,
} from 'lucide-react';

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PlanTemplate) => void;
  onDeleteCustomTemplate: (templateId: string) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  ultra_low_budget: <PiggyBank className="w-5 h-5 text-amber-600" />,
  graduate_budget: <GraduationCap className="w-5 h-5 text-emerald-600" />,
  career_commute: <Briefcase className="w-5 h-5 text-blue-600" />,
  couple_family: <Users className="w-5 h-5 text-indigo-600" />,
  remote_creative: <Laptop className="w-5 h-5 text-purple-600" />,
};

export const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onDeleteCustomTemplate,
}) => {
  if (!isOpen) return null;

  const customTemplates = getCustomTemplates();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                租房规划模板库 (可复用预设)
              </h2>
              <p className="text-xs text-slate-500">
                选择一个现成的规划模板一键生成全新租房方案，内置量化权重、避坑清单与标准预算。
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Preset Templates */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              官方推荐场景模板
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {TEMPLATE_ICONS[tmpl.id] || <Compass className="w-5 h-5 text-indigo-600" />}
                        <h3 className="text-sm font-bold text-slate-900">{tmpl.name}</h3>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {tmpl.tag}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {tmpl.description}
                    </p>

                    <div className="pt-2 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>建议租金: ¥{tmpl.defaultData.budget.maxMonthlyRent}/月</span>
                      <span aria-hidden="true">·</span>
                      <span>单程通勤 ≤{tmpl.defaultData.budget.maxCommuteMinutes}分钟</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        重点偏好: {tmpl.defaultData.budget.mustHaves[0] || '民水民电'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectTemplate(tmpl);
                      onClose();
                    }}
                    className="w-full py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>使用此模板创建新方案</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Saved Templates */}
          {customTemplates.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                我的自定义模板 ({customTemplates.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">{tmpl.name}</h3>
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {tmpl.tag || '自定义'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{tmpl.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onSelectTemplate(tmpl);
                          onClose();
                        }}
                        className="flex-1 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>以此模板创建</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteCustomTemplate(tmpl.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-slate-200 bg-white"
                        title="删除自定义模板"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
