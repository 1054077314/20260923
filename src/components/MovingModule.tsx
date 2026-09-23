import React, { useState } from 'react';
import { RentalPlan, MovingTask, MovingStage } from '../types/rental';
import {
  computeTaskDueDate,
  getCountdownDiff,
  getStageOffset,
  addDays,
  getTodayDateString,
  PRESET_MILESTONES,
} from '../utils/countdownUtils';
import {
  Truck,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Package,
  Sparkles,
  CheckSquare,
  Square,
  Droplets,
  Lock,
  Wind,
  Clock,
  Star,
  ChevronRight,
  Edit3,
} from 'lucide-react';

interface MovingModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
}

const STAGE_LABELS: Record<string, string> = {
  'T-14': 'T-14 规划期',
  'T-7': 'T-7 倒计时',
  'T-3': 'T-3 筹备期',
  'T-1': 'T-1 前夕',
  'D-Day': 'D-Day 搬迁日',
  'D+1': 'D+1 安顿期',
  'D+3': 'D+3 归整期',
};

const SURVIVAL_GEARS = [
  {
    name: '除氯增压过滤花洒',
    icon: <Droplets className="w-4 h-4 text-sky-500" />,
    desc: '老旧小区水管常有铁锈水垢，安装过滤花洒能有效预防掉发和皮肤过敏。',
  },
  {
    name: '免打孔便携防盗阻门器',
    icon: <Lock className="w-4 h-4 text-emerald-500" />,
    desc: '女生或独居人士必备，晚上在门后顶住，即使有钥匙在门外也绝不可能推开。',
  },
  {
    name: '除甲醛光触媒喷雾 / 活性炭包',
    icon: <Wind className="w-4 h-4 text-indigo-500" />,
    desc: '搬入新家后放入衣柜和抽屉，配合日间开窗对流，快速净化封闭死角气味。',
  },
  {
    name: '真空被褥压缩袋 + 电动抽气泵',
    icon: <Package className="w-4 h-4 text-amber-500" />,
    desc: '厚被子和大羽绒服压缩后体积缩小75%，一辆面包车即可装下全部家当。',
  },
];

