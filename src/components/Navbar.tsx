import React, { useState } from 'react';
import { RentalPlan, PlanStatus } from '../types/rental';
import {
  ChevronDown,
  Plus,
  Layers,
  Check,
  Sun,
  Moon,
} from 'lucide-react';

export type NavTabKey = 'budget' | 'commute' | 'matrix' | 'timeline';

interface NavbarProps {
  plans: RentalPlan[];
  activePlan: RentalPlan;
  currentTab: NavTabKey;
  focusMode: boolean;
  theme: 'light' | 'dark';
  onToggleFocusMode: () => void;
  onToggleTheme: () => void;
  onSelectTab: (tab: NavTabKey) => void;
  onSelectPlan: (id: string) => void;
  onNewPlan: () => void;
  onOpenTemplates: () => void;
  onSaveAsTemplate: () => void;
  onExport: () => void;
  onImport: () => void;
  onDuplicatePlan: (id: string) => void;
  onDeletePlan: (id: string) => void;
  onUpdateStatus: (status: PlanStatus) => void;
}

const TABS: { id: NavTabKey; num: string; label: string }[] = [
  { id: 'budget', num: '01', label: '预算测算' },
  { id: 'commute', num: '02', label: '通勤对比' },
  { id: 'matrix', num: '03', label: '房源对比' },
  { id: 'timeline', num: '04', label: '时间计划' },
];

export const Navbar: React.FC<NavbarProps> = ({
  plans,
  activePlan,
  currentTab,
  focusMode,
  theme,
  onToggleFocusMode,
  onToggleTheme,
  onSelectTab,
  onSelectPlan,
  onNewPlan,
  onOpenTemplates,
  onSaveAsTemplate,
  onExport,
  onImport,
  onDuplicatePlan,
  onDeletePlan,
  onUpdateStatus,
}) => {
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const isDark = theme === 'dark';

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-md transition-colors border-b ${
        isDark
          ? 'bg-[#0d0f12]/95 border-neutral-800'
          : 'bg-white/95 border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Left: Glowing Dot + Tabs */}
        <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
          {/* Glowing indicator dot & Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                isDark
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`}
            />
            <span
              className={`font-mono-code text-xs font-bold tracking-widest hidden md:inline transition-colors ${
                isDark ? 'text-neutral-200' : 'text-neutral-900'
              }`}
            >
              RENTCRAFT
            </span>
          </div>

          {/* Navigation Tabs (01 // 预算测算, 02 // 通勤对比...) */}
          <nav className="flex items-center">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 sm:px-4 h-14 font-mono-code text-xs transition-all whitespace-nowrap ${
                    isActive
                      ? isDark
                        ? 'text-neutral-100 font-semibold border-b-2 border-rose-500 bg-neutral-900/30'
                        : 'text-neutral-950 font-semibold border-b-2 border-rose-600 bg-neutral-100/50'
                      : isDark
                      ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/20'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/40'
                  }`}
                >
                  <span
                    className={
                      isActive
                        ? isDark
                          ? 'text-neutral-300'
                          : 'text-neutral-800'
                        : isDark
                        ? 'text-neutral-600'
                        : 'text-neutral-400'
                    }
                  >
                    {tab.num} //
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Theme Toggle, Focus Switch, Plan Selector & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Theme Switcher (Bright / Dark) */}
          <button
            onClick={onToggleTheme}
            title={isDark ? '切换至亮色模式' : '切换至暗色模式'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-mono-code transition-all border cursor-pointer ${
              isDark
                ? 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
            }`}
          >
            {isDark ? (
              <>
                <Moon className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline text-[11px]">暗色</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline text-[11px]">亮色</span>
              </>
            )}
          </button>

          {/* Focus Mode Switcher */}
          <button
            onClick={onToggleFocusMode}
            title={
              focusMode
                ? '专注模式：已开启（隐藏提示与说明，仅显示核心KPI与关键操作）'
                : '开启专注模式（隐藏边栏提示与说明文字，进入极简界面）'
            }
            aria-pressed={focusMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono-code transition-all border cursor-pointer ${
              focusMode
                ? isDark
                  ? 'bg-rose-950/40 border-rose-500/60 text-rose-300 ring-1 ring-rose-500/30'
                  : 'bg-rose-50 border-rose-300 text-rose-700 ring-1 ring-rose-200 shadow-2xs'
                : isDark
                ? 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 shadow-2xs'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                focusMode
                  ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                  : isDark
                  ? 'bg-neutral-600'
                  : 'bg-neutral-400'
              }`}
            />
            <span className="hidden xs:inline sm:inline">专注</span>
            <span
              className={`text-[10px] font-mono tracking-wider ${
                focusMode
                  ? isDark
                    ? 'text-rose-400 font-bold'
                    : 'text-rose-600 font-bold'
                  : isDark
                  ? 'text-neutral-600'
                  : 'text-neutral-400'
              }`}
            >
              {focusMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Plan Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setPlanDropdownOpen(!planDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono-code transition-colors border ${
                isDark
                  ? 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                  : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800 shadow-2xs'
              }`}
            >
              <span className="max-w-[100px] sm:max-w-[140px] truncate">{activePlan.name}</span>
              <ChevronDown
                className={`w-3 h-3 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}
              />
            </button>

            {planDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPlanDropdownOpen(false)}
                />
                <div
                  className={`absolute right-0 top-full mt-1.5 w-64 rounded-lg shadow-2xl py-1.5 z-50 text-xs border ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
                      : 'bg-white border-neutral-200 text-neutral-800'
                  }`}
                >
                  <div
                    className={`px-3 py-1 text-[10px] font-mono-code uppercase tracking-wider border-b ${
                      isDark
                        ? 'text-neutral-500 border-neutral-800'
                        : 'text-neutral-400 border-neutral-100'
                    }`}
                  >
                    我的规划方案 ({plans.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectPlan(p.id);
                          setPlanDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                          p.id === activePlan.id
                            ? isDark
                              ? 'text-neutral-100 font-semibold bg-neutral-800/50'
                              : 'text-neutral-950 font-semibold bg-neutral-50'
                            : isDark
                            ? 'text-neutral-400 hover:bg-neutral-800'
                            : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="truncate pr-2">{p.name}</span>
                        {p.id === activePlan.id && (
                          <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`border-t pt-1 mt-1 px-1 ${
                      isDark ? 'border-neutral-800' : 'border-neutral-100'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setPlanDropdownOpen(false);
                        onNewPlan();
                      }}
                      className={`w-full px-2.5 py-1.5 text-left rounded flex items-center gap-1.5 ${
                        isDark
                          ? 'hover:bg-neutral-800 text-neutral-300'
                          : 'hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新建方案</span>
                    </button>
                    <button
                      onClick={() => {
                        setPlanDropdownOpen(false);
                        onOpenTemplates();
                      }}
                      className={`w-full px-2.5 py-1.5 text-left rounded flex items-center gap-1.5 ${
                        isDark
                          ? 'hover:bg-neutral-800 text-neutral-300'
                          : 'hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>预设方案库</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <button
            onClick={onOpenTemplates}
            className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono-code transition-colors ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>模板库</span>
          </button>

          <button
            onClick={onExport}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono-code transition-colors ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>导出</span>
          </button>
        </div>
      </div>
    </header>
  );
};
