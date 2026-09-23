import React, { useState } from 'react';
import { RentalPlan } from '../types/rental';
import { Upload, X, AlertCircle, FileCheck } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPlan: (plan: RentalPlan) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportPlan,
}) => {
  if (!isOpen) return null;

  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setErrorMsg('');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    try {
      if (!jsonText.trim()) {
        setErrorMsg('请先粘贴或上传 JSON 规划数据');
        return;
      }
      const parsed = JSON.parse(jsonText);
      // Validate schema minimally
      if (!parsed.budget || !parsed.name) {
        setErrorMsg('JSON 格式不符合 RentPlan 数据规范，缺少必要的 budget 或 name 字段');
        return;
      }

      // Assign a new ID to avoid collisions
      const planToImport: RentalPlan = {
        ...parsed,
        id: `imported-plan-${Date.now()}`,
        name: parsed.name.includes('(导入)') ? parsed.name : `${parsed.name} (导入)`,
        updatedAt: new Date().toISOString(),
      };

      onImportPlan(planToImport);
      onClose();
    } catch (e: any) {
      setErrorMsg(`JSON 解析失败: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                导入租房规划 JSON 数据
              </h3>
              <p className="text-[11px] text-slate-500">
                导入他人分享的租房规划或恢复历史备份文件
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              上传 .json 文件
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>

          <div className="text-center text-slate-400 text-[11px]">- 或者直接粘贴 JSON 文本 -</div>

          <div>
            <textarea
              rows={8}
              placeholder="在此粘贴包含 budget, candidates, weights 的完整 JSON 数据..."
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setErrorMsg('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-[11px]"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            确认导入此方案
          </button>
        </div>
      </div>
    </div>
  );
};
