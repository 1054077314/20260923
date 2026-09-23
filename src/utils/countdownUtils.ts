import { MovingTask } from '../types/rental';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Maps standard stages to numerical day offsets relative to move-in date
 */
export function getStageOffset(stage: string): number {
  switch (stage) {
    case 'T-14':
      return -14;
    case 'T-7':
      return -7;
    case 'T-3':
      return -3;
    case 'T-1':
      return -1;
    case 'D-Day':
      return 0;
    case 'D+1':
      return 1;
    case 'D+3':
      return 3;
    default:
      return 0;
  }
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string
 */
export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const resYear = date.getFullYear();
  const resMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resDay = String(date.getDate()).padStart(2, '0');
  return `${resYear}-${resMonth}-${resDay}`;
}

/**
 * Computes exact calendar due date for a moving task based on base move-in date
 */
export function computeTaskDueDate(baseTargetDate: string, task: MovingTask): string {
  if (task.dueDate) {
    return task.dueDate;
  }
  if (!baseTargetDate) {
    return '';
  }

  const offset =
    task.offsetDays !== undefined ? task.offsetDays : getStageOffset(task.stage);
  return addDays(baseTargetDate, offset);
}

export interface CountdownDiff {
  diffDays: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  label: string;
  shortBadge: string;
  urgency: 'critical' | 'warning' | 'normal' | 'done' | 'past';
}

/**
 * Computes countdown diff from today to the given target date (YYYY-MM-DD)
 */
export function getCountdownDiff(targetDateStr: string, isCompleted = false): CountdownDiff {
  if (!targetDateStr) {
    return {
      diffDays: 0,
      isToday: false,
      isPast: false,
      isFuture: false,
      label: '未设置日期',
      shortBadge: '待定',
      urgency: 'normal',
    };
  }

  if (isCompleted) {
    return {
      diffDays: 0,
      isToday: false,
      isPast: false,
      isFuture: false,
      label: '已按期达成',
      shortBadge: '已完成',
      urgency: 'done',
    };
  }

  const todayStr = getTodayDateString();
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [targetY, targetM, targetD] = targetDateStr.split('-').map(Number);

  const today = new Date(tY, tM - 1, tD);
  const target = new Date(targetY, targetM - 1, targetD);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((target.getTime() - today.getTime()) / msPerDay);

  if (diffDays === 0) {
    return {
      diffDays: 0,
      isToday: true,
      isPast: false,
      isFuture: false,
      label: '今日即是目标日！',
      shortBadge: '今日到期',
      urgency: 'critical',
    };
  }

  if (diffDays > 0) {
    let urgency: CountdownDiff['urgency'] = 'normal';
    if (diffDays <= 3) urgency = 'critical';
    else if (diffDays <= 7) urgency = 'warning';

    return {
      diffDays,
      isToday: false,
      isPast: false,
      isFuture: true,
      label: `还剩 ${diffDays} 天`,
      shortBadge: `${diffDays}天后`,
      urgency,
    };
  }

  return {
    diffDays,
    isToday: false,
    isPast: true,
    isFuture: false,
    label: `已过去 ${Math.abs(diffDays)} 天`,
    shortBadge: `逾期${Math.abs(diffDays)}天`,
    urgency: 'past',
  };
}

/**
 * Recommended milestone presets that users can quickly add with 1 click
 */
export const PRESET_MILESTONES: Array<{
  title: string;
  stage: string;
  offsetDays: number;
  category: MovingTask['category'];
  tips: string;
}> = [
  {
    title: '提前预约搬家公司 / 货拉拉货运',
    stage: 'T-3',
    offsetDays: -3,
    category: 'booking',
    tips: '提前锁定车牌与货车师傅，确认是否有超重搬楼附加费及装卸停车费。',
  },
  {
    title: '旧屋退房清理 / 深度交接保洁',
    stage: 'T-1',
    offsetDays: -1,
    category: 'cleaning',
    tips: '将厨房油污、卫浴毛发清扫干净，垃圾全部打包下楼扔掉，大幅降低房东扣押金口实。',
  },
  {
    title: '新家更换门锁锁芯 / 安装便携阻门器',
    stage: 'D-Day',
    offsetDays: 0,
    category: 'security',
    tips: '前租客、中介、保洁可能私自留存钥匙，入住当天换上全新超B/C级锁芯或智能锁最安心。',
  },
  {
    title: '宽带移机申请 / 运营商宽带开通',
    stage: 'T-7',
    offsetDays: -7,
    category: 'admin',
    tips: '联系电信/联通/移动客服预约师傅上门穿线，避免入住新房前几天处于断网断线状态。',
  },
  {
    title: '原房东退租验房与结清退押金',
    stage: 'D-Day',
    offsetDays: 0,
    category: 'admin',
    tips: '当面结清最后一笔水电燃气，核对房屋钥匙，签署退租凭据并现场接收押金原路返还。',
  },
];
