import { RentalPlan, PlanTemplate } from '../types/rental';
import { PRESET_TEMPLATES } from '../data/defaultTemplates';
import { calculateStartupFund, calculateCandidateMonthlyTotal, calculateWeightedScore } from './calculations';

const STORAGE_KEY_PLANS = 'rentplan_user_plans_v1';
const STORAGE_KEY_ACTIVE_ID = 'rentplan_active_id_v1';
const STORAGE_KEY_CUSTOM_TEMPLATES = 'rentplan_custom_templates_v1';

export function initializeDefaultPlans(): RentalPlan[] {
  const now = new Date().toISOString();
  return PRESET_TEMPLATES.map((tmpl, idx) => ({
    ...tmpl.defaultData,
    id: `plan-preset-${tmpl.id}`,
    createdAt: now,
    updatedAt: now,
    isTemplate: false,
    candidates: tmpl.defaultData.candidates.map((c) => ({
      ...c,
      weightedScore: calculateWeightedScore(c.ratings, tmpl.defaultData.weights),
    })),
  }));
}

export function getStoredPlans(): RentalPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    if (!raw) {
      const initial = initializeDefaultPlans();
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(initial));
      if (initial.length > 0) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, initial[0].id);
      }
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return initializeDefaultPlans();
  } catch (e) {
    console.error('Failed to load plans from localStorage', e);
    return initializeDefaultPlans();
  }
}

export function saveAllPlans(plans: RentalPlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
  } catch (e) {
    console.error('Failed to save plans', e);
  }
}

export function getActivePlanId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  if (stored) return stored;
  const plans = getStoredPlans();
  return plans[0]?.id || '';
}

export function setActivePlanId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
}

export function getCustomTemplates(): PlanTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_TEMPLATES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveCustomTemplate(tmpl: PlanTemplate) {
  const current = getCustomTemplates();
  const existingIdx = current.findIndex((c) => c.id === tmpl.id);
  let updated: PlanTemplate[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = tmpl;
  } else {
    updated = [tmpl, ...current];
  }
  localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(updated));
}

export function deleteCustomTemplate(id: string) {
  const current = getCustomTemplates();
  const updated = current.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(updated));
}

export function exportPlanToMarkdown(plan: RentalPlan): string {
  const fund = calculateStartupFund(plan.budget);
  const dateStr = new Date().toLocaleDateString('zh-CN');

  let md = `# 🏠 ${plan.name} - 租房全周期规划与决策报告
> 目标城市：${plan.city || '未设定'} ｜ 预计入住：${plan.targetDate || '未设定'} ｜ 导出时间：${dateStr}

---

## 💰 一、预算配置与首期启动资金
- **月收入基准**：¥${plan.budget.monthlyIncome.toLocaleString()} / 月
- **月租金上限**：¥${plan.budget.maxMonthlyRent.toLocaleString()} / 月 (占收入 ${((plan.budget.maxMonthlyRent / (plan.budget.monthlyIncome || 1)) * 100).toFixed(1)}%)
- **付款方式**：押 ${plan.budget.depositMonths} 个月，付 ${plan.budget.payMonths} 个月
- **中介费比例**：${(plan.budget.agencyFeeRate * 100).toFixed(0)}% (约 ¥${fund.agencyFee.toLocaleString()})
- **预估启动总资金需求**：**¥${fund.total.toLocaleString()}**
  - 租房押金：¥${fund.deposit.toLocaleString()}
  - 首次付租：¥${fund.advanceRent.toLocaleString()}
  - 中介服务费：¥${fund.agencyFee.toLocaleString()}
  - 搬家杂费：¥${fund.moving.toLocaleString()}
  - 首期用品添置：¥${fund.supplies.toLocaleString()}

### 🎯 需求偏好
- **目标户型**：${plan.budget.roomType}
- **意向区域**：${plan.budget.preferredDistricts.join('、') || '暂无'}
- **工作地点**：${plan.budget.workplace || '暂无'} (上限单程通勤 ${plan.budget.maxCommuteMinutes} 分钟)
- **硬性必选**：${plan.budget.mustHaves.join('； ') || '无'}
- **一票否决**：${plan.budget.dealBreakers.join('； ') || '无'}

---

## ⚖️ 二、候选房源综合加权评分决策
`;

  if (plan.candidates.length === 0) {
    md += `\n*暂未录入候选房源*\n`;
  } else {
    // Sort by weighted score descending
    const sorted = [...plan.candidates].sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));
    sorted.forEach((c, idx) => {
      const monthlyTotal = calculateCandidateMonthlyTotal(c);
      md += `
### ${idx + 1}. ${c.title} 【综合得分：${c.weightedScore || 0} 分】
- **小区/地址**：${c.community} (${c.address || '无详细地址'})
- **月租金**：¥${c.rent} / 月 (杂费合计后综合月支出: ¥${monthlyTotal}/月)
- **通勤表现**：近 ${c.subwayStation}，步行 ${c.walkToSubwayMin} 分钟，单程耗时约 ${c.commuteMinutes} 分钟
- **房屋属性**：${c.areaSqMeters}㎡ ｜ ${c.floor} ｜ ${c.utilitiesType === 'residential' ? '民水民电' : '商水商电'} ｜ ${c.depositTerms}
- **优势亮点**：${c.pros.join('、') || '无'}
- **潜在不足**：${c.cons.join('、') || '无'}
- **实地看房状态**：${c.inspectionStatus} ${c.inspectionDate ? `(${c.inspectionDate})` : ''}
- **房东/中介联系人**：${c.contactName} ${c.contactPhone ? `(${c.contactPhone})` : ''}
- **备忘细节**：${c.notes || '无'}
`;
    });
  }

  md += `
---

## 🔍 三、看房防坑排查与关键避坑检查
`;

  plan.inspectionCategories.forEach((cat) => {
    md += `\n### ${cat.name}\n`;
    cat.items.forEach((item) => {
      md += `- [ ] **${item.title}**${item.isCritical ? ' ⚠️【必查重点】' : ''}：${item.detail}\n`;
    });
  });

  md += `
---

## 📝 四、签约合同避雷要点
`;
  plan.contractChecklist.forEach((item) => {
    md += `- [${item.checked ? 'x' : ' '}] **${item.title}**：${item.description}\n`;
  });

  md += `
---

## 📦 五、交接底数与搬家备忘
- **交接读数**：水表 ${plan.handoverRecord.waterMeter || '--'} 吨 ｜ 电表 ${plan.handoverRecord.electricMeter || '--'} 度 ｜ 燃气表 ${plan.handoverRecord.gasMeter || '--'} 方
- **钥匙门禁**：${plan.handoverRecord.keysCount} 把/张
- **交接备忘**：${plan.handoverRecord.remarks || '无'}

*由 RentPlan 租房全周期规划看板生成*
`;

  return md;
}
