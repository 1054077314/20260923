export type PlanStatus = 'planning' | 'inspecting' | 'deciding' | 'signed' | 'moved_in' | 'archived';

/**
 * 房源来源。决定字段可信度与展示口径：
 *  - snapshot58: 58 网页快照，字段来自真实页面，缺失即缺失
 *  - ai_search : 大模型联网检索，需标注来源链接
 *  - manual    : 用户手动录入
 *  - template  : 预设模板默认数据
 * 来源一律写这个字段，禁止靠 notes 字符串反推。
 */
export type ListingSource = 'snapshot58' | 'ai_search' | 'manual' | 'template';

/** 坐标来源：coordinates 的出处，unknown 表示从未解析成功 */
export type CoordinateSource = 'explicit' | 'amap' | 'local_dict' | 'geocache' | 'unknown';

export type RoomType =
  | 'single_shared' // 合租单间(共卫)
  | 'master_shared' // 合租主卧(独卫)
  | 'studio' // 单身公寓/开间
  | 'one_bedroom' // 一室一厅
  | 'two_bedroom' // 两室一厅
  | 'other'; // 其他户型

export type LandlordType =
  | 'direct_landlord' // 房东直租
  | 'intermediary' // 正规中介
  | 'brand_apartment' // 品牌长租公寓
  | 'sublessor' // 二房东/转租
  | 'unknown'; // 来源未标明，待核实

export type UtilitiesType = 'residential' | 'commercial' | 'unknown'; // 民水民电 vs 商水商电 vs 待核实

export interface BudgetConfig {
  monthlyIncome: number; // 月收入
  otherIncome?: number; // 其他月收入 (元)
  recommendedRentRatio: number; // 建议租金占比 (如0.3)
  maxMonthlyRent: number; // 月租金预算上限
  estimatedBaseRent?: number; // 预计实际月租金 (元)
  estimatedUtilities?: number; // 预估每月水电燃气杂费 (元)
  estimatedPropertyInternet?: number; // 预估每月物业与宽带费 (元)
  estimatedOtherMonthly?: number; // 预估其他必须月度固定杂费 (元)
  otherMonthlyExpenses?: number; // 其他月开销 (餐饮交通日常等) (元)
  depositMonths: number; // 押几个月 (默认1)
  payMonths: number; // 付几个月 (默认1或3)
  agencyFeeAmount?: number; // 中介费金额 (元)
  agencyFeeRate: number; // 中介费比例 (如 0, 0.35, 0.5, 1.0)
  movingBudget: number; // 预估搬家费
  initialSuppliesBudget: number; // 初期日用品购置费
  roomType: RoomType;
  preferredDistricts: string[];
  workplace: string;
  maxCommuteMinutes: number;
  mustHaves: string[]; // 必选硬性要求
  niceToHaves: string[]; // 加分项
  dealBreakers: string[]; // 一票否决项
}

export interface CandidateRating {
  priceValue: number; // 租金性价比 (0-10)
  commute: number; // 通勤便利度 (0-10)
  lightingVentilation: number; // 采光通风 (0-10)
  soundproof: number; // 隔音静音 (0-10)
  spaceLayout: number; // 户型空间与收纳 (0-10)
  surroundings: number; // 周边配套与安全 (0-10)
  hygieneSafety: number; // 房况卫生成色 (0-10)
}

