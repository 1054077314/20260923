import React, { useState } from 'react';
import {
  RentalPlan,
  ContractCheckItem,
  HandoverRecord,
} from '../types/rental';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Key,
  Gauge,
  Tv,
  Plus,
  Trash2,
  AlertOctagon,
  Camera,
  Info,
} from 'lucide-react';

interface ContractModuleProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
}

export const ContractModule: React.FC<ContractModuleProps> = ({ plan, onUpdatePlan }) => {
  const [newApplianceName, setNewApplianceName] = useState('');
  const [newApplianceCondition, setNewApplianceCondition] = useState('');

  const handleToggleContractItem = (id: string) => {
    const updated = plan.contractChecklist.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    onUpdatePlan({ ...plan, contractChecklist: updated, updatedAt: new Date().toISOString() });
  };

  const handleUpdateHandover = (partial: Partial<HandoverRecord>) => {
    onUpdatePlan({
      ...plan,
      handoverRecord: {
        ...plan.handoverRecord,
        ...partial,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddAppliance = () => {
    if (!newApplianceName.trim()) return;
    const currentList = plan.handoverRecord.applianceInventory || [];
    const updated = [
      ...currentList,
      {
        name: newApplianceName.trim(),
        condition: newApplianceCondition.trim() || '成色完好，运转正常',
        checked: true,
      },
    ];
    handleUpdateHandover({ applianceInventory: updated });
    setNewApplianceName('');
    setNewApplianceCondition('');
  };

  const handleRemoveAppliance = (index: number) => {
    const currentList = plan.handoverRecord.applianceInventory || [];
    const updated = currentList.filter((_, i) => i !== index);
    handleUpdateHandover({ applianceInventory: updated });
  };

  const checkedCount = plan.contractChecklist.filter((c) => c.checked).length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              阶段四：签约避雷红线与房屋交接存证
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              黑中介和不良房东扣押金的高发期就在签约和退租阶段！严格把关以下核心条款，并做好初始底数录像留证。
            </p>
          </div>

          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              已完成审查：<strong>{checkedCount}</strong> / {plan.contractChecklist.length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Contract Safeguards Checklist (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                签约合同审查六大铁律
              </h3>
              <span className="text-xs text-slate-400">签字打款前逐条核对</span>
            </div>

            <div className="space-y-3">
              {plan.contractChecklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleContractItem(item.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    item.checked
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <CheckCircle2
                      className={`w-5 h-5 ${
                        item.checked ? 'text-emerald-600 fill-emerald-100' : 'text-slate-300'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-xs font-bold ${
                        item.checked ? 'text-emerald-950' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Crucial tips */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                补充特约条款撰写模板（可直接手写加在合同尾部双方按手印）：
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                “出租方承诺屋内家电及水暖管道在非人为破坏情况下发生自然故障由出租方自费维修；承租方若因不可抗力或工作调动提前退租，提前30天通知并转租成功的，出租方于结清当日全额退还押金。”
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Handover Record & Meters (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Meter Readings Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-slate-700" />
              交接日水电煤表底数存证
            </h3>
            <p className="text-[11px] text-slate-500">
              入住当天与房东一同拍照记录当前表盘数字，作为日后费用分割基准。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">水表底数 (吨)</label>
                <input
                  type="text"
                  placeholder="如: 0142.5"
                  value={plan.handoverRecord.waterMeter || ''}
                  onChange={(e) => handleUpdateHandover({ waterMeter: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">电表底数 (度)</label>
                <input
                  type="text"
                  placeholder="如: 4890.0"
                  value={plan.handoverRecord.electricMeter || ''}
                  onChange={(e) => handleUpdateHandover({ electricMeter: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">燃气底数 (方)</label>
                <input
                  type="text"
                  placeholder="如: 0310.2"
                  value={plan.handoverRecord.gasMeter || ''}
                  onChange={(e) => handleUpdateHandover({ gasMeter: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                交付钥匙及门禁卡数量
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={plan.handoverRecord.keysCount || 2}
                onChange={(e) => handleUpdateHandover({ keysCount: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Appliance Inventory Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tv className="w-4 h-4 text-slate-700" />
                屋内家具家电交接盘点
              </h3>
              <span className="text-xs text-slate-400">
                共 {plan.handoverRecord.applianceInventory?.length || 0} 件
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
              {(plan.handoverRecord.applianceInventory || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {item.condition}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveAppliance(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Add Appliance */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="物品名称 (如：格力变频空调)"
                  value={newApplianceName}
                  onChange={(e) => setNewApplianceName(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="现状备注 (如：制冷正常无异响)"
                  value={newApplianceCondition}
                  onChange={(e) => setNewApplianceCondition(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300"
                />
              </div>
              <button
                onClick={handleAddAppliance}
                className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                添加交接家具家电
              </button>
            </div>

            {/* Photo & Video Storage Reminder */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
              <Camera className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-slate-900">必做存证动作：</strong>
                入住当日对全屋空房、墙面划痕、家电通电运转进行<strong>360度一镜到底视频拍摄</strong>并上传个人网盘，避免日后房东甩锅扣款。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
