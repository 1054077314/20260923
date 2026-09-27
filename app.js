const KEY = 'rent-planner-v1';

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? n : 0;
};
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yuan = (n) => '¥' + Math.round(n).toLocaleString('en-US');
const $ = (s) => document.querySelector(s);

const DIMENSIONS = [
  { key: 'price', label: '性价比', hint: '租金相对表内其他房源' },
  { key: 'commute', label: '通勤', hint: '单程时长自动折算' },
  { key: 'condition', label: '房况', hint: '装修新旧、家具家电' },
  { key: 'light', label: '采光', hint: '朝向、楼层、通风' },
  { key: 'noise', label: '安静', hint: '临街噪音、邻居' },
  { key: 'facility', label: '配套', hint: '超市、餐饮、地铁公交' }
];

const CHECKLIST_PRESETS = [
  { category: '房屋状况', items: [
    '墙面、地面无破损渗水',
    '门窗完好,纱窗齐全',
    '锁具安全(可自行换芯)',
    '家电家具可正常使用并拍照留证',
    '马桶、地漏下水通畅',
    '水压正常,热水稳定'
  ] },
  { category: '环境安全', items: [
    '楼道照明与卫生状况良好',
    '无明显噪音源(马路/工地/夜市)',
    '门禁、监控完好',
    '小区安保与物业规范'
  ] },
  { category: '生活便利', items: [
    '早晚高峰通勤实测过',
    '附近有超市/菜市场/药店',
    '外卖、快递可正常送达',
    '手机信号良好,宽带可安装'
  ] },
  { category: '费用确认', items: [
    '水电燃气单价与缴费方式清楚',
    '物业费、网费承担方式明确',
    '押金退还条件写进合同',
    '抄录水电气表底数并拍照'
  ] },
  { category: '合同条款', items: [
    '核验房东身份证与产权(或转租授权)',
    '提前退租与转租条款清楚',
    '维修责任划分明确(谁修谁出钱)',
    '续租涨幅有无约定',
    '押金、租金支付留有收据'
  ] }
];

const PHASES = ['准备', '找房', '看房', '签约', '入住', '其他'];

const TIMELINE_PRESETS = [
  ['准备', '定下预算上限与硬性需求(整租/合租、通勤上限、家具需求)'],
  ['准备', '圈定 2-3 个意向区域'],
  ['准备', '现住房退租通知并确认最后租期'],
  ['找房', '平台筛选并收藏房源'],
  ['找房', '联系中介/房东约看房时间'],
  ['找房', '候选房源录入「房源对比」'],
  ['看房', '按「看房清单」实勘打分'],
  ['看房', '不同时间段再看一次(噪音/治安)'],
  ['看房', '实测通勤线路与耗时'],
  ['签约', '核验房东身份与产权(或转租授权)'],
  ['签约', '比价议价、确认费用明细'],
  ['签约', '逐条确认押金/退租/维修条款'],
  ['签约', '表底数与家具状况拍照留证'],
  ['签约', '签约付款并保留收据'],
  ['入住', '预约搬家公司/打包'],
  ['入住', '结算水电燃气并过户'],
  ['入住', '更换门锁或加装插销'],
  ['入住', '报装宽带、更新收货地址']
];

const emptyListing = () => ({
  id: uid(), name: '', district: '', layout: '', area: '', rent: '',
  property: '', utils: '', other: '', deposit: 1, pay: 1, agency: '',
  minutes: '', ccost: '', cond: 3, light: 3, noise: 3, fac: 3,
  floor: '', note: ''
});

const defaultChecklist = () => {
  const rows = [];
  CHECKLIST_PRESETS.forEach((g) => g.items.forEach((label) => {
    rows.push({ id: uid(), category: g.category, label, done: false, custom: false });
  }));
  return rows;
};

const defaultTimeline = () => TIMELINE_PRESETS.map(([phase, label]) => ({
  id: uid(), phase, label, date: '', done: false
}));

