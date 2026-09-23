import React, { useState } from 'react';
import { RentalPlan, MovingTask, HandoverRecord } from '../types/rental';
import {
  Clock,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { getCountdownDiff } from '../utils/countdownUtils';

interface TimelineModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  focusMode?: boolean;
  theme?: 'light' | 'dark';
}

export const TimelineModule: React.FC<TimelineModuleProps> = ({
  plan,
  onUpdatePlan,
  focusMode,
  theme = 'light',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'moving' | 'inspection' | 'contract'>('moving');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [targetDateInput, setTargetDateInput] = useState(plan.targetDate || '');
  const isDark = theme === 'dark';

  // Track passed inspection items locally if not tied to a single candidate
  const [passedInspectionItems, setPassedInspectionItems] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (plan.candidates && plan.candidates.length > 0) {
      Object.assign(initial, plan.candidates[0].checklistResults || {});
    }
    return initial;
  });

  const countdown = getCountdownDiff(plan.targetDate);

  // Update target date
  const handleUpdateTargetDate = (newDate: string) => {
    setTargetDateInput(newDate);
    onUpdatePlan({
      ...plan,
      targetDate: newDate,
      updatedAt: new Date().toISOString(),
    });
  };

  // Toggle task completed
  const handleToggleTask = (taskId: string) => {
    const updated = (plan.movingTasks || []).map((t: MovingTask) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    onUpdatePlan({
      ...plan,
      movingTasks: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Add custom task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: MovingTask = {
      id: `task_${Date.now()}`,
      title: newTaskTitle.trim(),
      stage: 'custom',
      completed: false,
    };

    onUpdatePlan({
      ...plan,
      movingTasks: [...(plan.movingTasks || []), newTask],
      updatedAt: new Date().toISOString(),
    });

    setNewTaskTitle('');
  };

  // Delete task
  const handleDeleteTask = (taskId: string) => {
    onUpdatePlan({
      ...plan,
      movingTasks: (plan.movingTasks || []).filter((t: MovingTask) => t.id !== taskId),
      updatedAt: new Date().toISOString(),
    });
  };

  // Toggle inspection item
  const handleToggleInspection = (itemId: string) => {
    const nextState = !passedInspectionItems[itemId];
    const updated = {
      ...passedInspectionItems,
      [itemId]: nextState,
    };
    setPassedInspectionItems(updated);

    // If there is an active/first candidate, save to it
    if (plan.candidates && plan.candidates.length > 0) {
      const updatedCandidates = [...plan.candidates];
      updatedCandidates[0] = {
        ...updatedCandidates[0],
        checklistResults: updated,
      };
      onUpdatePlan({
        ...plan,
        candidates: updatedCandidates,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Update handover readings
  const handleUpdateMeter = (field: keyof HandoverRecord, val: string | number) => {
    onUpdatePlan({
      ...plan,
      handoverRecord: {
        ...plan.handoverRecord,
        [field]: val,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  // Theme styling helpers
  const cardBg = isDark
    ? 'bg-neutral-900/40 border-neutral-800/90 text-neutral-200'
    : 'bg-white border-neutral-200/90 text-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]';
  const headerBorder = isDark ? 'border-neutral-800' : 'border-neutral-200/80';
  const headerTitle = isDark ? 'text-neutral-300' : 'text-neutral-900';
  const labelColor = isDark ? 'text-neutral-400' : 'text-neutral-600';
  const inputBg = isDark
    ? 'bg-neutral-900/60 border-neutral-800 focus:border-neutral-500 focus:bg-neutral-900 text-neutral-200'
    : 'bg-white border-neutral-200 focus:border-neutral-400 focus:bg-white text-neutral-900 focus:ring-1 focus:ring-neutral-200 shadow-2xs';

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* Title Section */}
      <div className="pt-2 pb-1">
        <h1
          className={`font-editorial italic text-3xl sm:text-4xl tracking-tight font-normal ${
            isDark ? 'text-neutral-100' : 'text-neutral-950'
          }`}
        >
          时间计划
        </h1>
        <p
          className={`font-mono-code text-[11px] sm:text-xs tracking-[0.22em] uppercase mt-1.5 ${
            isDark ? 'text-neutral-500' : 'text-neutral-500'
          }`}
        >
          COUNTDOWN, STAGE MILESTONES & SITE INSPECTION CHECKLIST
        </p>
      </div>

      {/* Countdown Card (Hero Milestone) */}
      <div className={`p-6 rounded-lg border ${cardBg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              <span className={`text-xs font-semibold ${headerTitle}`}>目标入住日倒计时</span>
              <span className="font-mono-code text-[11px] text-neutral-400">// COUNTDOWN</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span
                className={`font-mono-code text-4xl sm:text-5xl font-bold tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-950'
                }`}
              >
                {countdown.diffDays >= 0 ? countdown.diffDays : 0}
              </span>
              <span className="text-sm font-mono-code text-neutral-400">DAYS REMAINING 天</span>
            </div>

            <div className="text-xs text-neutral-500">
              {countdown.isPast
                ? '已到达或超过目标入住日期，请抓紧办理入住交接手续。'
                : `预计于 ${plan.targetDate} 前完成签约、验房与搬家全流程。`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${labelColor}`}>目标日期:</label>
            <input
              type="date"
              value={targetDateInput}
              onChange={(e) => handleUpdateTargetDate(e.target.value)}
              className={`rounded px-3 py-1.5 text-xs font-mono-code outline-none border ${
                isDark
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Sub-Tabs: 01 // 搬家任务, 02 // 验房清单, 03 // 租约交接 */}
      <div className={`flex items-center border-b ${headerBorder}`}>
        {[
          { id: 'moving', num: '01', label: '搬家日程任务' },
          { id: 'inspection', num: '02', label: '实地看房查验清单' },
          { id: 'contract', num: '03', label: '租约避坑与抄表交接' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-mono-code text-xs transition-colors border-b-2 -mb-px ${
                isActive
                  ? isDark
                    ? 'border-rose-500 text-neutral-100 font-semibold'
                    : 'border-rose-600 text-neutral-950 font-semibold bg-neutral-100/40'
                  : isDark
                  ? 'border-transparent text-neutral-500 hover:text-neutral-300'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span className={isActive ? 'text-rose-500' : 'text-neutral-400'}>
                {tab.num} //
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* View 1: Moving Tasks */}
      {activeSubTab === 'moving' && (
        <div className="space-y-6">
          {/* Add custom task bar */}
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="添加自建待办事项，如：购买宽带路由器、预约搬家货车..."
              className={`flex-1 rounded px-3 py-2 text-xs font-mono-code outline-none border ${inputBg}`}
            />
            <button
              type="submit"
              className={`flex items-center gap-1 px-4 py-2 rounded text-xs font-mono-code font-semibold transition-colors shadow-xs ${
                isDark
                  ? 'bg-neutral-100 text-neutral-900 hover:bg-white'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加任务</span>
            </button>
          </form>

          {/* Task list */}
          <div className="space-y-2">
            {(plan.movingTasks || []).map((task: MovingTask) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-3.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                  task.completed
                    ? isDark
                      ? 'bg-neutral-900/30 border-neutral-850/60 text-neutral-500'
                      : 'bg-neutral-50/60 border-neutral-200/60 text-neutral-400'
                    : isDark
                    ? 'bg-neutral-900/40 border-neutral-800/90 text-neutral-200 hover:border-neutral-700'
                    : 'bg-white border-neutral-200/90 text-neutral-800 hover:border-neutral-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : isDark
                        ? 'border-neutral-700 bg-neutral-900'
                        : 'border-neutral-300 bg-white'
                    }`}
                  >
                    {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className={`text-xs ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono-code text-[10px] uppercase px-2 py-0.5 rounded border ${
                      isDark
                        ? 'text-neutral-500 bg-neutral-900 border-neutral-800'
                        : 'text-neutral-500 bg-neutral-100 border-neutral-200'
                    }`}
                  >
                    {task.stage}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="text-neutral-400 hover:text-rose-500 p-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Inspection Checklist */}
      {activeSubTab === 'inspection' && (
        <div className="space-y-6">
          <div className={`flex items-center justify-between border-b pb-2 ${headerBorder}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${headerTitle}`}>实地看房查验清单</span>
              <span className="font-mono-code text-[11px] text-neutral-400">// INSPECTION ITEMS</span>
            </div>
            {!focusMode && (
              <span className="text-[11px] text-neutral-400">点击项目即可标记查验通过</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plan.inspectionCategories.map((cat) => (
              <div
                key={cat.id}
                className={`p-5 rounded-lg space-y-4 border ${cardBg}`}
              >
                <div className={`flex items-center justify-between border-b pb-2.5 ${headerBorder}`}>
                  <span
                    className={`text-xs font-semibold ${
                      isDark ? 'text-neutral-200' : 'text-neutral-900'
                    }`}
                  >
                    {cat.name}
                  </span>
                  <span className="font-mono-code text-[10px] text-neutral-400">
                    {cat.items.filter((i) => passedInspectionItems[i.id]).length} / {cat.items.length} 通过
                  </span>
                </div>

                <div className="space-y-2">
                  {cat.items.map((item) => {
                    const isPassed = !!passedInspectionItems[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleInspection(item.id)}
                        className={`p-2.5 rounded border cursor-pointer transition-all flex items-start gap-2.5 ${
                          isPassed
                            ? isDark
                              ? 'bg-emerald-950/20 border-emerald-900/40 text-neutral-300'
                              : 'bg-emerald-50/60 border-emerald-300 text-neutral-900 font-medium'
                            : isDark
                            ? 'bg-neutral-900/30 border-neutral-800/60 hover:border-neutral-700 text-neutral-400'
                            : 'bg-neutral-50/40 border-neutral-200/80 hover:border-neutral-300 text-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isPassed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : isDark
                              ? 'border-neutral-700 bg-neutral-900'
                              : 'border-neutral-300 bg-white'
                          }`}
                        >
                          {isPassed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">{item.title}</div>
                          {item.detail && (
                            <div className="text-[10px] text-neutral-400 mt-0.5">{item.detail}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 3: Contract Check & Meter Handover */}
      {activeSubTab === 'contract' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contract check tips */}
            <div className={`p-5 rounded-lg space-y-4 border ${cardBg}`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${headerBorder}`}>
                <span className={`text-xs font-semibold ${headerTitle}`}>租房合同核心避坑准则</span>
                <span className="font-mono-code text-[11px] text-neutral-400">// CONTRACT RULES</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {[
                  '1. 必须查验房东身份证原件与房产证原件，名字需完全一致（二房东需查验原始租赁合同与转租授权书）。',
                  '2. 明确退租押金返还时间与条件（建议写入：退房当日经双方结清物业水电后 3 个工作日内无息原路返还）。',
                  '3. 家电维修责任划分（写入：非人为损坏由房东负责维修更换，费用由出租方承担）。',
                  '4. 明确水电燃气收费标准（民用水电按国家电网/水务账单实缴，避免被加价 1.5元/度电）。',
                  '5. 租期内不得单方面提前解约或无故涨租（违约金一般约定为 1 个月房租）。',
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border leading-relaxed ${
                      isDark
                        ? 'bg-neutral-900/30 border-neutral-800/80 text-neutral-300'
                        : 'bg-neutral-50/60 border-neutral-200/80 text-neutral-800'
                    }`}
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            {/* Meter handover record */}
            <div className={`p-5 rounded-lg space-y-4 border ${cardBg}`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${headerBorder}`}>
                <span className={`text-xs font-semibold ${headerTitle}`}>入住水电气底数与钥匙交接</span>
                <span className="font-mono-code text-[11px] text-neutral-400">// METER READINGS</span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className={`block font-medium ${labelColor}`}>电表底数 (度)</label>
                  <input
                    type="text"
                    value={plan.handoverRecord.electricMeter || ''}
                    onChange={(e) => handleUpdateMeter('electricMeter', e.target.value)}
                    placeholder="如：1452.8"
                    className={`w-full rounded px-3 py-2 font-mono-code outline-none border ${inputBg}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`block font-medium ${labelColor}`}>水表底数 (吨)</label>
                  <input
                    type="text"
                    value={plan.handoverRecord.waterMeter || ''}
                    onChange={(e) => handleUpdateMeter('waterMeter', e.target.value)}
                    placeholder="如：238.5"
                    className={`w-full rounded px-3 py-2 font-mono-code outline-none border ${inputBg}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`block font-medium ${labelColor}`}>燃气底数 / 其他备注</label>
                  <input
                    type="text"
                    value={plan.handoverRecord.remarks || ''}
                    onChange={(e) => handleUpdateMeter('remarks', e.target.value)}
                    placeholder="如：钥匙2把、门禁卡1张、空调遥控器完好"
                    className={`w-full rounded px-3 py-2 font-mono-code outline-none border ${inputBg}`}
                  />
                </div>

                {!focusMode && (
                  <div
                    className={`pt-3 text-[11px] leading-relaxed border-t ${
                      isDark ? 'text-neutral-500 border-neutral-800/60' : 'text-neutral-500 border-neutral-200/60'
                    }`}
                  >
                    入住当天务必拍清所有表盘清晰特写，并与房东微信确认文字记录，防止搬走时承担上一任租客欠费。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