export const MovingModule: React.FC<MovingModuleProps> = ({ plan, onUpdatePlan }) => {
  const [activeSubTab, setActiveSubTab] = useState<'milestones' | 'all' | 'gear'>('milestones');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newStage, setNewStage] = useState<MovingStage>('T-3');
  const [newIsMilestone, setNewIsMilestone] = useState(true);
  const [newTips, setNewTips] = useState('');

  // Editing base target move-in date
  const [editingTargetDate, setEditingTargetDate] = useState(false);
  const [tempTargetDate, setTempTargetDate] = useState(plan.targetDate || '');

  const todayStr = getTodayDateString();
  const moveInCountdown = getCountdownDiff(plan.targetDate);

  const handleToggleTask = (id: string) => {
    const updated = plan.movingTasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    onUpdatePlan({ ...plan, movingTasks: updated, updatedAt: new Date().toISOString() });
  };

  const handleToggleMilestone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = plan.movingTasks.map((t) =>
      t.id === id ? { ...t, isMilestone: !t.isMilestone } : t
    );
    onUpdatePlan({ ...plan, movingTasks: updated, updatedAt: new Date().toISOString() });
  };

  const handleDeleteTask = (id: string) => {
    onUpdatePlan({
      ...plan,
      movingTasks: plan.movingTasks.filter((t) => t.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSaveTargetDate = () => {
    onUpdatePlan({
      ...plan,
      targetDate: tempTargetDate,
      updatedAt: new Date().toISOString(),
    });
    setEditingTargetDate(false);
  };

  const handleQuickAddPreset = (preset: (typeof PRESET_MILESTONES)[0]) => {
    const newTask: MovingTask = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: preset.title,
      stage: preset.stage,
      offsetDays: preset.offsetDays,
      category: preset.category,
      tips: preset.tips,
      isMilestone: true,
      completed: false,
    };

    onUpdatePlan({
      ...plan,
      movingTasks: [newTask, ...plan.movingTasks],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;

    const offset = getStageOffset(newStage);
    const newTask: MovingTask = {
      id: `mov-${Date.now()}`,
      title: newTitle.trim(),
      stage: newStage,
      offsetDays: offset,
      tips: newTips.trim() || undefined,
      isMilestone: newIsMilestone,
      completed: false,
    };

    onUpdatePlan({
      ...plan,
      movingTasks: [...plan.movingTasks, newTask],
      updatedAt: new Date().toISOString(),
    });

    setNewTitle('');
    setNewTips('');
    setShowAddModal(false);
  };

  const completedCount = plan.movingTasks.filter((t) => t.completed).length;
  const totalCount = plan.movingTasks.length;

  const milestoneTasks = plan.movingTasks
    .filter((t) => t.isMilestone)
    .map((task) => {
      const computedDate = computeTaskDueDate(plan.targetDate, task);
      const countdown = getCountdownDiff(computedDate, task.completed);
      return { task, computedDate, countdown };
    })
    .sort((a, b) => (a.computedDate || '9999').localeCompare(b.computedDate || '9999'));

  const completedMilestones = milestoneTasks.filter((m) => m.task.completed).length;

  const filteredTasks =
    selectedStage === 'all'
      ? plan.movingTasks
      : plan.movingTasks.filter((t) => t.stage === selectedStage);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* 1. Clean Calm Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              阶段五：搬家倒计时与入住安顿
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>入住日: {plan.targetDate || '未设置'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-indigo-600">{moveInCountdown.label}</span>
              <button
                onClick={() => {
                  setTempTargetDate(plan.targetDate || todayStr);
                  setEditingTargetDate(true);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-700 underline ml-1"
              >
                修改日期
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加待办/节点</span>
            </button>
          </div>
        </div>

        {/* Date modification pop */}
        {editingTargetDate && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2.5 text-xs">
            <span className="text-slate-600 font-medium">设置入住日：</span>
            <input
              type="date"
              value={tempTargetDate}
              onChange={(e) => setTempTargetDate(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              onClick={() => setTempTargetDate(addDays(todayStr, 7))}
              className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[11px]"
            >
              +7天
            </button>
            <button
              onClick={() => setTempTargetDate(addDays(todayStr, 15))}
              className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[11px]"
            >
              +15天
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleSaveTargetDate}
                className="px-3 py-1 bg-slate-900 text-white rounded font-medium"
              >
                确认
              </button>
              <button
                onClick={() => setEditingTargetDate(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-800"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Quiet Sub-Navigation Tabs */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setActiveSubTab('milestones')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'milestones'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              重要节点 ({completedMilestones}/{milestoneTasks.length})
            </button>
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全阶段清单 ({completedCount}/{totalCount})
            </button>
            <button
              onClick={() => setActiveSubTab('gear')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'gear'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              必备装备 (4)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab 1: Focus on Key Milestones */}
      {activeSubTab === 'milestones' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                关键倒计时节点
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                自动根据入住日期推算倒计时，并同步在规划总览时间线展示。
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400">快捷添加:</span>
              {PRESET_MILESTONES.slice(0, 3).map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => handleQuickAddPreset(preset)}
                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-600 transition-colors"
                >
                  + {preset.title.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {milestoneTasks.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              暂未设置重要节点，点击上方快捷添加【预约搬家】、【退房清理】、【更换门锁】。
            </div>
          ) : (
            <div className="space-y-2">
              {milestoneTasks.map(({ task, computedDate, countdown }) => (
                <div
                  key={task.id}
                  onClick={() => handleToggleTask(task.id)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    task.completed
                      ? 'bg-slate-50/70 border-slate-200 opacity-70'
                      : countdown.urgency === 'critical'
                      ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {task.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-500 font-mono">
                          {task.stage} {computedDate ? `· ${computedDate}` : ''}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.tips && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          💡 {task.tips}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        task.completed
                          ? 'text-emerald-700 bg-emerald-50'
                          : countdown.urgency === 'critical'
                          ? 'text-rose-700 bg-rose-50 font-bold'
                          : 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      {task.completed ? '已达成' : countdown.label}
                    </span>

                    <button
                      onClick={(e) => handleToggleMilestone(task.id, e)}
                      className="p-1 text-amber-500 hover:text-slate-300"
                      title="取消标星"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.id);
                      }}
                      className="p-1 text-slate-300 hover:text-rose-600"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Sub-Tab 2: Full Categorized Checklist */}
      {activeSubTab === 'all' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          {/* Stage Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 pb-2 border-b border-slate-100 text-xs">
            <button
              onClick={() => setSelectedStage('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                selectedStage === 'all'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100'
              }`}
            >
              全部 ({totalCount})
            </button>
            {Object.keys(STAGE_LABELS).map((stage) => {
              const count = plan.movingTasks.filter((t) => t.stage === stage).length;
              return (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(stage)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedStage === stage
                      ? 'bg-slate-900 text-white font-medium'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  {STAGE_LABELS[stage]} ({count})
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs ${
                  task.completed
                    ? 'bg-slate-50/70 border-slate-100 opacity-60'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{task.stage}</span>
                  <span
                    className={`truncate ${
                      task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleToggleMilestone(task.id, e)}
                    className="p-1 text-slate-300 hover:text-amber-500"
                    title={task.isMilestone ? '移出里程碑' : '标为里程碑'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        task.isMilestone ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="p-1 text-slate-300 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Sub-Tab 3: Practical Gear */}
      {activeSubTab === 'gear' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SURVIVAL_GEARS.map((gear) => (
            <div
              key={gear.name}
              className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-1.5 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-800">
                {gear.icon}
                <span>{gear.name}</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">{gear.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-slate-900 text-sm">
              <span>添加搬家事项</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">事项名称 *</label>
                <input
                  type="text"
                  placeholder="例：提前预约搬家公司、退房清理、更换门锁"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">阶段</label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value as MovingStage)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                >
                  {Object.keys(STAGE_LABELS).map((st) => (
                    <option key={st} value={st}>
                      {STAGE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">备忘贴士 (选填)</label>
                <input
                  type="text"
                  placeholder="例：确认超重费与搬楼费"
                  value={newTips}
                  onChange={(e) => setNewTips(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-700 font-medium">设为重要里程碑节点</span>
                <input
                  type="checkbox"
                  checked={newIsMilestone}
                  onChange={(e) => setNewIsMilestone(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleCreateTask}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