const defaults = {
  budget: {
    income: '', extra: '', ratio: 30, utilities: '', monthly: '',
    payMonths: 3, agency: '', misc: '',
    spendCap: '', commuteLimit: '', workDays: 22, timeValue: ''
  },
  weights: { price: 25, commute: 25, condition: 15, light: 15, noise: 10, facility: 10 },
  commute: [
    { id: uid(), area: '候选区域 A', minutes: 35, mode: '地铁', cost: 200, note: '' },
    { id: uid(), area: '候选区域 B', minutes: 55, mode: '公交+步行', cost: 120, note: '' }
  ],
  listings: [
    Object.assign(emptyListing(), {
      name: '房源 1 (示例)', district: '朝阳 · 望京', layout: '一室一厅',
      area: 25, rent: 3200, property: 150, utils: 200, other: 0,
      deposit: 1, pay: 3, agency: 1600, minutes: 40, ccost: 200,
      cond: 3, light: 4, noise: 3, fac: 4, floor: '中层/朝南', note: ''
    }),
    Object.assign(emptyListing(), {
      name: '房源 2 (示例)', district: '昌平 · 回龙观', layout: '合租次卧',
      area: 18, rent: 2700, property: 0, utils: 150, other: 80,
      deposit: 1, pay: 1, agency: 0, minutes: 60, ccost: 150,
      cond: 3, light: 3, noise: 3, fac: 3, floor: '高层/朝东', note: ''
    })
  ],
  checklist: defaultChecklist(),
  timeline: defaultTimeline()
};

function normalize(saved) {
  return {
    budget: Object.assign({}, defaults.budget, saved.budget || {}),
    weights: Object.assign({}, defaults.weights, saved.weights || {}),
    commute: Array.isArray(saved.commute) ? saved.commute : defaults.commute,
    listings: Array.isArray(saved.listings) ? saved.listings : defaults.listings,
    checklist: Array.isArray(saved.checklist) && saved.checklist.length ? saved.checklist : defaultChecklist(),
    timeline: Array.isArray(saved.timeline) && saved.timeline.length ? saved.timeline : defaultTimeline()
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* 损坏数据则回退默认 */ }
  return JSON.parse(JSON.stringify(defaults));
}

let state = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

/* ---------------- tabs ---------------- */
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
});

/* ---------------- 01 预算 ---------------- */
const budgetFields = ['income', 'extra', 'ratio', 'utilities', 'monthly', 'payMonths', 'agency', 'misc',
  'spendCap', 'commuteLimit', 'workDays', 'timeValue'];

function renderBudgetInputs() {
  budgetFields.forEach((f) => { document.getElementById(f).value = state.budget[f]; });
}

function avgListingRent() {
  const rows = state.listings.filter((l) => num(l.rent) > 0);
  if (!rows.length) return 0;
  return rows.reduce((s, l) => s + num(l.rent), 0) / rows.length;
}

function calcBudget() {
  const b = state.budget;
  const income = num(b.income) + num(b.extra);
  const ratio = num(b.ratio) || 30;
  const rentCap = income * ratio / 100;
  const upfront = rentCap * 1 + rentCap * num(b.payMonths) + num(b.agency) + num(b.misc);
  const avg = avgListingRent();
  const rentRef = avg > 0 ? avg : rentCap;
  const share = income > 0 ? rentRef / income * 100 : 0;
  const left = income - rentRef - num(b.utilities) - num(b.monthly);
  const year = (rentRef + num(b.utilities)) * 12;

  $('#out-rent').textContent = income > 0 ? yuan(rentCap) : '—';
  $('#out-upfront').textContent = income > 0 ? yuan(upfront) : '—';
  $('#out-share').textContent = income > 0 ? share.toFixed(1) + '%' : '—';
  $('#out-left').textContent = income > 0 ? yuan(left) : '—';
  $('#out-year').textContent = income > 0 ? yuan(year) : '—';

  const v = $('#out-verdict');
  if (income <= 0) {
    v.textContent = 'AWAITING INPUT // 填入收入后自动测算';
    return;
  }
  const src = avg > 0 ? ' 参考租金取自房源表均价 ' + yuan(avg) : ' 参考租金取自预算上限';
  let msg;
  if (share > 35) {
    msg = 'ALERT // 房租占比 ' + share.toFixed(1) + '%,超过 35% 警戒线,建议下调租金或提高收入。';
  } else if (left < income * 0.1) {
    msg = 'CAUTION // 结余不足收入 10%,预留应急空间。';
  } else {
    msg = 'CLEAR // 占比 ' + share.toFixed(1) + '% 在健康区间。';
  }
  const cap = num(b.spendCap);
  const capNote = cap > 0 ? ' 月度支出上限 ' + yuan(cap) + ',超线房源会在对比表打标。' : '';
  v.textContent = msg + src + capNote;
}

