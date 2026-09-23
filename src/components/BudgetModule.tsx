import React, { useState } from 'react';
import { RentalPlan, BudgetConfig, RoomType } from '../types/rental';

interface BudgetModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  focusMode?: boolean;
  theme?: 'light' | 'dark';
}

const ROOM_TYPE_OPTIONS: { id: RoomType; label: string }[] = [
  { id: 'single_shared', label: '合租单间 / 城中村小单间 (共卫/实惠)' },
  { id: 'master_shared', label: '合租主卧 (独卫)' },
  { id: 'studio', label: '单身开间 / 独立套间' },
  { id: 'one_bedroom', label: '一室一厅一卫' },
  { id: 'two_bedroom', label: '两室一厅 / 结伴合租' },
  { id: 'other', label: '步梯顶楼 / 城中村自建房 / 宿舍' },
];

export const BudgetModule: React.FC<BudgetModuleProps> = ({
  plan,
  onUpdatePlan,
  focusMode,
  theme = 'light',
}) => {
  const budget = plan.budget;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isDark = theme === 'dark';

  // Update budget helper
  const updateBudget = (patch: Partial<BudgetConfig>) => {
    onUpdatePlan({
      ...plan,
      budget: { ...plan.budget, ...patch },
      updatedAt: new Date().toISOString(),
    });
  };

  // Values from state
  const monthlyIncome = budget.monthlyIncome || 0;
  const otherIncome = budget.otherIncome || 0;
  const totalIncome = monthlyIncome + otherIncome;

  const rentRatioPct = Math.round((budget.recommendedRentRatio || 0.3) * 100);
  const utilitiesCost = (budget.estimatedUtilities || 0) + (budget.estimatedPropertyInternet || 0);
  const otherExpenses = budget.otherMonthlyExpenses || 0;

  const depositMonths = budget.depositMonths ?? 1;
  const payMonths = budget.payMonths ?? 1;

  // Calculate suggested rent ceiling
  const suggestedRentCeiling =
    totalIncome > 0
      ? Math.round((totalIncome * rentRatioPct) / 100)
      : budget.maxMonthlyRent > 0
      ? budget.maxMonthlyRent
      : 0;

  // Upfront calculations
  const effectiveRentForUpfront = suggestedRentCeiling > 0 ? suggestedRentCeiling : (budget.maxMonthlyRent || 0);
  const depositAmt = effectiveRentForUpfront * depositMonths;
  const firstPeriodRent = effectiveRentForUpfront * payMonths;
  const agencyFee =
    budget.agencyFeeAmount !== undefined
      ? budget.agencyFeeAmount
      : budget.agencyFeeRate
      ? Math.round(effectiveRentForUpfront * budget.agencyFeeRate)
      : 0;
  const movingAndSetup = (budget.movingBudget || 0) + (budget.initialSuppliesBudget || 0);

  const totalUpfront =
    effectiveRentForUpfront > 0
      ? depositAmt + firstPeriodRent + agencyFee + movingAndSetup
      : 0;

  // Verdict metrics
  const actualRatio =
    totalIncome > 0 && effectiveRentForUpfront > 0
      ? ((effectiveRentForUpfront / totalIncome) * 100).toFixed(1)
      : null;

  const monthlySurplus =
    totalIncome > 0
      ? totalIncome - effectiveRentForUpfront - utilitiesCost - otherExpenses
      : null;

  const annualHousingCost =
    effectiveRentForUpfront > 0
      ? effectiveRentForUpfront * 12 + utilitiesCost * 12 + agencyFee + movingAndSetup
      : null;

  const hasIncome = totalIncome > 0 || budget.maxMonthlyRent > 0;

  // Theme styling helpers
  const cardBg = isDark
    ? 'bg-neutral-900/40 border-neutral-800/90 text-neutral-200'
    : 'bg-white border-neutral-200/90 text-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)]';
  const headerBorder = isDark ? 'border-neutral-800' : 'border-neutral-200/80';
  const headerTitle = isDark ? 'text-neutral-300' : 'text-neutral-900';
  const labelColor = isDark ? 'text-neutral-400' : 'text-neutral-600';
  const inputBg = isDark
    ? 'bg-neutral-900/60 border-neutral-800 focus:border-neutral-500 focus:bg-neutral-900 text-neutral-200'
    : 'bg-white border-neutral-200 focus:border-neutral-400 focus:bg-white text-neutral-900 focus:ring-1 focus:ring-neutral-200 shadow-2xs';
  const lineBorder = isDark ? 'border-neutral-800/60' : 'border-neutral-100';

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* Title Section */}
      <div className="pt-2 pb-1">
        <h1
          className={`font-editorial italic text-3xl sm:text-4xl tracking-tight font-normal ${
            isDark ? 'text-neutral-100' : 'text-neutral-950'
          }`}
        >
          预算测算
        </h1>
        <p
          className={`font-mono-code text-[11px] sm:text-xs tracking-[0.22em] uppercase mt-1.5 ${
            isDark ? 'text-neutral-500' : 'text-neutral-500'
          }`}
        >
          MONTHLY RENT CEILING & UPFRONT CASH REQUIREMENT
        </p>
      </div>

      {/* 3-Column Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Column 1: Monthly Income & Cash Flow */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`flex items-center gap-2 border-b pb-2 ${headerBorder}`}>
            <span className={`text-xs font-semibold ${headerTitle}`}>月度收支基数</span>
            <span className="font-mono-code text-[11px] text-neutral-400">// CASH FLOW</span>
          </div>

          <div className="space-y-5 text-xs">
            {/* 月固定净到手收入 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>月到手税后收入（元）</label>
              <input
                type="number"
                min="0"
                step="100"
                value={budget.monthlyIncome || ''}
                onChange={(e) => updateBudget({ monthlyIncome: Number(e.target.value) || 0 })}
                placeholder="如：3500 / 6000 / 12000"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
            </div>

            {/* 其他月度收入 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>其他月度补贴 / 兼职（元）</label>
              <input
                type="number"
                min="0"
                step="50"
                value={otherIncome || ''}
                onChange={(e) => updateBudget({ otherIncome: Number(e.target.value) || 0 })}
                placeholder="如：租房补贴 500"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
            </div>

            {/* 房租承受比例选择 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className={`font-medium ${labelColor}`}>建议房租占收入比</label>
                <span
                  className={`font-mono-code font-bold ${
                    isDark ? 'text-rose-400' : 'text-rose-600'
                  }`}
                >
                  {rentRatioPct}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { ratio: 0.2, label: '20% 轻松' },
                  { ratio: 0.25, label: '25% 稳健' },
                  { ratio: 0.3, label: '30% 黄金' },
                  { ratio: 0.35, label: '35% 紧绷' },
                ].map((item) => (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() => updateBudget({ recommendedRentRatio: item.ratio })}
                    className={`py-2 px-1 text-center rounded text-[11px] font-mono-code transition-colors border ${
                      Math.abs((budget.recommendedRentRatio || 0.3) - item.ratio) < 0.01
                        ? isDark
                          ? 'bg-neutral-800 border-neutral-600 text-neutral-100 font-semibold'
                          : 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                        : isDark
                        ? 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500 hover:text-neutral-300'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 水电杂费预估 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>预估每月水电燃气网费（元）</label>
              <input
                type="number"
                min="0"
                step="20"
                value={utilitiesCost || ''}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  updateBudget({ estimatedUtilities: val, estimatedPropertyInternet: 0 });
                }}
                placeholder="如：城中村商业水电 200 / 民用 80"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
            </div>
          </div>
        </div>

        {/* Column 2: Upfront Move-in Cash Reserve */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`flex items-center gap-2 border-b pb-2 ${headerBorder}`}>
            <span className={`text-xs font-semibold ${headerTitle}`}>启动首付与现金流</span>
            <span className="font-mono-code text-[11px] text-neutral-400">// UPFRONT</span>
          </div>

          <div className="space-y-5 text-xs">
            {/* 支付方式 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>付款押付周期</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { deposit: 1, pay: 1, label: '押一付一' },
                  { deposit: 1, pay: 3, label: '押一付三' },
                  { deposit: 2, pay: 1, label: '押二付一' },
                ].map((mode) => {
                  const isSelected = depositMonths === mode.deposit && payMonths === mode.pay;
                  return (
                    <button
                      key={mode.label}
                      type="button"
                      onClick={() => updateBudget({ depositMonths: mode.deposit, payMonths: mode.pay })}
                      className={`py-2 rounded text-xs font-mono-code transition-colors border ${
                        isSelected
                          ? isDark
                            ? 'bg-neutral-800 border-neutral-600 text-neutral-100 font-semibold'
                            : 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                          : isDark
                          ? 'bg-neutral-900/40 border-neutral-800/80 text-neutral-500 hover:text-neutral-300'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 中介费预算 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>中介服务费（元）</label>
              <input
                type="number"
                min="0"
                step="50"
                value={agencyFee || ''}
                onChange={(e) => updateBudget({ agencyFeeAmount: Number(e.target.value) || 0 })}
                placeholder="房东直租填 0 / 中介半月租金"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
            </div>

            {/* 搬家与购置预算 */}
            <div className="space-y-1.5">
              <label className={`block font-medium ${labelColor}`}>搬家与添置预算（元）</label>
              <input
                type="number"
                min="0"
                step="50"
                value={movingAndSetup || ''}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  updateBudget({ movingBudget: val, initialSuppliesBudget: 0 });
                }}
                placeholder="如：150 / 300"
                className={`w-full rounded px-3 py-2.5 text-sm font-mono-code outline-none transition-colors border ${inputBg}`}
              />
            </div>

            {/* Explanatory Note (Hidden in Focus Mode) */}
            {!focusMode && (
              <div
                className={`pt-3 text-[11px] leading-relaxed border-t ${
                  isDark ? 'text-neutral-500 border-neutral-800/60' : 'text-neutral-500 border-neutral-200/60'
                }`}
              >
                首次支出按「建议房租上限」估算：押金 + 首期租金 + 中介费 + 搬家购置。
              </div>
            )}

            {/* Direct manual ceiling override option */}
            <div className="pt-2">
              <div className="text-[11px] text-neutral-500 mb-1.5 flex items-center justify-between">
                <span>手动限定租金上限 (可选)</span>
                {budget.maxMonthlyRent > 0 && (
                  <span
                    className={`font-mono-code font-medium ${
                      isDark ? 'text-neutral-300' : 'text-neutral-700'
                    }`}
                  >
                    ¥{budget.maxMonthlyRent}
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="50"
                value={budget.maxMonthlyRent || ''}
                onChange={(e) => updateBudget({ maxMonthlyRent: Number(e.target.value) || 0 })}
                placeholder="输入期望固定月租（如：650 / 800）"
                className={`w-full rounded px-3 py-2 text-xs font-mono-code outline-none transition-colors border ${
                  isDark
                    ? 'bg-neutral-900/40 border-neutral-800/80 text-neutral-300 focus:border-neutral-600'
                    : 'bg-neutral-50/70 border-neutral-200 text-neutral-800 focus:border-neutral-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Column 3: VERDICT // 测算结果 */}
        <div className="lg:col-span-4">
          <div className={`rounded-lg p-6 space-y-6 border ${cardBg}`}>
            <div className={`flex items-center gap-2 border-b pb-2 ${headerBorder}`}>
              <span className={`text-xs font-semibold ${headerTitle}`}>测算结果</span>
              <span className="font-mono-code text-[11px] text-neutral-400">// VERDICT</span>
            </div>

            {/* Suggested Rent Ceiling */}
            <div className="space-y-2">
              <div className={`text-xs font-medium ${labelColor}`}>建议房租上限 / 月</div>
              <div
                className={`font-mono-code text-3xl font-bold tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-950'
                }`}
              >
                {hasIncome ? `¥ ${suggestedRentCeiling.toLocaleString()}` : '—'}
              </div>
              <div className="h-0.5 bg-emerald-500 w-14 rounded-full" />
            </div>

            {/* Summary Line Items */}
            <div className="space-y-3 pt-2 text-xs">
              <div className={`flex justify-between items-center border-b pb-2.5 ${lineBorder}`}>
                <span className={labelColor}>首次入住总支出</span>
                <span
                  className={`font-mono-code font-semibold ${
                    isDark ? 'text-neutral-200' : 'text-neutral-900'
                  }`}
                >
                  {totalUpfront > 0 ? `¥ ${totalUpfront.toLocaleString()}` : '—'}
                </span>
              </div>

              <div className={`flex justify-between items-center border-b pb-2.5 ${lineBorder}`}>
                <span className={labelColor}>房租实际占比</span>
                <span
                  className={`font-mono-code font-semibold ${
                    isDark ? 'text-neutral-200' : 'text-neutral-900'
                  }`}
                >
                  {actualRatio ? `${actualRatio} %` : '—'}
                </span>
              </div>

              <div className={`flex justify-between items-center border-b pb-2.5 ${lineBorder}`}>
                <span className={labelColor}>月度结余 (按上限房租)</span>
                <span
                  className={`font-mono-code font-semibold ${
                    monthlySurplus !== null && monthlySurplus < 0
                      ? 'text-rose-500'
                      : isDark
                      ? 'text-neutral-200'
                      : 'text-neutral-900'
                  }`}
                >
                  {monthlySurplus !== null ? `¥ ${monthlySurplus.toLocaleString()}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-1">
                <span className={labelColor}>全年住房成本</span>
                <span
                  className={`font-mono-code font-semibold ${
                    isDark ? 'text-neutral-200' : 'text-neutral-900'
                  }`}
                >
                  {annualHousingCost ? `¥ ${annualHousingCost.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            {/* Status Footer */}
            <div className={`pt-3 border-t ${headerBorder}`}>
              {!hasIncome ? (
                <div
                  className={`font-mono-code text-[11px] tracking-wide ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`}
                >
                  AWAITING INPUT // 填入收入后自动测算
                </div>
              ) : (
                <div
                  className={`font-mono-code text-[11px] tracking-wide flex items-center justify-between ${
                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                >
                  <span className="font-semibold">OPTIMIZED // 已完成测算建议</span>
                  <span className="text-neutral-400 text-[10px]">实时保存</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Optional Advanced Criteria Toggle (Hidden in Focus Mode) */}
      {!focusMode && (
        <div className={`pt-2 border-t ${headerBorder}`}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`text-xs transition-colors flex items-center gap-1.5 font-mono-code ${
              isDark
                ? 'text-neutral-500 hover:text-neutral-300'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>{showAdvanced ? '[-]' : '[+]'}</span>
            <span>房型与通勤预设选项 // ADVANCED PREFERENCES</span>
          </button>

          {showAdvanced && (
            <div
              className={`mt-4 p-4 rounded-lg text-xs space-y-4 border ${
                isDark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-white border-neutral-200'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block mb-1.5 ${labelColor}`}>房型偏好</label>
                  <select
                    value={budget.roomType}
                    onChange={(e) => updateBudget({ roomType: e.target.value as RoomType })}
                    className={`w-full rounded px-2.5 py-2 text-xs outline-none border ${
                      isDark
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                    }`}
                  >
                    {ROOM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block mb-1.5 ${labelColor}`}>通勤目的地 / 上班地点</label>
                  <input
                    type="text"
                    value={budget.workplace || ''}
                    onChange={(e) => updateBudget({ workplace: e.target.value })}
                    placeholder="如：科技园 / 市中心"
                    className={`w-full rounded px-2.5 py-2 text-xs outline-none border ${
                      isDark
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
