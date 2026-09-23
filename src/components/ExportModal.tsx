import React, { useState } from 'react';
import { RentalPlan } from '../types/rental';
import { exportPlanToMarkdown } from '../utils/storage';
import {
  Share2,
  Copy,
  Download,
  Printer,
  Check,
  X,
  FileCode,
  FileText,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: RentalPlan;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, plan }) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const markdownContent = exportPlanToMarkdown(plan);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.name || '租房规划报告'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(plan, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.name || '租房规划备份'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                导出租房规划报告与数据备份
              </h3>
              <p className="text-[11px] text-slate-500">
                支持生成 Markdown 报告、保存为本地备份 JSON，或直接打印携带看房
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>复制 Markdown 内容</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>下载 .md 文档</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              <span>下载 JSON 数据备份</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>打印 / 保存为 PDF</span>
          </button>
        </div>

        {/* Preview Container */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <pre className="text-[11px] leading-relaxed font-mono bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap select-all">
            {markdownContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