budgetFields.forEach((f) => {
  document.getElementById(f).addEventListener('input', (e) => {
    state.budget[f] = e.target.value;
    save();
    calcBudget();
    if (f === 'spendCap' || f === 'commuteLimit' || f === 'income' || f === 'workDays' || f === 'timeValue') {
      renderListings();
    }
  });
});

/* ---------------- 02 通勤 ---------------- */
function commuteRow(c) {
  return `<tr data-id="${c.id}">
    <td><input data-f="area" value="${esc(c.area)}" placeholder="区域 / 小区" /></td>
    <td class="num"><input data-f="minutes" type="number" min="0" value="${esc(c.minutes)}" /></td>
    <td><input data-f="mode" value="${esc(c.mode)}" placeholder="地铁 / 骑行…" /></td>
    <td class="num"><input data-f="cost" type="number" min="0" value="${esc(c.cost)}" /></td>
    <td><input data-f="note" value="${esc(c.note)}" placeholder="换乘次数、早晚高峰…" /></td>
    <td><button class="btn-del" data-act="cm-del">删除</button></td>
  </tr>`;
}

function renderCommute() {
  $('#commute-body').innerHTML = state.commute.map(commuteRow).join('');
  calcCommute();
}

function calcCommute() {
  const mins = state.commute.filter((c) => num(c.minutes) > 0).map((c) => num(c.minutes));
  const avg = mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : 0;
  const hours = mins.reduce((a, b) => a + b, 0) * 2 * num(state.budget.workDays || 22) / 60;
  const cost = state.commute.reduce((s, c) => s + num(c.cost), 0);
  $('#cm-avg').textContent = mins.length ? avg.toFixed(0) + ' 分钟' : '—';
  $('#cm-hours').textContent = mins.length ? hours.toFixed(0) + ' 小时' : '—';
  $('#cm-cost').textContent = yuan(cost);
}

$('#commute-body').addEventListener('input', (e) => {
  const tr = e.target.closest('tr');
  const item = state.commute.find((c) => c.id === tr.dataset.id);
  if (!item) return;
  item[e.target.dataset.f] = e.target.value;
  save();
  calcCommute();
});

$('#cm-add').addEventListener('click', () => {
  state.commute.push({ id: uid(), area: '', minutes: '', mode: '', cost: '', note: '' });
  save();
  renderCommute();
});

$('#commute-body').addEventListener('click', (e) => {
  if (e.target.dataset.act !== 'cm-del') return;
  const tr = e.target.closest('tr');
  state.commute = state.commute.filter((c) => c.id !== tr.dataset.id);
  save();
  renderCommute();
});

/* ---------------- 03 房源对比 ---------------- */
function listingMetrics(l) {
  const b = state.budget;
  const timeCost = num(l.minutes) > 0
    ? num(l.minutes) * 2 * num(b.workDays || 22) / 60 * num(b.timeValue)
    : 0;
  const monthly = num(l.rent) + num(l.property) + num(l.utils) + num(l.other) + num(l.ccost) + timeCost;
  const upfront = num(l.rent) * num(l.deposit) + num(l.rent) * num(l.pay) + num(l.agency);
  const year = monthly * 12 + num(l.agency);
  const income = num(b.income) + num(b.extra);
  const burden = income > 0 ? monthly / income * 100 : 0;
  const flags = [];
  if (num(b.spendCap) > 0 && monthly > num(b.spendCap)) flags.push(['over', '超预算']);
  if (num(b.commuteLimit) > 0 && num(l.minutes) > num(b.commuteLimit)) flags.push(['comm', '超通勤']);
  if (income > 0 && burden > 30) flags.push(['burden', '高负担']);
  return { timeCost, monthly, upfront, year, burden, flags };
}

