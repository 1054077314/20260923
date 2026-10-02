// 大模型提示词集中管理：业务模块只传参，不再内联大段文本。

export interface AmenitiesPromptInput {
  city: string;
  community: string;
  address: string;
}

export function amenitiesPrompt({ city, community, address }: AmenitiesPromptInput): string {
  return `请针对中国城市【${city || '该城市'}】的房源小区【${community || address}】（地址：${address || community}），检索真实最新的周边生活配套设施和租客生活评价。

请按以下清晰的分类输出详细、客观真实的周边配套分析报告（使用规范的 Markdown 格式输出）：

### 1. 轨道交通与通勤出行
- 距离最近的地铁站名称、途经线路、最近出入口及步行/骑行预估耗时
- 附近核心公交线路、打车便利度及早晚高峰路况概况

### 2. 商超购物与农贸生鲜
- 步行5-15分钟内的大型商业综合体/购物中心、大型生鲜超市（如盒马、山姆、大润发、沃尔玛、永辉等）
- 便民农贸菜市场、便利店（如美宜佳、7-Eleven、全家等）分布情况

### 3. 餐饮美食与烟火生活圈
- 楼下及周边街区餐饮、小吃街、夜市烟火气丰富程度
- 外卖配送覆盖面（快餐、咖啡奶茶、夜宵）便利度

### 4. 医疗健康与生活便民
- 附近的社区卫生服务中心、三甲公立医院及就医车程
- 快递收发（菜鸟驿站/丰巢快递柜位置）、药店、24小时自修室/健身房及公园绿地

### 5. 实地看房与租客避坑关键预警
- 潜在外界噪音源（是否临近高架桥、铁路、快速路主干道、施工工地或嘈杂夜市街）
- 小区停车位配比是否紧张、老旧小区无电梯/电梯维护状况、物业管理口碑
- 真实租客常吐槽的居住痛点

请只基于真实检索到的信息回答，不确定的项如实说明未查到。`;
}

export interface LiveListingsPromptInput {
  city: string;
  district: string;
  subwayStation: string;
  budgetMin: number;
  budgetMax: number;
  roomType: string;
  keywords: string;
}

export function liveListingsPrompt(input: LiveListingsPromptInput): string {
  const { city, district, subwayStation, budgetMin, budgetMax, roomType, keywords } = input;
  const locationSpec = [city, district, subwayStation].filter(Boolean).join(' ');
  return `你是一个专业的全网房源抓取与检索引擎。请实时检索中国【${city}】地区（位置/地铁站：${locationSpec}，月预算：${budgetMin}~${budgetMax}元，户型：${roomType}，偏好：${keywords}）当前最新的真实租房挂牌信息（覆盖58同城、安居客、贝壳找房、链家、自如、豆瓣租房小组、闲鱼转租等渠道）。

请检索并提取 4 至 6 套当前区域符合预算的真实/近期房源清单。
（下例仅示意键名、枚举与数字类型，数值请填真实检索结果，不得照抄。）

必须在回复末尾提供一个标准的 JSON 代码块，严格遵循如下格式（不要修改键名）：
\`\`\`json
[
  {
    "title": "房源标题（如：翠苑一区 朝南主卧独卫 带阳台）",
    "community": "小区名称（如：翠苑一区）",
    "address": "地址信息（如：西湖区文一路304号）",
    "rent": 2400,
    "areaSqMeters": 25,
    "floor": "5F/6F 楼梯",
    "subwayStation": "最近地铁站（如：2号线古翠路站）",
    "walkToSubwayMin": 6,
    "commuteMinutes": 25,
    "landlordType": "direct_landlord",
    "utilitiesType": "residential",
    "depositTerms": "押一付一",
    "pros": ["距地铁300米", "民用水电", "带阳台"],
    "cons": ["老小区无电梯"],
    "sourcePlatform": "58同城",
    "notes": "房东直租无中介费，看房需提前预约"
  }
]
\`\`\`

注意：
1. landlordType 只能是 "direct_landlord" (房东直租), "intermediary" (正规中介/经纪人), "brand_apartment" (品牌长租公寓), "sublessor" (个人转租) 之一。
2. utilitiesType 只能是 "residential" (民用水电) 或 "commercial" (商业水电)。
3. rent、areaSqMeters、walkToSubwayMin、commuteMinutes 必须为数字类型。
4. sourcePlatform 标明来源渠道，如 "58同城"、"贝壳找房"、"豆瓣租房"、"安居客"、"自如"、"闲鱼转租" 等。`;
}
