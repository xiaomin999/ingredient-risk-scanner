/* 输出「成分清单」Markdown 表格到 stdout，供 README 使用（保证与 db.js 一致）。
 * 运行：node scripts/gen-readme.js */
const { RISK_DB } = require('../js/db.js');
const { RISK_TAGS, RISK_TAG_MAP } = require('../js/risk-tags.js');

const CAT = { food: '食品', skincare: '护肤品', cosmetic: '化妆品', contact: '食品接触' };
const ORDER = { high: 0, medium: 1, low: 2 };
const riskLabel = r => (r === 'high' ? '🔴 高' : r === 'medium' ? '🟠 中' : '🟡 低');

const sorted = RISK_DB.slice().sort((a, b) => ORDER[a.risk] - ORDER[b.risk]);
let out = '';
sorted.forEach(e => {
  const tags = (RISK_TAG_MAP[e.id] || []).map(t => (RISK_TAGS[t] ? RISK_TAGS[t].label : '')).filter(Boolean).join('、');
  const cats = e.category.map(c => (CAT[c] || c)).join(' / ');
  out += `| ${e.name} | ${riskLabel(e.risk)} | ${cats} | ${e.type} | ${tags} | ${e.source} |\n`;
});
process.stdout.write(out);