function listingScores() {
  const rows = state.listings;
  const rents = rows.map((l) => num(l.rent)).filter((n) => n > 0);
  const mins = rows.map((l) => num(l.minutes)).filter((n) => n > 0);
  const minRent = rents.length ? Math.min.apply(null, rents) : 0;
  const minMin = mins.length ? Math.min.apply(null, mins) : 0;
  return rows.map((l) => {
    const s = {
      price: num(l.rent) > 0 && minRent ? minRent / num(l.rent) * 5 : null,
      commute: num(l.minutes) > 0 && minMin ? minMin / num(l.minutes) * 5 : null,
      condition: Math.min(num(l.cond) || 3, 5),
      light: Math.min(num(l.light) || 3, 5),
      noise: Math.min(num(l.noise) || 3, 5),
      facility: Math.min(num(l.fac) || 3, 5)
    };
    let sum = 0, wsum = 0;
    DIMENSIONS.forEach((d) => {
      const w = num(state.weights[d.key]);
      if (w > 0 && s[d.key] != null) { sum += w * s[d.key]; wsum += w; }
    });
    return { dims: s, total: wsum > 0 ? sum / wsum : 0 };
  });
}

function listingRow(l, sc) {
  const m = listingMetrics(l);
  const sub = [l.district, l.layout, num(l.area) > 0 ? l.area + '㎡' : ''].filter(Boolean).join(' · ');
  const burdenSub = m.burden > 0 ? `<div class="cell-sub">占收入 ${m.burden.toFixed(0)}%</div>` : '';
  const commuteSub = num(l.ccost) > 0 ? `<div class="cell-sub">交通 ${yuan(l.ccost)}/月</div>` : '';
  const flags = m.flags.length
    ? m.flags.map(([cls, txt]) => `<span class="flag ${cls}">${txt}</span>`).join('')
    : '<span class="flag-none">—</span>';
  return `<tr data-id="${l.id}">
    <td><div class="cell-name">${esc(l.name) || '(未命名)'}</div><div class="cell-sub">${esc(sub)}</div></td>
    <td class="cell-num">${num(l.rent) > 0 ? yuan(l.rent) : '—'}</td>
    <td class="cell-num">${m.monthly > 0 ? yuan(m.monthly) : '—'}${burdenSub}</td>
    <td class="cell-num">${yuan(m.upfront)}</td>
    <td class="cell-num">${num(l.minutes) > 0 ? l.minutes + ' 分' : '—'}${commuteSub}</td>
    <td>${flags}</td>
    <td><span class="score"></span></td>
    <td>
      <button class="btn-del" data-act="ls-edit">编辑</button>
      <button class="btn-del" data-act="ls-del">删除</button>
    </td>
  </tr>`;
}

function renderListings() {
  const sc = listingScores();
  $('#listing-body').innerHTML = state.listings.map((l, i) => listingRow(l, sc[i])).join('');
  paintScores();
}

function paintScores() {
  const sc = listingScores();
  const totals = sc.map((s) => s.total);
  const best = Math.max.apply(null, totals.concat([-1]));
  document.querySelectorAll('#listing-body tr').forEach((tr, i) => {
    const cell = tr.querySelector('.score');
    const top = totals[i] > 0 && totals[i] === best && state.listings.length > 1;
    cell.textContent = totals[i] > 0 ? totals[i].toFixed(1) : '—';
    cell.classList.toggle('dim', !top);
    tr.classList.toggle('top', top);
    let badge = tr.querySelector('.badge-top');
    if (top && !badge) {
      badge = document.createElement('span');
      badge.className = 'badge-top';
      badge.textContent = 'TOP PICK';
      cell.appendChild(badge);
    } else if (!top && badge) {
      badge.remove();
    }
  });
  calcBudget();
}