export interface CandidateProperty {
  id: string;
  title: string;
  community: string;
  address: string;
  subwayStation: string;
  walkToSubwayMin?: number; // 真实值（58 快照可能为 null，禁止编造默认值）
  commuteMinutes?: number; // 仅为历史/手动录入数据保留；真实耗时以运行时路线规划为准
  areaSqMeters: number;
  floor: string; // 比如 "6F/18F 电梯"
  rent: number; // 月租金
  utilitiesType: UtilitiesType;
  extraMonthlyFees: {
    propertyFee: number;
    internetFee: number;
    waterElectricityEst: number;
    cleaningFee: number;
    other: number;
  };
  landlordType: LandlordType;
  depositTerms: string;
  ratings: CandidateRating;
  pros: string[];
  cons: string[];
  notes: string;
  contactName: string;
  contactPhone: string;
  inspectionStatus: 'pending' | 'scheduled' | 'visited' | 'rejected' | 'shortlisted';
  inspectionDate?: string;
  checklistResults: Record<string, boolean>; // checklistId -> passed/checked
  weightedScore?: number; // 计算得分
  isPinned?: boolean; // 高亮优选置顶
  coordinates?: {
    lat: number;
    lng: number;
  };
  coordinateSource?: CoordinateSource; // coordinates 的出处，未解析为 unknown
  source?: ListingSource; // 房源来源，缺省按 manual 处理
  sourceUrl?: string; // 原始挂牌/检索链接
  sourcePlatform?: string; // 来源平台名（58同城 / 贝壳找房 / 豆瓣租房 …）
  amenities?: string[]; // 配套设施 如 ['独立卫浴', '燃气厨房', '阳台晾晒', '洗衣机', '冰箱', '空调', '智能门锁', '集中供暖', '带电梯', '停车位']
  neighborhoodInfo?: {
    lastQueried?: string;
    summary?: string;
    sources?: { title: string; url: string }[];
  };
}

export interface EvaluationWeights {
  priceValue: number; // 百分比总和100
  commute: number;
  lightingVentilation: number;
  soundproof: number;
  spaceLayout: number;
  surroundings: number;
  hygieneSafety: number;
}

export interface InspectionCheckItem {
  id: string;
  title: string;
  detail: string;
  isCritical: boolean; // 是否严重避坑项
}

export interface InspectionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  items: InspectionCheckItem[];
}

export interface ContractCheckItem {
  id: string;
  title: string;
  category: 'id_verification' | 'deposit' | 'maintenance' | 'break_lease' | 'handover';
  description: string;
  checked: boolean;
  notes?: string;
}

export type MovingStage =
  | 'T-14'
  | 'T-7'
  | 'T-3'
  | 'T-1'
  | 'D-Day'
  | 'D+1'
  | 'D+3'
  | 'custom'
  | string;

export interface MovingTask {
  id: string;
  title: string;
  stage: MovingStage;
  completed: boolean;
  tips?: string;
  isMilestone?: boolean; // 是否设为重要倒计时节点 / 里程碑
  offsetDays?: number; // 相对入住日期的偏移天数 (如 -7, -3, -1, 0, 1)
  dueDate?: string; // 明确指定的公历目标日期 (YYYY-MM-DD)
  category?: 'booking' | 'cleaning' | 'security' | 'packing' | 'admin' | 'other';
}

export interface HandoverRecord {
  waterMeter: string; // 水表读数
  electricMeter: string; // 电表读数
  gasMeter: string; // 燃气读数
  keysCount: number; // 钥匙门禁卡数量
  applianceInventory: { name: string; condition: string; checked: boolean }[];
  remarks: string;
}

export interface MonthlyExpense {
  id: string;
  month: string; // '2026-10'
  rent: number;
  electricity: number;
  water: number;
  gas: number;
  property: number;
  internet: number;
  other: number;
  note: string;
}

export interface RentalPlan {
  id: string;
  name: string;
  city: string;
  targetDate: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  isTemplate?: boolean;
  templateCategory?: string;
  templateDescription?: string;

  budget: BudgetConfig;
  candidates: CandidateProperty[];
  weights: EvaluationWeights;
  inspectionCategories: InspectionCategory[];
  contractChecklist: ContractCheckItem[];
  handoverRecord: HandoverRecord;
  movingTasks: MovingTask[];
  monthlyExpenses: MonthlyExpense[];
}

export interface PlanTemplate {
  id: string;
  name: string;
  tag: string;
  description: string;
  badgeColor: string;
  defaultData: Omit<RentalPlan, 'id' | 'createdAt' | 'updatedAt'>;
}
