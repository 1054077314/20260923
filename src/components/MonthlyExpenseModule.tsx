import React, { useState, useMemo, useRef } from 'react';
import { RentalPlan, MonthlyExpense } from '../types/rental';
import {
  Receipt,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  DollarSign,
  AlertCircle,
  Sparkles,
  FileDown,
  Loader2,
  CheckCircle2,
  Building,
  ShieldCheck,
  Printer,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MonthlyExpenseModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
}

const EXPENSE_COLORS: Record<string, string> = {
  房租支出: '#0f172a', // Slate 900
  电费支出: '#f59e0b', // Amber 500
  水费支出: '#0284c7', // Sky 600
  燃气费支出: '#ea580c', // Orange 600
  物业管理费: '#4f46e5', // Indigo 600
  宽带网络费: '#9333ea', // Purple 600
  其他杂项: '#64748b', // Slate 500
};

export const MonthlyExpenseModule: React.FC<MonthlyExpenseModuleProps> = ({
  plan,
  onUpdatePlan,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const [formMonth, setFormMonth] = useState(new Date().toISOString().slice(0, 7));
  const [formRent, setFormRent] = useState(plan.budget.maxMonthlyRent || 2000);
  const [formElec, setFormElec] = useState(80);
  const [formWater, setFormWater] = useState(25);
  const [formGas, setFormGas] = useState(15);
  const [formProperty, setFormProperty] = useState(0);
  const [formInternet, setFormInternet] = useState(30);
  const [formOther, setFormOther] = useState(0);
  const [formNote, setFormNote] = useState('');

  const reportPrintRef = useRef<HTMLDivElement>(null);
  const expenses = plan.monthlyExpenses || [];

  const handleAddExpense = () => {
    const newRecord: MonthlyExpense = {
      id: `exp-${Date.now()}`,
      month: formMonth,
      rent: Number(formRent) || 0,
      electricity: Number(formElec) || 0,
      water: Number(formWater) || 0,
      gas: Number(formGas) || 0,
      property: Number(formProperty) || 0,
      internet: Number(formInternet) || 0,
      other: Number(formOther) || 0,
      note: formNote.trim(),
    };

    onUpdatePlan({
      ...plan,
      monthlyExpenses: [newRecord, ...expenses],
      updatedAt: new Date().toISOString(),
    });

    setShowAddForm(false);
    setFormNote('');
  };

  const handleDeleteExpense = (id: string) => {
    onUpdatePlan({
      ...plan,
      monthlyExpenses: expenses.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  // Aggregated totals
  const totalRent = expenses.reduce((a, b) => a + (b.rent || 0), 0);
  const totalElec = expenses.reduce((a, b) => a + (b.electricity || 0), 0);
  const totalWater = expenses.reduce((a, b) => a + (b.water || 0), 0);
  const totalGas = expenses.reduce((a, b) => a + (b.gas || 0), 0);
  const totalProperty = expenses.reduce((a, b) => a + (b.property || 0), 0);
  const totalInternet = expenses.reduce((a, b) => a + (b.internet || 0), 0);
  const totalOther = expenses.reduce((a, b) => a + (b.other || 0), 0);

  const grandTotal =
    totalRent + totalElec + totalWater + totalGas + totalProperty + totalInternet + totalOther;

  const avgMonthly = expenses.length > 0 ? Math.round(grandTotal / expenses.length) : 0;
  const budgetDiff = avgMonthly - plan.budget.maxMonthlyRent;

  // Pie chart data: proportion distribution of various rental expenses
  const pieData = useMemo(() => {
    if (expenses.length === 0) {
      // Provide an illustrative sample distribution based on current budget if no actual bills are recorded yet
      const sampleRent = plan.budget.maxMonthlyRent || 2500;
      const sampleElec = 90;
      const sampleWater = 30;
      const sampleGas = 20;
      const sampleInternet = 40;

      return [
        { name: '房租支出', value: sampleRent, color: EXPENSE_COLORS['房租支出'] },
        { name: '电费支出', value: sampleElec, color: EXPENSE_COLORS['电费支出'] },
        { name: '水费支出', value: sampleWater, color: EXPENSE_COLORS['水费支出'] },
        { name: '燃气费支出', value: sampleGas, color: EXPENSE_COLORS['燃气费支出'] },
        { name: '宽带网络费', value: sampleInternet, color: EXPENSE_COLORS['宽带网络费'] },
      ];
    }

    const items = [
      { name: '房租支出', value: totalRent, color: EXPENSE_COLORS['房租支出'] },
      { name: '电费支出', value: totalElec, color: EXPENSE_COLORS['电费支出'] },
      { name: '水费支出', value: totalWater, color: EXPENSE_COLORS['水费支出'] },
      { name: '燃气费支出', value: totalGas, color: EXPENSE_COLORS['燃气费支出'] },
      { name: '物业管理费', value: totalProperty, color: EXPENSE_COLORS['物业管理费'] },
      { name: '宽带网络费', value: totalInternet, color: EXPENSE_COLORS['宽带网络费'] },
      { name: '其他杂项', value: totalOther, color: EXPENSE_COLORS['其他杂项'] },
    ];
    return items.filter((i) => i.value > 0);
  }, [
    expenses,
    totalRent,
    totalElec,
    totalWater,
    totalGas,
    totalProperty,
    totalInternet,
    totalOther,
    plan.budget.maxMonthlyRent,
  ]);

  // Bar chart data: historical spending trend vs planned budget limit
  const barData = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.map((item) => ({
      month: item.month,
      房租: item.rent,
      水电燃气: item.electricity + item.water + item.gas,
      物业与网络: item.property + item.internet + item.other,
      总支出:
        item.rent +
        item.electricity +
        item.water +
        item.gas +
        item.property +
        item.internet +
        item.other,
    }));
  }, [expenses]);

  // Handle Export Monthly Expense PDF
  const handleExportPDF = async () => {
    if (!reportPrintRef.current) return;

    try {
      setIsExportingPDF(true);
      const element = reportPrintRef.current;

      // Render high-DPI canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const cleanPlanName = (plan.name || '租房规划').replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${cleanPlanName}_月度支出统计报告_${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(fileName);

      setExportSuccessMessage(`报告已生成并自动下载: ${fileName}`);
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('导出 PDF 报告失败，请重试');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              阶段六：租住每月开销与水电账簿
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              追踪入住后的真实月度支出（房租、水费、电费、燃气、宽带），通过图表直观洞察各项开支占比分布，并支持一键导出精美统计报告 PDF。
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
              title="导出当前月度账簿统计报告为 PDF 文档"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                  <span>生成 PDF 中...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>导出月度支出 PDF</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>记一笔月度账单</span>
            </button>
          </div>
        </div>

        {/* Success toast banner */}
        {exportSuccessMessage && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{exportSuccessMessage}</span>
            </div>
            <button
              onClick={() => setExportSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 font-medium"
            >
              关闭
            </button>
          </div>
        )}

        {/* Financial KPI bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">月均实际租住成本</span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              ¥{avgMonthly.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-500">/月</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">
              累计总支出 ({expenses.length}个月)
            </span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              ¥{grandTotal.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">
              对比计划租金上限 (¥{plan.budget.maxMonthlyRent})
            </span>
            <div
              className={`text-xl font-extrabold mt-0.5 flex items-center gap-1.5 ${
                budgetDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {budgetDiff <= 0 ? (
                <>
                  <TrendingDown className="w-4 h-4" />
                  <span>节约 ¥{Math.abs(budgetDiff)}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>超支 ¥{budgetDiff}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Chart with Recharts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {chartType === 'pie' ? (
                <PieChartIcon className="w-4 h-4 text-indigo-600" />
              ) : (
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              )}
              {chartType === 'pie'
                ? '租房各项支出比例分布 (饼图)'
                : '月度支出走势与预算对比 (柱状图)'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {expenses.length === 0
                ? '💡 当前显示基于预设预算的试算分布，登记实际月账单后将自动更新为真实占比。'
                : `基于已录入的 ${expenses.length} 期账单数据生成。`}
            </p>
          </div>

          {/* Chart View Toggle Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                chartType === 'pie'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>支出占比饼图</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>月度支出柱状图</span>
            </button>
          </div>
        </div>

        {/* Chart Render Area */}
        {chartType === 'pie' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
            {/* Recharts Pie Chart (7 Cols) */}
            <div className="lg:col-span-7 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const totalVal = pieData.reduce((a, b) => a + b.value, 0);
                        const percent =
                          totalVal > 0
                            ? ((Number(data.value) / totalVal) * 100).toFixed(1)
                            : '0';
                        return (
                          <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg space-y-0.5 border border-slate-700">
                            <div className="font-semibold">{data.name}</div>
                            <div className="text-slate-300">
                              金额:{' '}
                              <strong className="text-white">
                                ¥{Number(data.value).toLocaleString()}
                              </strong>
                            </div>
                            <div className="text-emerald-400">占比: {percent}%</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Proportion Breakdown List (5 Cols) */}
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                各项费用结构细目
              </div>
              <div className="space-y-1.5">
                {pieData.map((item) => {
                  const totalVal = pieData.reduce((a, b) => a + b.value, 0);
                  const percent =
                    totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={item.name}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-700">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          ¥{item.value.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[11px] w-12 text-right">
                          {percent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Recharts Bar Chart */
          <div className="pt-2">
            {expenses.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 space-y-2">
                <BarChart3 className="w-8 h-8 text-slate-300" />
                <p>暂无月度历史账单，记录2个月以上账单即可呈现月度堆叠对比走势。</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      tickFormatter={(value) => `¥${value}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce(
                            (acc, curr) => acc + (Number(curr.value) || 0),
                            0
                          );
                          return (
                            <div className="bg-slate-900 text-white px-3 py-2.5 rounded-lg text-xs shadow-xl space-y-1 border border-slate-700">
                              <div className="font-bold border-b border-slate-700 pb-1">
                                {label} 月账单
                              </div>
                              {payload.map((entry: any) => (
                                <div
                                  key={entry.name}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span style={{ color: entry.color }}>{entry.name}:</span>
                                  <span className="font-semibold text-white">
                                    ¥{Number(entry.value).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                              <div className="pt-1 border-t border-slate-700 flex justify-between font-bold text-emerald-400">
                                <span>当月总计:</span>
                                <span>¥{total.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                    />
                    {plan.budget.maxMonthlyRent > 0 && (
                      <ReferenceLine
                        y={plan.budget.maxMonthlyRent}
                        label={{
                          value: `预算红线 (¥${plan.budget.maxMonthlyRent})`,
                          fill: '#e11d48',
                          fontSize: 11,
                          position: 'insideTopRight',
                        }}
                        stroke="#e11d48"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Bar dataKey="房租" stackId="a" fill="#0f172a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="水电燃气" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="物业与网络"
                      stackId="a"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">登记月度租房账单</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">账单月份</label>
                <input
                  type="month"
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">月租金 (元)</label>
                <input
                  type="number"
                  value={formRent}
                  onChange={(e) => setFormRent(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">电费 (元)</label>
                <input
                  type="number"
                  value={formElec}
                  onChange={(e) => setFormElec(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">水费 (元)</label>
                <input
                  type="number"
                  value={formWater}
                  onChange={(e) => setFormWater(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">燃气费 (元)</label>
                <input
                  type="number"
                  value={formGas}
                  onChange={(e) => setFormGas(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">物业费 (元)</label>
                <input
                  type="number"
                  value={formProperty}
                  onChange={(e) => setFormProperty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">宽带网络 (元)</label>
                <input
                  type="number"
                  value={formInternet}
                  onChange={(e) => setFormInternet(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">其他杂费 (元)</label>
                <input
                  type="number"
                  value={formOther}
                  onChange={(e) => setFormOther(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-medium">备注说明</label>
              <input
                type="text"
                placeholder="例：夏天开空调频繁，电费略高"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleAddExpense}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
              >
                保存记账
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">月度开销明细表</h3>
          <span className="text-xs text-slate-400">共 {expenses.length} 条记录</span>
        </div>

        {expenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            暂无月度账单记录，入住后点击右上角“记一笔月度账单”即可开始记录。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">月份</th>
                  <th className="px-4 py-3">房租</th>
                  <th className="px-4 py-3">水电燃气</th>
                  <th className="px-4 py-3">物业+网络</th>
                  <th className="px-4 py-3">合计总支出</th>
                  <th className="px-4 py-3">备注</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((item) => {
                  const utilitiesTotal = item.electricity + item.water + item.gas;
                  const otherTotal = item.property + item.internet + item.other;
                  const monthTotal = item.rent + utilitiesTotal + otherTotal;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.month}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        ¥{item.rent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        ¥{utilitiesTotal}{' '}
                        <span className="text-[10px] text-slate-400">
                          (电{item.electricity}/水{item.water}/燃{item.gas})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        ¥{otherTotal}{' '}
                        <span className="text-[10px] text-slate-400">
                          (物{item.property}/网{item.internet})
                        </span>
                      </td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">
                        ¥{monthTotal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {item.note || '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* HIDDEN PRINTABLE TEMPLATE FOR HIGH-FIDELITY PDF REPORT GENERATION         */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '800px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div ref={reportPrintRef} className="p-8 bg-white space-y-6">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                RENTPLAN FINANCIAL AUDIT REPORT
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                租房月度支出与账单统计报告
              </h1>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>方案：<strong>{plan.name}</strong></span>
                <span>目标城市：<strong>{plan.city || '未指定'}</strong></span>
                <span>
                  生成日期：<strong>{new Date().toISOString().slice(0, 10)}</strong>
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-900 text-white rounded">
                对账周期：{expenses.length > 0 ? `${expenses[expenses.length - 1]?.month} ~ ${expenses[0]?.month}` : '初始规划期'}
              </span>
              <div className="text-[10px] text-slate-400 mt-1">共收录 {expenses.length} 期账单</div>
            </div>
          </div>

          {/* 4 Financial KPIs in PDF */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-semibold">计划月预算上限</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                ¥{plan.budget.maxMonthlyRent.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-semibold">实际月均综合开销</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                ¥{avgMonthly.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-semibold">累计总投入金额</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                ¥{grandTotal.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-semibold">月均预算偏离</div>
              <div
                className={`text-base font-black mt-0.5 ${
                  budgetDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {budgetDiff <= 0 ? `节约 ¥${Math.abs(budgetDiff)}` : `超支 ¥${budgetDiff}`}
              </div>
            </div>
          </div>

          {/* Expense Category Breakdown Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>各项费用构成比例分布</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {expenses.length > 0 ? '按实际发生金额统计' : '按设定基准预估'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {pieData.map((item) => {
                const totalVal = pieData.reduce((a, b) => a + b.value, 0);
                const percent =
                  totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={item.name}
                    className="p-2 rounded bg-white border border-slate-200/80 space-y-0.5"
                  >
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{item.name}</span>
                      <span className="font-bold text-slate-900">{percent}%</span>
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      ¥{item.value.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ledger Table in PDF */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900">月度支出明细清单</div>
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">账期月份</th>
                  <th className="py-2 px-3">房屋月租</th>
                  <th className="py-2 px-3">水电燃气</th>
                  <th className="py-2 px-3">物业+宽带</th>
                  <th className="py-2 px-3">当月总支出</th>
                  <th className="py-2 px-3">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      暂无账单数据，此页为预算模板预置报告
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => {
                    const u = e.electricity + e.water + e.gas;
                    const o = e.property + e.internet + e.other;
                    const tot = e.rent + u + o;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{e.month}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">
                          ¥{e.rent.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          ¥{u}{' '}
                          <span className="text-[10px] text-slate-400">
                            (电{e.electricity}/水{e.water}/燃{e.gas})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          ¥{o}{' '}
                          <span className="text-[10px] text-slate-400">
                            (物{e.property}/网{e.internet})
                          </span>
                        </td>
                        <td className="py-2 px-3 font-black text-slate-900">
                          ¥{tot.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{e.note || '--'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Notes & Signature Footer */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>租金审计评估结论：</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {budgetDiff <= 0
                  ? `目前综合月均支出控制在计划预算上限以内，月均节约金额达 ¥${Math.abs(budgetDiff)}，财务健康度良好。`
                  : `目前综合月均支出超出计划预算上限 ¥${budgetDiff}，建议重点排查夏季空调用电、商用水电计费及高额宽带套餐。`}
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[11px] text-slate-400">RentPlan 租房全周期规划系统</div>
              <div className="text-[10px] text-slate-400">
                存证哈希：{plan.id.slice(0, 16)} · 自动导出备忘专用
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