function renderWeights() {
  $('#weights').innerHTML = DIMENSIONS.map((d) => `
    <label class="weight-row">
      <span class="weight-name">${d.label} <b id="w-${d.key}-val">${num(state.weights[d.key])}</b></span>
      <input type="range" data-w="${d.key}" min="0" max="50" step="5" value="${num(state.weights[d.key])}" />
    </label>`).join('');
}

$('#weights').addEventListener('input', (e) => {
  const key = e.target.dataset.w;
  if (!key) return;
  state.weights[key] = num(e.target.value);
  document.getElementById('w-' + key + '-val').textContent = e.target.value;
  save();
  paintScores();
});

$('#ls-add').addEventListener('click', () => openModal(null));

$('#listing-body').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;
  if (e.target.dataset.act === 'ls-edit') {
    openModal(id);
  } else if (e.target.dataset.act === 'ls-del') {
    state.listings = state.listings.filter((l) => l.id !== id);
    save();
    renderListings();
  }
});

/* ---------- 房源编辑弹窗 ---------- */
const SCORE_SELECTS = [
  ['f-cond', 'cond'], ['f-light', 'light'], ['f-noise', 'noise'], ['f-fac', 'fac']
];
const FORM_FIELDS = ['name', 'district', 'layout', 'area', 'rent', 'property', 'utils', 'other',
  'deposit', 'pay', 'agency', 'minutes', 'ccost', 'cond', 'light', 'noise', 'fac', 'floor', 'note'];
let editingId = null;

function fillScoreSelects() {
  const labels = ['', '1 · 很差', '2 · 较差', '3 · 一般', '4 · 较好', '5 · 很好'];
  SCORE_SELECTS.forEach(([id]) => {
    document.getElementById(id).innerHTML = labels.map((t, n) =>
      n > 0 ? `<option value="${n}">${t}</option>` : '').join('');
  });
}

function openModal(id) {
  editingId = id;
  const l = id ? state.listings.find((x) => x.id === id) : emptyListing();
  FORM_FIELDS.forEach((f) => { document.getElementById('f-' + f).value = l[f] == null ? '' : l[f]; });
  $('#modal-tag').textContent = id ? 'EDIT RECORD' : 'NEW RECORD';
  $('#modal-title').textContent = id ? '编辑房源' : '添加房源';
  $('#f-delete').hidden = !id;
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
  editingId = null;
}

$('#modal-close').addEventListener('click', closeModal);
$('#f-cancel').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});

$('#f-save').addEventListener('click', () => {
  const data = {};
  FORM_FIELDS.forEach((f) => { data[f] = document.getElementById('f-' + f).value; });
  if (!String(data.name).trim()) {
    alert('请填写房源名称');
    return;
  }
  if (editingId) {
    Object.assign(state.listings.find((x) => x.id === editingId), data);
  } else {
    state.listings.push(Object.assign(emptyListing(), data, { id: uid() }));
  }
  save();
  renderListings();
  closeModal();
});

$('#f-delete').addEventListener('click', () => {
  if (!editingId) return;
  state.listings = state.listings.filter((l) => l.id !== editingId);
  save();
  renderListings();
  closeModal();
});

