/* Run: node tests/search-precision.cjs. Uses the actual shipped regulation index. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Search = require('../assets/search-engine.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../index-data.json'), 'utf8'));
const engine = Search.create(data);
const cases = [
  {query: '卸压钻孔 间距', doc: 'GB_T_25217_10_2019', clause: '4.4.1', rank: 1},
  {query: '应力监测 传感器', doc: 'GB_T_25217_7_2019', clause: '4.2.3.1', rank: 1},
  {query: '应力监测 传感器', doc: '2026防冲细则', clause: '第六十条', rank: 3},
  {query: '大直径卸压钻孔间距', doc: '陕西防冲规定', clause: '第四十七条', rank: 1},
  {query: '微震监测 备用电源', doc: 'GB_T_25217_4_2019', clause: '3.1', rank: 1},
  {query: '地音监测', doc: 'GB_T_25217_5_2019', clause: '4.1', rank: 1},
  {query: '煤层卸压爆破', doc: 'GB_T_25217_11_2019', clause: '3.1', rank: 1},
  {query: '顶板深孔爆破', doc: 'GB_T_25217_13_2019', clause: '5.6', rank: 1},
  {query: '大直径 150mm', doc: '陕西防冲规定', clause: '第四十七条', rank: 1},
  {query: '100J', doc: 'GB_T_25217_4_2019', clause: '2.1', rank: 3},
];
const report = [];
for (const example of cases) {
  const found = engine.search(example.query);
  const rank = found.items.findIndex(i => i.record.doc === example.doc && i.record.clause === example.clause) + 1;
  assert(rank > 0 && rank <= example.rank, `${example.query}: expected ${example.doc} ${example.clause} within top ${example.rank}, got ${rank}`);
  report.push({query: example.query, expected: `${example.doc} ${example.clause}`, rank, results: found.items.length});
}

// File codes are filters; citing another standard never changes the selected file.
for (const [query, doc] of [['KA 38-2026', 'KA38'], ['KA38', 'KA38'], ['GB/T 25217.10', 'GB_T_25217_10_2019'], ['GB/T 25217.1-2010', 'GB_T_25217_1_2010']]) {
  const found = engine.search(query).items;
  assert(found.length > 0 && found.every(i => i.record.doc === doc), query);
}
assert.equal(engine.search('KA 38-2025').items.length, 0);
assert.equal(engine.search('KA 99-2026').items.length, 0);
const located = engine.search('KA 38-2026 4.4').items;
assert.equal(located.length, 1);
assert.equal(located[0].record.clause, '4.4');
assert.deepEqual([...new Set(located[0].records.map(r => r.page))], [6, 7]);

// Article identity is exact, accepts Arabic numerals, and retains continuation pages.
for (const query of ['第47条', '第四十七条']) {
  const found = engine.search(query).items;
  assert.equal(found.length, 3);
  assert(found.every(i => i.record.clause === '第四十七条'));
}
const scoped = engine.search('2026防冲细则 第47条').items;
assert.equal(scoped.length, 1);
assert.equal(scoped[0].record.doc, '2026防冲细则');
const shaanxi = engine.search('大直径卸压钻孔间距').items;
assert.equal(shaanxi.length, 1);
assert.deepEqual(shaanxi[0].records.map(r => r.page), [14, 15]);

// A title match or a single common character cannot satisfy a missing concept.
for (const query of ['应力监测 原子钟', '量子纠缠 钻孔', '卸压钻孔 火星基地']) assert.equal(engine.search(query).items.length, 0, query);
assert.equal(engine.search('应力监测', {scope: 'GB_T_25217_5_2019'}).items.length, 0);
assert(engine.search('钻孔', {category: '地方规定'}).items.every(i => i.record.doc === '陕西防冲规定'));

// Quotes lock a phrase and do not trigger document navigation.
const phrase = engine.search('"煤层卸压爆破"').items;
assert(phrase.length > 0 && phrase.every(i => Search.norm(i.text).includes('煤层卸压爆破')));
assert(phrase.length < engine.search('煤层卸压爆破').items.length);
assert.deepEqual(engine.search('"煤矿安全规程"').plan.docIds, []);

// Explicit expansion keeps every other constraint and labels the alternative wording.
const expanded = engine.search('大孔径 钻孔 间距', {mode: 'expanded'}).items;
assert(expanded.some(i => i.record.doc === '陕西防冲规定' && i.record.clause === '第四十七条' && i.label === '扩展术语'));
assert.equal(engine.search('大孔径 钻孔 间距 原子钟', {mode: 'expanded'}).items.length, 0);

// Units, decimals and section numbers are not interchangeable substrings.
const fixture = Search.create({docs: [{id: 'test', name: '单位核对', code: 'TEST', category: '标准'}], records: [
  {id: 'one', doc: 'test', page: 3, clause: '1.2', text: '微震能量100 J，间距1.5 m。'},
  {id: 'two', doc: 'test', page: 4, clause: '12', text: '能量1100J，间距15m。'},
  {id: 'three', doc: 'test', page: 5, clause: '1.3', text: '能量1000J。'},
]});
assert.equal(fixture.entries.length, 3);
assert.deepEqual(fixture.search('100J').items.map(i => i.record.id), ['one']);
assert.deepEqual(fixture.search('100 J').items.map(i => i.record.id), ['one']);
assert.deepEqual(fixture.search('1.5m').items.map(i => i.record.id), ['one']);
assert.deepEqual(fixture.search('1.5 m').items.map(i => i.record.id), ['one']);
assert.deepEqual(fixture.search('1.2').items.map(i => i.record.id), ['one']);
const text = '监测能量大于100 J；应力\n监测设备。';
assert.deepEqual(Search.ranges(text, ['100J', '应力监测']).map(([s, e]) => text.slice(s, e)), ['100 J', '应力\n监测']);

const formulas = engine.search('公式').items;
assert(formulas.length > 0 && formulas.every(i => i.record.formulaImage));
const incident = engine.search('采动应力监测设备未按规定安装；监测数据未及时上传；爆破卸压后未开展效果检验。', {descriptive: true});
assert.equal(incident.plan.statements.length, 3);
assert(incident.items.length > 0);
console.log(JSON.stringify({labeledQueries: report, exactFileAndArticleFilters: true, crossPageGrouping: true, missingConceptsRejected: true, numericBoundaries: true, originalFormulaImages: true, multipleIncidentStatements: true}, null, 2));
