import React, { useState } from 'react';
import {
  X,
  Building,
  Home,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  Sparkles,
  MapPin,
  ClipboardList,
  Compass,
} from 'lucide-react';

interface PropertySourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  city?: string;
  onOpenAddWithSample?: (sampleData: any) => void;
}

export const PropertySourcesModal: React.FC<PropertySourcesModalProps> = ({
  isOpen,
  onClose,
  city = '杭州',
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'search_tips' | 'traps'>('channels');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl my-8 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">
                  优质房源从哪来？全渠道寻获地图与避坑指南
                </h2>
                <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                  实战避坑攻略
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                梳理房东直租、品牌自持、正规平台与线下地推真实渠道，防止遭遇虚假引流房源。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center border-b border-neutral-200 px-6 bg-white font-mono-code text-xs">
          {[
            { id: 'channels', label: '01 // 四大主力找房渠道对比' },
            { id: 'search_tips', label: '02 // 房东直租高效搜索口令' },
            { id: 'traps', label: '03 // 假房源三秒识别与避坑' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-rose-600 text-neutral-950 font-bold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs text-neutral-700 leading-relaxed">
          {/* TAB 1: Channels */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 渠道 1: 个人房东 / 业主转租 */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-sm text-neutral-900">
                        1. 房东直租 / 原租客转租 (性价比最高)
                      </span>
                    </div>
                    <span className="font-mono-code text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                      0 中介费 · 民用水电
                    </span>
                  </div>
                  <p className="text-neutral-600">
                    直接与业主签约，没有半个月到1个月的中介佣金，房租往往可按季度商量，水电按市政民用实缴。
                  </p>
                  <div className="space-y-1.5 border-t border-emerald-200/60 pt-2 text-[11px]">
                    <div className="font-semibold text-neutral-800">推荐去向：</div>
                    <ul className="list-disc list-inside space-y-1 text-neutral-600">
                      <li>
                        <strong>豆瓣租房小组</strong>：搜目标城市小组（如“杭州租房/豆瓣租房组”），搜索特定小区。
                      </li>
                      <li>
                        <strong>闲鱼二手转租</strong>：搜索「个人转租」「房东直租」，只看芝麻信用极好、个人发帖记录正常的房源。
                      </li>
                      <li>
                        <strong>小红书关键词检索</strong>：搜「{city} 房东直租 + 地铁站名」，避开批量发图无生活痕迹的中介。
                      </li>
                      <li>
                        <strong>小区现场门岗/物业</strong>：直接去心仪小区物业中心或保安亭询问“有无业主委托出租”，常常能拿到一手业主联系方式。
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 渠道 2: 链家/贝壳真房源 */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-sm text-neutral-900">
                        2. 贝壳找房 / 链家 (真实度与安全最高)
                      </span>
                    </div>
                    <span className="font-mono-code text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-bold">
                      真房源率 95%+ · 收中介费
                    </span>
                  </div>
                  <p className="text-neutral-600">
                    房产证及业主身份由平台预先核验，VR 带看和户型图尺寸最准。缺点需付约 35%~50% 月租的中介服务费。
                  </p>
                  <div className="space-y-1.5 border-t border-blue-200/60 pt-2 text-[11px]">
                    <div className="font-semibold text-neutral-800">实战建议：</div>
                    <ul className="list-disc list-inside space-y-1 text-neutral-600">
                      <li>用贝壳查看小区的真实租金中位数、同户型历史成交价，做到心中有数。</li>
                      <li>如果时间非常紧迫（7天内必须入住），直接约链家经纪人一口气看 3~4 套。</li>
                      <li>中介费一般可协商打 7~8 折，尤其是在淡季或整租大套房源时。</li>
                    </ul>
                  </div>
                </div>

                {/* 渠道 3: 集中式品牌长租公寓 */}
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-sm text-neutral-900">
                        3. 集中式品牌公寓 (省心管家/拎包入住)
                      </span>
                    </div>
                    <span className="font-mono-code text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-bold">
                      独门独卫 · 商业水电
                    </span>
                  </div>
                  <p className="text-neutral-600">
                    如自如、万科泊寓、龙湖冠寓、魔方公寓。整栋物业管理，保洁维修方便，智能门锁安全性高。
                  </p>
                  <div className="space-y-1.5 border-t border-purple-200/60 pt-2 text-[11px]">
                    <div className="font-semibold text-neutral-800">注意事项：</div>
                    <ul className="list-disc list-inside space-y-1 text-neutral-600">
                      <li>水电费多按商业标准（电费约 1.2~1.5元/度，夏季空调费用较高）。</li>
                      <li>留意服务费（部分平台加收每月 8%~10% 的房屋维护与保洁费）。</li>
                    </ul>
                  </div>
                </div>

                {/* 渠道 4: 极低预算与城中村租房 */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-sm text-neutral-900">
                        4. 城中村 / 自建房线下扫街 (几百到千元级)
                      </span>
                    </div>
                    <span className="font-mono-code text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                      线下直找 · 无中介
                    </span>
                  </div>
                  <p className="text-neutral-600">
                    各大城市地铁沿线城中村（如城东、城北自建房聚集区）。网上的房源基本都是二房东或假图，最好的办法是线下实地扫街。
                  </p>
                  <div className="space-y-1.5 border-t border-amber-200/60 pt-2 text-[11px]">
                    <div className="font-semibold text-neutral-800">线下找法：</div>
                    <ul className="list-disc list-inside space-y-1 text-neutral-600">
                      <li>下午 2 点~5 点到村口或主街，看房东门前贴的红纸条「单间出租、独立厨卫」。</li>
                      <li>直接拨打红纸条上的房东电话，当场看房并检查手机信号、窗户通风与电表读数。</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Search Tips */}
          {activeTab === 'search_tips' && (
            <div className="space-y-4">
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="font-bold text-neutral-900 text-sm flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-rose-600" />
                  <span>精准搜索房东直租的「黄金筛选口令」</span>
                </div>
                <p className="text-neutral-600">
                  在小红书、闲鱼、豆瓣搜索时，直接搜“租房”会被大量黑中介广告淹没。必须使用精准长尾词过滤：
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                    <div className="font-semibold text-neutral-800 text-[11px]">🎯 口令 A：抓真实业主</div>
                    <div className="font-mono-code text-rose-600 bg-rose-50 px-2 py-1 rounded text-[11px]">
                      [城市] + [小区名] + "一手房东" 或 "自己房子"
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      排除了中介用词“精装好房、随时看房”等套话。
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                    <div className="font-semibold text-neutral-800 text-[11px]">🎯 口令 B：抓真实工作调动转租</div>
                    <div className="font-mono-code text-rose-600 bg-rose-50 px-2 py-1 rounded text-[11px]">
                      [地铁站] + "工作变动" / "回老家" / "转租无中介费"
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      原租客因工作换城市急于拿回押金，往往愿意补贴几百元甚至赠送小家电。
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                    <div className="font-semibold text-neutral-800 text-[11px]">🎯 口令 C：排除合租中介套路</div>
                    <div className="font-mono-code text-rose-600 bg-rose-50 px-2 py-1 rounded text-[11px]">
                      "非中介" -自如 -长租 -青年公寓
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      利用负向词排查掉平台批量生成的推广帖。
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1">
                    <div className="font-semibold text-neutral-800 text-[11px]">🎯 口令 D：微信搜一搜小程序</div>
                    <div className="font-mono-code text-rose-600 bg-rose-50 px-2 py-1 rounded text-[11px]">
                      微信搜「业主直租」/「无中介租房」
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      有专门只认证业主产权证的去中介化小程序（如自如业主直租、暖房直租等）。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Traps & Red Flags */}
          {activeTab === 'traps' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>虚假引流房源特征（3 秒快速识破）</span>
                </div>
                <div className="space-y-2 text-neutral-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>超低租金配豪装图片</strong>：地段在核心地铁口，精装修带落地窗却只要 1000 元/月？
                      <span className="text-rose-700 block">
                        → 100% 是钓鱼假房源。打电话过去对方一定会说“这套刚被租走，附近还有一套我带你去看”。
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>看房前要求先转订金 / 查验费</strong>：
                      <span className="text-rose-700 block">
                        → 无论理由说得多么真切，只要没见到房东原件、没进门实地查验，任何提前索要定金的都是诈骗！
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>不给看房产证原件，催促立刻签字</strong>：
                      <span className="text-rose-700 block">
                        → 必须严格核对房产证原件产权人姓名与房东身份证。如果是二房东，必须出示原房东委托书与原始租约。
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 58同城/安居客 接口与爬取限制深度剖析 */}
              <div className="p-4 rounded-xl border border-neutral-300 bg-neutral-50/80 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-900">
                  <Building className="w-4 h-4 text-neutral-700" />
                  <span>关于「能否直接强制调用 58同城/安居客 房源接口」的专业说明</span>
                </div>
                <div className="space-y-1.5 text-neutral-600 text-[11px] leading-relaxed">
                  <p>
                    <strong>1. 无公共开放接口</strong>：58同城属于封闭商业分类平台，从未提供面向第三方的免费公开 OpenAPI。其 App 和网页的内部接口均使用动态签名、会话鉴权和高频滑动验证码保护。
                  </p>
                  <p>
                    <strong>2. 严格的 WAF 反爬机制与 CORS 限制</strong>：浏览器端存在跨域安全策略（CORS），任何在前端直接请求 58.com 的操作都会被浏览器底层拒绝；若通过服务器强行批量爬取，会立即被 58 的风控系统封锁 IP。
                  </p>
                  <p>
                    <strong>3. 房源真实度风险</strong>：58同城依赖中介端口费，平台上存在大量低价引流钓鱼房源。即使机械爬取下来，虚假数据也会严重污染预算决策与通勤评估。
                  </p>
                  <p className="text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                    <strong>✅ 最佳实用解决方案</strong>：用户在 58同城或安居客浏览时，只需点击「分享 → 复制文本/链接」，随后直接在系统的「智能粘贴解析」中粘贴，系统会秒级剔除营销废话、精准抽取租金、户型与小区底数，既合规安全，又杜绝被封 IP！
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-neutral-500 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-neutral-400" />
            <span>在外部平台找到心仪房源后，可在本系统点击「+ 录入房源」或「智能粘贴解析」统一比选</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors shadow-xs"
          >
            知道了，返回房源对比
          </button>
        </div>
      </div>
    </div>
  );
};
