import React, { useState, useEffect } from 'react';
import {
  RentalPlan,
  PlanTemplate,
  PlanStatus,
} from './types/rental';
import {
  getStoredPlans,
  saveAllPlans,
  getActivePlanId,
  setActivePlanId,
  saveCustomTemplate,
  deleteCustomTemplate,
} from './utils/storage';
import { PRESET_TEMPLATES } from './data/defaultTemplates';
import { Navbar, NavTabKey } from './components/Navbar';
import { BudgetModule } from './components/BudgetModule';
import { CommuteModule } from './components/CommuteModule';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { TimelineModule } from './components/TimelineModule';
import { TemplateLibraryModal } from './components/TemplateLibraryModal';
import { SaveAsTemplateModal } from './components/SaveAsTemplateModal';
import { NewPlanModal } from './components/NewPlanModal';
import { ExportModal } from './components/ExportModal';
import { ImportModal } from './components/ImportModal';

export default function App() {
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [activePlanId, setActiveId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<NavTabKey>('budget');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      localStorage.setItem('rentcraft_theme', 'light');
    } catch {}
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('rentcraft_theme', next);
      } catch {}
      return next;
    });
  };

  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rentcraft_focus_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleFocusMode = () => {
    setFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rentcraft_focus_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Modals state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [newPlanModalOpen, setNewPlanModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    const loadedPlans = getStoredPlans();
    setPlans(loadedPlans);
    const initialActiveId = getActivePlanId();
    if (loadedPlans.some((p) => p.id === initialActiveId)) {
      setActiveId(initialActiveId);
    } else if (loadedPlans.length > 0) {
      setActiveId(loadedPlans[0].id);
      setActivePlanId(loadedPlans[0].id);
    }
  }, []);

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  const handleUpdateActivePlan = (updatedPlan: RentalPlan) => {
    const updatedPlans = plans.map((p) => (p.id === updatedPlan.id ? updatedPlan : p));
    setPlans(updatedPlans);
    saveAllPlans(updatedPlans);
  };

  const handleSelectPlan = (id: string) => {
    setActiveId(id);
    setActivePlanId(id);
  };

  const handleDuplicatePlan = (id: string) => {
    const source = plans.find((p) => p.id === id);
    if (!source) return;
    const duplicated: RentalPlan = {
      ...source,
      id: `plan-${Date.now()}`,
      name: `${source.name} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextPlans = [duplicated, ...plans];
    setPlans(nextPlans);
    saveAllPlans(nextPlans);
    handleSelectPlan(duplicated.id);
  };

  const handleDeletePlan = (id: string) => {
    if (plans.length <= 1) {
      alert('至少保留一个租房规划方案。');
      return;
    }
    const nextPlans = plans.filter((p) => p.id !== id);
    setPlans(nextPlans);
    saveAllPlans(nextPlans);
    if (activePlanId === id) {
      handleSelectPlan(nextPlans[0].id);
    }
  };

  const handleCreatePlan = (
    name: string,
    city: string,
    targetDate: string,
    templateId?: string
  ) => {
    const matchedTemplate =
      PRESET_TEMPLATES.find((t) => t.id === templateId) || PRESET_TEMPLATES[0];

    const now = new Date().toISOString();
    const newPlan: RentalPlan = {
      ...matchedTemplate.defaultData,
      id: `plan-${Date.now()}`,
      name,
      city: city || matchedTemplate.defaultData.city,
      targetDate: targetDate || matchedTemplate.defaultData.targetDate,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    };

    const nextPlans = [newPlan, ...plans];
    setPlans(nextPlans);
    saveAllPlans(nextPlans);
    handleSelectPlan(newPlan.id);
    setCurrentTab('budget');
  };

  const handleApplyTemplate = (template: PlanTemplate) => {
    const now = new Date().toISOString();
    const newPlan: RentalPlan = {
      ...template.defaultData,
      id: `plan-${Date.now()}`,
      name: `${template.name} (应用方案)`,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    };
    const nextPlans = [newPlan, ...plans];
    setPlans(nextPlans);
    saveAllPlans(nextPlans);
    handleSelectPlan(newPlan.id);
    setCurrentTab('budget');
  };

  const handleUpdateStatus = (status: PlanStatus) => {
    if (!activePlan) return;
    handleUpdateActivePlan({
      ...activePlan,
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!activePlan) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center p-4">
        <div className="text-center text-neutral-500 font-mono-code text-xs">
          LOADING RENTAL PLAN...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-[#0c0e12] bg-carbon text-neutral-200 selection:bg-rose-950 selection:text-rose-200'
          : 'bg-white text-neutral-900 selection:bg-rose-100 selection:text-rose-900'
      }`}
    >
      {/* Top Navbar with 4 Numbered Tabs */}
      <Navbar
        plans={plans}
        activePlan={activePlan}
        currentTab={currentTab}
        focusMode={focusMode}
        onToggleFocusMode={handleToggleFocusMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSelectTab={setCurrentTab}
        onSelectPlan={handleSelectPlan}
        onNewPlan={() => setNewPlanModalOpen(true)}
        onOpenTemplates={() => setTemplateModalOpen(true)}
        onSaveAsTemplate={() => setSaveTemplateModalOpen(true)}
        onExport={() => setExportModalOpen(true)}
        onImport={() => setImportModalOpen(true)}
        onDuplicatePlan={handleDuplicatePlan}
        onDeletePlan={handleDeletePlan}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Tab 01: 预算测算 */}
        {currentTab === 'budget' && (
          <BudgetModule
            plan={activePlan}
            onUpdatePlan={handleUpdateActivePlan}
            focusMode={focusMode}
            theme={theme}
          />
        )}

        {/* Tab 02: 通勤对比 */}
        {currentTab === 'commute' && (
          <CommuteModule
            plan={activePlan}
            onUpdatePlan={handleUpdateActivePlan}
            onNavigateToMatrix={() => setCurrentTab('matrix')}
            focusMode={focusMode}
            theme={theme}
          />
        )}

        {/* Tab 03: 房源对比 */}
        {currentTab === 'matrix' && (
          <ComparisonMatrix
            plan={activePlan}
            onUpdatePlan={handleUpdateActivePlan}
            onSelectCandidateForInspection={() => setCurrentTab('timeline')}
            focusMode={focusMode}
            theme={theme}
          />
        )}

        {/* Tab 04: 时间计划 */}
        {currentTab === 'timeline' && (
          <TimelineModule
            plan={activePlan}
            onUpdatePlan={handleUpdateActivePlan}
            focusMode={focusMode}
            theme={theme}
          />
        )}
      </main>

      {/* Clean Minimalist Footer */}
      <footer
        className={`mt-auto border-t py-4 text-xs font-mono-code transition-colors ${
          theme === 'dark'
            ? 'border-neutral-900 bg-[#0a0c0e] text-neutral-500'
            : 'border-neutral-200 bg-white/90 text-neutral-500 shadow-2xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={
                theme === 'dark' ? 'text-neutral-300 font-semibold' : 'text-neutral-800 font-semibold'
              }
            >
              RENTCRAFT
            </span>
            <span className={theme === 'dark' ? 'text-neutral-700' : 'text-neutral-300'}>//</span>
            <span>租房决策规划引擎</span>
            <span className={theme === 'dark' ? 'text-neutral-700' : 'text-neutral-300'}>·</span>
            <span>自动本地保存</span>
          </div>

          <div
            className={`flex items-center gap-4 ${
              theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
            }`}
          >
            <button
              onClick={() => setTemplateModalOpen(true)}
              className={theme === 'dark' ? 'hover:text-neutral-300 transition-colors' : 'hover:text-neutral-900 transition-colors'}
            >
              预设模板库
            </button>
            <span className={theme === 'dark' ? 'text-neutral-800' : 'text-neutral-300'}>·</span>
            <button
              onClick={() => setSaveTemplateModalOpen(true)}
              className={theme === 'dark' ? 'hover:text-neutral-300 transition-colors' : 'hover:text-neutral-900 transition-colors'}
            >
              存为模板
            </button>
            <span className={theme === 'dark' ? 'text-neutral-800' : 'text-neutral-300'}>·</span>
            <button
              onClick={() => setExportModalOpen(true)}
              className={theme === 'dark' ? 'hover:text-neutral-300 transition-colors' : 'hover:text-neutral-900 transition-colors'}
            >
              导出方案
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <TemplateLibraryModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={handleApplyTemplate}
        onDeleteCustomTemplate={(tid) => deleteCustomTemplate(tid)}
      />

      <SaveAsTemplateModal
        isOpen={saveTemplateModalOpen}
        onClose={() => setSaveTemplateModalOpen(false)}
        plan={activePlan}
        onSaveTemplate={(tmpl) => saveCustomTemplate(tmpl)}
      />

      <NewPlanModal
        isOpen={newPlanModalOpen}
        onClose={() => setNewPlanModalOpen(false)}
        onCreatePlan={handleCreatePlan}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        plan={activePlan}
      />

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportPlan={(importedPlan: RentalPlan) => {
          const nextPlans = [importedPlan, ...plans];
          setPlans(nextPlans);
          saveAllPlans(nextPlans);
          handleSelectPlan(importedPlan.id);
        }}
      />
    </div>
  );
}
