import React, { useState } from 'react';
import { RentalPlan } from '../types/rental';
import { calculateStartupFund, calculateRentBurden } from '../utils/calculations';
import { computeTaskDueDate, getCountdownDiff } from '../utils/countdownUtils';
import {
  Coins,
  TrendingDown,
  Building,
  Calendar,
  Clock,
  ChevronRight,
  Edit3,
  Truck,
  Sparkles,
  Lock,
  ShieldCheck,
  CheckSquare,
  Square,
  ArrowRight,
  Home,
  FileText,
  Receipt,
} from 'lucide-react';

interface PlanOverviewProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  onNavigateSection: (tab: 'hunting' | 'protection' | 'settling', sub?: string) => void;
}

export const PlanOverview: React.FC<PlanOverviewProps> = ({
  plan,
  onUpdatePlan,
  onNavigateSection,
}) => {
  const [editingMeta, setEditingMeta] = useState(false);
  const [tempName, setTempName] = useState(plan.name);
  const [tempCity, setTempCity] = useState(plan.city);
  const [tempDate, setTempDate] = useState(plan.targetDate);

  const startupFund = calculateStartupFund(plan.budget);
  const burden = calculateRentBurden(plan.budget.monthlyIncome, plan.budget.maxMonthlyRent);
  const moveInCountdown = getCountdownDiff(plan.targetDate);

  // Key milestones
  const rawMilestones = plan.movingTasks.filter((t) => t.isMilestone);
  const activeMilestonesList =
    rawMilestones.length > 0
      ? rawMilestones
      : plan.movingTasks.filter(
          (t) =>
            t.title.includes('预约') ||
            t.title.includes('清理') ||
            t.title.includes('门锁') ||
            t.title.includes('退房')
        );

  const timelineMilestones = activeMilestonesList
    .map((task) => {
      const computedDate = computeTaskDueDate(plan.targetDate, task);
      const countdown = getCountdownDiff(computedDate, task.completed);
      return { task, computedDate, countdown };
    })
    .sort((a, b) => (a.computedDate || '9999').localeCompare(b.computedDate || '9999'));

  const completedTimelineCount = timelineMilestones.filter((m) => m.task.completed).length;

  const handleToggleTimelineTask = (taskId: string) => {
    const updated = plan.movingTasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    onUpdatePlan({ ...plan, movingTasks: updated, updatedAt: new Date().toISOString() });
  };

  const handleSaveMeta = () => {
    onUpdatePlan({
      ...plan,
      name: tempName.trim() || '我的租房规划',
      city: tempCity.trim(),
      targetDate: tempDate,
      updatedAt: new Date().toISOString(),
    });
    setEditingMeta(false);
  };

  // Top candidate: prioritize pinned candidate if any, otherwise highest score
  const pinnedCandidate = plan.candidates.find((c) => c.isPinned);
  const sortedCandidates = [...plan.candidates].sort(
    (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
  );
  const topCandidate = pinnedCandidate || (sortedCandidates.length > 0 ? sortedCandidates[0] : null);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. Header Information Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
        {editingMeta ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="规划名称"
              className="px-2.5 py-1.5 font-semibold rounded-lg border border-slate-300 w-48"
            />
            <input
              type="text"
              value={tempCity}
              onChange={(e) => setTempCity(e.target.value)}
              placeholder="目标城市"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 w-28"
            />
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300"
            />
            <button
              onClick={handleSaveMeta}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium"
            >
              保存
            </button>
            <button
              onClick={() => setEditingMeta(false)}
              className="px-2 py-1.5 text-slate-500 hover:text-slate-800"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{plan.name}</h1>
                <button
                  onClick={() => {
                    setTempName(plan.name);
                    setTempCity(plan.city);
                    setTempDate(plan.targetDate);
                    setEditingMeta(true);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title="修改名称/城市/入住日"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span>{plan.city || '未定城市'}</span>
                <span aria-hidden="true">·</span>
                <span>目标入住: {plan.targetDate || '待定'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-indigo-600">{moveInCountdown.label}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              里程碑推进：{completedTimelineCount}/{timelineMilestones.length}
            </div>
          </div>
        )}
      </div>

      {/* 2. Three High-Contrast Core KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => onNavigateSection('hunting', 'budget')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group"
        >
          <div className="text-xs text-slate-500 flex items-center justify-between mb-1">
            <span>启动备用金</span>
            <Coins className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            ¥{startupFund.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            押{plan.budget.depositMonths}付{plan.budget.payMonths} · 杂项储备
          </div>
        </div>

        <div
          onClick={() => onNavigateSection('hunting', 'budget')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group"
        >
          <div className="text-xs text-slate-500 flex items-center justify-between mb-1">
            <span>月租上限及占比</span>
            <TrendingDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>¥{plan.budget.maxMonthlyRent.toLocaleString()}</span>
            <span
              className={`text-xs font-semibold ${
                burden.status === 'healthy' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {burden.ratio}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {burden.status === 'healthy' ? '收入占比合理健康' : '偏高，注意控制'}
          </div>
        </div>

        <div
          onClick={() => onNavigateSection('settling', 'moving')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group"
        >
          <div className="text-xs text-slate-500 flex items-center justify-between mb-1">
            <span>入住倒计时</span>
            <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>{moveInCountdown.label}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {plan.targetDate ? `计划入住日: ${plan.targetDate}` : '未定目标日期'}
          </div>
        </div>
      </div>

      {/* 3. Important Milestones Checklist */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            重要履约倒计时节点
          </h2>
          <button
            onClick={() => onNavigateSection('settling', 'moving')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
          >
            <span>管理节点</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {timelineMilestones.map(({ task, computedDate, countdown }) => {
            const isBooking = task.title.includes('预约') || task.title.includes('搬家');
            const isCleaning = task.title.includes('清理') || task.title.includes('保洁');
            const isSecurity = task.title.includes('门锁') || task.title.includes('阻门器');
            const Icon = isBooking ? Truck : isCleaning ? Sparkles : isSecurity ? Lock : Calendar;

            return (
              <div
                key={task.id}
                onClick={() => handleToggleTimelineTask(task.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  task.completed
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                    <Icon className="w-3 h-3 text-slate-400" />
                    <span>{task.stage}</span>
                    {computedDate && <span>· {computedDate.slice(5)}</span>}
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      task.completed
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-slate-600 bg-slate-100'
                    }`}
                  >
                    {task.completed ? '已达成' : countdown.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="shrink-0">
                    {task.completed ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold truncate ${
                      task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Three Logical Step Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => onNavigateSection('hunting', 'candidates')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group flex flex-col justify-between space-y-2"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Home className="w-4 h-4 text-indigo-600" />
                1. 预算与房源比选
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {plan.candidates.length > 0
                ? `已添加 ${plan.candidates.length} 套候选房源 (首选: ${topCandidate?.community || '待定'})`
                : '测算首期启动资金，录入并对比心仪房源'}
            </p>
          </div>
          <div className="text-xs text-indigo-600 font-medium">进入找房比选 →</div>
        </div>

        <div
          onClick={() => onNavigateSection('protection', 'inspection')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group flex flex-col justify-between space-y-2"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                2. 验房与合同排雷
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              核对水电性质、甲醛隔音实测，审查退押时限与初始底数存证。
            </p>
          </div>
          <div className="text-xs text-emerald-600 font-medium">进入验房签约 →</div>
        </div>

        <div
          onClick={() => onNavigateSection('settling', 'moving')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs group flex flex-col justify-between space-y-2"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" />
                3. 搬迁安顿与账本
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              预约货运搬家、退房保洁、新家门锁安全与月度租金水电记账。
            </p>
          </div>
          <div className="text-xs text-amber-600 font-medium">进入搬家记账 →</div>
        </div>
      </div>
    </div>
  );
};