/* ---------------- 04 看房清单 ---------------- */
function renderChecklist() {
  const groups = CHECKLIST_PRESETS.map((g) => g.category);
  state.checklist.forEach((it) => { if (groups.indexOf(it.category) < 0) groups.push(it.category); });
  $('#checklist').innerHTML = groups.map((cat) => {
    const rows = state.checklist.filter((it) => it.category === cat);
    const done = rows.filter((it) => it.done).length;
    const items = rows.map((it) => `
      <div class="cl-item ${it.done ? 'done' : ''}" data-id="${it.id}">
        <button class="tl-check" data-act="cl-toggle">${it.done ? '✓' : ''}</button>
        <span class="cl-label">${esc(it.label)}</span>
        ${it.custom ? '<span class="cell-sub">自定义</span>' : ''}
        <button class="btn-del" data-act="cl-del">删除</button>
      </div>`).join('') || '<div class="cl-item"><span class="cl-label cell-sub">暂无项目</span></div>';
    return `<div class="cl-group">
      <div class="cl-head"><h4>${esc(cat)}</h4><span>${done} / ${rows.length}</span></div>
      ${items}
      <div class="cl-add">
        <input type="text" data-newcat="${esc(cat)}" placeholder="添加「${esc(cat)}」自定义检查项…" />
        <button class="btn-del" data-act="cl-add" data-cat="${esc(cat)}">添加</button>
      </div>
    </div>`;
  }).join('');
  calcChecklist();
}

function calcChecklist() {
  const total = state.checklist.length;
  const done = state.checklist.filter((it) => it.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('#cl-pct').textContent = pct + '%  (' + done + '/' + total + ')';
  $('#cl-bar').style.width = pct + '%';
}

$('#checklist').addEventListener('click', (e) => {
  const box = e.target.closest('.cl-item');
  const act = e.target.dataset.act;
  if (act === 'cl-add') {
    const input = document.querySelector('#checklist input[data-newcat="' + e.target.dataset.cat + '"]');
    const label = input && input.value.trim();
    if (!label) return;
    state.checklist.push({ id: uid(), category: e.target.dataset.cat, label, done: false, custom: true });
    save();
    renderChecklist();
    return;
  }
  if (!box) return;
  const item = state.checklist.find((it) => it.id === box.dataset.id);
  if (!item) return;
  if (act === 'cl-toggle') {
    item.done = !item.done;
    save();
    renderChecklist();
  } else if (act === 'cl-del') {
    state.checklist = state.checklist.filter((it) => it.id !== item.id);
    save();
    renderChecklist();
  }
});

$('#checklist').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.dataset.newcat) return;
  e.preventDefault();
  const btn = document.querySelector('#checklist button[data-act="cl-add"][data-cat="' + e.target.dataset.newcat + '"]');
  if (btn) btn.click();
});

$('#cl-reset').addEventListener('click', () => {
  if (!confirm('恢复预设清单将清空当前勾选与自定义项,继续?')) return;
  state.checklist = defaultChecklist();
  save();
  renderChecklist();
});

/* ---------------- 05 时间计划 ---------------- */
function tlRow(t) {
  const opts = PHASES.map((p) =>
    `<option value="${p}"${t.phase === p ? ' selected' : ''}>${p}</option>`).join('');
  return `<li data-id="${t.id}" class="${t.done ? 'done' : ''}">
    <button class="tl-check" data-act="toggle">${t.done ? '✓' : ''}</button>
    <select data-f="phase">${opts}</select>
    <input class="tl-label" data-f="label" value="${esc(t.label)}" placeholder="事项" />
    <input type="date" data-f="date" value="${esc(t.date)}" />
    <button class="btn-del" data-act="tl-del">删除</button>
  </li>`;
}

function renderTimeline() {
  $('#timeline-list').innerHTML = state.timeline.map(tlRow).join('');
  calcTimeline();
}

function calcTimeline() {
  const total = state.timeline.length;
  const done = state.timeline.filter((t) => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('#tl-pct').textContent = pct + '%  (' + done + '/' + total + ')';
  $('#tl-bar').style.width = pct + '%';
}

$('#timeline-list').addEventListener('input', (e) => {
  const li = e.target.closest('li');
  const item = state.timeline.find((t) => t.id === li.dataset.id);
  if (!item) return;
  item[e.target.dataset.f] = e.target.value;
  save();
});

$('#timeline-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const item = state.timeline.find((t) => t.id === li.dataset.id);
  if (!item) return;
  const act = e.target.dataset.act;
  if (act === 'toggle') {
    item.done = !item.done;
    save();
    li.classList.toggle('done', item.done);
    e.target.textContent = item.done ? '✓' : '';
    calcTimeline();
  } else if (act === 'tl-del') {
    state.timeline = state.timeline.filter((t) => t.id !== item.id);
    save();
    renderTimeline();
  }
});

