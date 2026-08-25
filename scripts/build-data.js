/* 由 js/db.js + js/risk-tags.js 生成可远程更新的 JSON 数据文件（data/）。
 * 运行：node scripts/build-data.js
 * 用途：风险库维护者只需编辑 js/db.js（唯一数据源），推送后 GitHub Actions 会自动重新生成 data/*.json；
 *        App 运行时拉取 data/*.json，实现「远程可更新」而无需改动其他代码。 */
const fs = require('fs');
const path = require('path');
const { RISK_DB } = require('../js/db.js');
const { RISK_TAGS, RISK_TAG_MAP } = require('../js/risk-tags.js');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'ingredients.json'), JSON.stringify(RISK_DB));
fs.writeFileSync(path.join(dataDir, 'risk-tags.json'), JSON.stringify({ tags: RISK_TAGS, map: RISK_TAG_MAP }));

const version = {
  version: '1.0.0',
  updated: new Date().toISOString().slice(0, 10),
  count: RISK_DB.length
};
fs.writeFileSync(path.join(dataDir, 'db-version.json'), JSON.stringify(version));

console.log('Generated data/ingredients.json (' + RISK_DB.length + ' items), data/risk-tags.json, data/db-version.json');