$('#tl-add').addEventListener('click', () => {
  state.timeline.push({ id: uid(), phase: '其他', label: '', date: '', done: false });
  save();
  renderTimeline();
});

/* ---------------- 06 案例数据 ---------------- */
$('#case-load').addEventListener('click', () => {
  if (!confirm('载入案例数据将覆盖当前的房源与基准参数(清单与时间计划保留),继续?')) return;
  state.budget = Object.assign({}, state.budget, {
    income: 4000, extra: 0, ratio: 30, utilities: 0, monthly: 700,
    payMonths: 1, agency: 0, misc: 0,
    spendCap: 780, commuteLimit: 30, workDays: 22, timeValue: 0
  });
  state.weights = { price: 50, commute: 30, condition: 8, light: 4, noise: 4, facility: 4 };
  state.listings = [
    Object.assign(emptyListing(), {
      name: 'A · 过渡留守 500 现房', district: '现住房', layout: '现住单间',
      area: 20, rent: 500, other: 80, deposit: 0, pay: 0, agency: 0,
      minutes: 0, ccost: 0, cond: 2, light: 3, noise: 2, fac: 3,
      note: '过渡到 10 月底,债务缓过来再搬;有猫、居住体验差;首付 0'
    }),
    Object.assign(emptyListing(), {
      name: 'B · 合租次卧(地铁沿线)', district: '1 号线 小西门/南门/北门/铁路局', layout: '合租次卧',
      area: 15, rent: 650, other: 80, deposit: 1, pay: 1, agency: 0,
      minutes: 30, ccost: 0, cond: 3, light: 3, noise: 3, fac: 4,
      note: '首选:卡 700 上限 + 只签押一付一;9.20 看房、10.1 搬;室友隔音/卫生/作息当面确认'
    }),
    Object.assign(emptyListing(), {
      name: 'C · 合租主卧带卫', district: '1 号线沿线', layout: '合租主卧独卫',
      area: 22, rent: 900, other: 80, deposit: 1, pay: 1, agency: 0,
      minutes: 30, ccost: 0, cond: 4, light: 4, noise: 4, fac: 3,
      note: '否决:首付 1800+ 挤压 9 月还债(京东 678 + 花呗 516);转正涨薪后再升级'
    }),
    Object.assign(emptyListing(), {
      name: 'D · 整租一居室', district: '1 号线沿线', layout: '一室一厅',
      area: 40, rent: 1400, other: 80, deposit: 1, pay: 1, agency: 0,
      minutes: 35, ccost: 0, cond: 4, light: 4, noise: 5, fac: 3,
      note: '否决:月租翻倍 + 首付三倍,9–10 月现金流断裂'
    })
  ];
  save();
  renderAll();
  document.querySelector('.tab[data-tab="listings"]').click();
});

/* ---------------- 导入导出 ---------------- */
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rental-plan-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#btn-import').addEventListener('click', () => $('#file-import').click());

$('#file-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('导入将覆盖当前台账数据,继续?')) return;
      state = normalize(data);
      save();
      renderAll();
    } catch (err) {
      alert('文件解析失败,请确认是本工具导出的 JSON 备份');
    }
  };
  reader.readAsText(file);
});

$('#reset').addEventListener('click', () => {
  if (!confirm('确定清空所有数据并恢复默认?')) return;
  localStorage.removeItem(KEY);
  state = load();
  renderAll();
});

/* ---------------- cursor ---------------- */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.body.classList.add('cursor-on');
  const cursor = $('#cursor');
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mouseover', (e) => {
    cursor.classList.toggle('lens', !!e.target.closest('button, a, input, select, textarea, tr, li, .cl-item'));
  });
}

/* ---------------- init ---------------- */
function renderAll() {
  renderBudgetInputs();
  calcBudget();
  renderCommute();
  renderWeights();
  renderListings();
  renderChecklist();
  renderTimeline();
}

fillScoreSelects();
renderAll();
