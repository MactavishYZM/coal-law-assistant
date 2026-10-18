/* Local full-text retrieval. The original regulation text is never rewritten here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CoalSearch = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const ignored = /[\s，。、；：！？!?,;:()（）《》<>【】\[\]"'“”‘’·—–_\/\\\-]/u;
  const norm = value => Array.from(String(value ?? '').normalize('NFKC').toLowerCase()).filter(c => !ignored.test(c)).join('');
  const words = (`冲击地压 冲击危险性 冲击倾向性 危险性 倾向性 防冲 微震 地音 钻屑 采动应力 应力 监测 检测 预警 临界值 阈值 传感器 应力计
    卸压区 卸压 钻孔 解危 爆破 深孔 顶板 底板 煤层 煤体 煤岩 岩层 大直径 大孔径 孔径 直径 孔间距 间距 深度 长度 角度 压力
    效果检验 效果评价 效果检测 检验 检测 评价 水压致裂 水力压裂 注水 保护层 保护范围 瓦斯 抽采 自燃 煤尘
    巷道 井巷 支护 锚杆 锚索 扩修 贯通 掘进 回采 工作面 煤柱 煤壁 断层 采空区 开采 复工复产 复工 复产
    布置 安装 设备 仪器 系统 数据 上传 监控 应急 撤人 撤离 停产 人员 距离 区域 参数 时效 周期 频率 能量 记录
    应当 必须 不得 不小于 不大于 大于 小于 未按 未及时 未开展 没有 未 不 按 及时 开展 进行 采用 设置 规定 要求
    是什么 有哪些 怎么 如何 多少 是否 什么 哪些 请问 查找 查询 搜索 检索 相关 有关 的 了 和 与 及 或者 以及`).split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  const stop = new Set('是什么 有哪些 怎么 如何 多少 是否 什么 哪些 请问 查找 查询 搜索 检索 相关 有关 的 了 和 与 及 或者 以及 规定 要求'.split(' '));
  const descriptionStop = new Set('应当 必须 不得 未按 未及时 未开展 没有 未 不 按 后 及时 开展 进行 采用 设置 设备 仪器 系统 数据'.split(' '));
  // Only explicit alternative terminology, used when the reader selects expansion.
  const aliases = [['大直径', '大孔径'], ['水压致裂', '水力压裂']];
  // Bind compound concepts. "采动应力影响范围内……地音监测" is not stress monitoring.
  // A dedicated standard supplies context only when all query words also occur in its body.
  const concepts = [
    {phrase: '应力监测', forms: ['应力监测', '应力在线监测']},
    {phrase: '微震监测', forms: ['微震监测']},
    {phrase: '地音监测', forms: ['地音监测']},
    {phrase: '钻屑监测', forms: ['钻屑监测', '钻屑法监测']},
    {phrase: '煤层卸压爆破', forms: ['煤层卸压爆破', '煤层爆破卸压']},
    {phrase: '顶板深孔爆破', forms: ['顶板深孔爆破', '顶板深孔预裂爆破']},
    {phrase: '卸压钻孔', forms: ['卸压钻孔', '钻孔卸压', '钻孔预卸压']},
    {phrase: '钻孔卸压', forms: ['卸压钻孔', '钻孔卸压', '钻孔预卸压']},
    {phrase: '卸压爆破', forms: ['卸压爆破', '爆破卸压']},
    {phrase: '爆破卸压', forms: ['卸压爆破', '爆破卸压']},
  ];
  const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter('zh-CN', {granularity: 'word'}) : null;

  function tokenize(value, descriptive = false) {
    const result = [];
    const keep = word => { if (word && !stop.has(word) && !(descriptive && descriptionStop.has(word))) result.push(word); };
    for (const chunk of value.normalize('NFKC').toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+(?:[.^]\d+)?(?:%|[a-z]+)?/gu) || []) {
      if (!/\p{Script=Han}/u.test(chunk)) { keep(chunk); continue; }
      for (let i = 0; i < chunk.length;) {
        const word = words.find(w => chunk.startsWith(w, i));
        if (word) { keep(word); i += word.length; continue; }
        let end = i + 1;
        while (end < chunk.length && !words.some(w => chunk.startsWith(w, end))) end++;
        const unknown = chunk.slice(i, end);
        const segments = segmenter ? [...segmenter.segment(unknown)].filter(s => s.isWordLike).map(s => s.segment) : [unknown];
        let singles = '';
        for (const part of segments) {
          if (part.length === 1) singles += part;
          else { keep(singles); singles = ''; keep(part); }
        }
        keep(singles);
        i = end;
      }
    }
    return [...new Set(result)];
  }

  function number(value) {
    if (/^\d+$/.test(value)) return Number(value);
    const digits = {零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9};
    let total = 0, digit = 0;
    for (const char of value) {
      if (char in digits) digit = digits[char];
      else if (char === '十' || char === '百' || char === '千') { total += (digit || 1) * ({十: 10, 百: 100, 千: 1000}[char]); digit = 0; }
      else return NaN;
    }
    return total + digit;
  }
  function articleKey(value) {
    const m = String(value).match(/^第([一二三四五六七八九十百千零〇两\d]+)条$/);
    return m ? 'article:' + number(m[1]) : 'section:' + norm(value);
  }
  function positions(text, term) {
    const found = [];
    for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + Math.max(1, term.length))) {
      // 100 J is a hit for 100J; 1100J and 1000J are different values.
      if (/^[a-z0-9]/.test(term) && /[a-z0-9]/.test(text[at - 1] || '')) continue;
      if (/[a-z0-9]$/.test(term) && /[a-z0-9]/.test(text[at + term.length] || '')) continue;
      found.push(at);
      if (found.length === 40) break;
    }
    return found;
  }
  function smallestSpan(hits) {
    const points = hits.flatMap((h, i) => h.positions.map(at => ({at, end: at + h.term.length, i}))).sort((a, b) => a.at - b.at);
    const counts = new Map();
    let left = 0, best = Infinity;
    for (let right = 0; right < points.length; right++) {
      counts.set(points[right].i, (counts.get(points[right].i) || 0) + 1);
      while (counts.size === hits.length && left <= right) {
        best = Math.min(best, Math.max(...points.slice(left, right + 1).map(p => p.end)) - points[left].at);
        const key = points[left++].i;
        counts.set(key, counts.get(key) - 1);
        if (!counts.get(key)) counts.delete(key);
      }
    }
    return best;
  }
  function role(entry, doc) {
    const text = entry.normalized;
    if (/^(?:\d+)?规范性引用文件/.test(text) || /^参考文献/.test(text)) return 'reference';
    if (/^(目次|目录|前言|引言|ics\d|ccs[a-z])/i.test(text) || (doc.category.includes('标准') && entry.record.page <= 2 && !entry.record.clause)) return 'front';
    if (/^1范围/.test(text)) return 'scope';
    return 'body';
  }

  function create(data) {
    const docs = new Map(data.docs.map(d => [d.id, d]));
    const entries = [], grouped = new Map();
    for (const record of data.records) {
      const groupable = /^第[一二三四五六七八九十百千零〇两\d]+条$|^[A-Z]?\.?\d+(?:\.\d+)*$/.test(record.clause);
      const key = groupable ? record.doc + ':' + articleKey(record.clause) : record.id;
      let entry = grouped.get(key);
      if (!entry) { entry = {record, records: [], text: '', key}; grouped.set(key, entry); entries.push(entry); }
      entry.records.push(record);
    }
    for (const entry of entries) {
      entry.records.sort((a, b) => a.page - b.page);
      entry.text = entry.records.map(r => r.text).join('\n\n');
      entry.normalized = norm(entry.text);
      entry.heading = norm(entry.text.split('\n')[0]);
      entry.role = role(entry, docs.get(entry.record.doc));
    }
    const averageLength = entries.reduce((sum, e) => sum + e.normalized.length, 0) / entries.length;
    const documentAliases = data.docs.flatMap(doc => {
      if (/^(KA|GB)/.test(doc.code)) return [];
      return [...new Set([doc.code, doc.name, doc.name.replace(/\d{4}|[（(][^）)]*[）)]|[《》]/g, '')])]
        .map(alias => ({id: doc.id, alias: norm(alias)})).filter(a => a.alias.length >= 5);
    }).sort((a, b) => b.alias.length - a.alias.length);

    function plan(query, options) {
      let remaining = String(query || '').normalize('NFKC').trim();
      const result = {query: remaining, terms: [], phrases: [], docIds: [], clause: '', mode: options.mode || 'all'};
      if (/^(全部|原文)?公式$/.test(remaining)) { result.formulaOnly = true; remaining = ''; }
      remaining = remaining.replace(/["“]([^"”]+)["”]/g, (_, phrase) => { if (norm(phrase)) result.phrases.push(norm(phrase)); return ' '; });
      remaining = remaining.replace(/(\d)\s+(?=(?:mm|cm|km|m|kj|mj|j|hz|khz|mpa|kpa|pa|ms|s|kg|t|kn|n|kw|w|%)\b)/gi, '$1');
      const code = remaining.match(/\b(?:GB\s*\/?\s*T\s*\d+(?:\.\d+)?|KA\s*\d+)(?:\s*[-—–－]\s*\d{4})?\b/i);
      if (code) {
        const requested = norm(code[0]);
        result.docIds = data.docs.filter(d => {
          const current = norm(d.code);
          return current === requested || (!/[-—–－]\s*\d{4}$/.test(code[0]) && norm(d.code.replace(/-\d{4}$/, '')) === requested);
        }).map(d => d.id);
        result.invalidDocument = !result.docIds.length;
        remaining = remaining.replace(code[0], ' ');
      } else {
        const compact = norm(remaining), alias = documentAliases.find(a => compact.includes(a.alias));
        if (alias) {
          result.docIds = [alias.id];
          // Remove through a normalization map, so spaces and punctuation are harmless.
          const mapped = mappedText(remaining), start = mapped.text.indexOf(alias.alias), end = start + alias.alias.length;
          remaining = remaining.slice(0, mapped.starts[start]) + ' ' + remaining.slice(mapped.ends[end - 1]);
        }
      }
      const article = remaining.match(/第\s*([一二三四五六七八九十百千零〇两\d]+)\s*条/);
      if (article) { result.clause = 'article:' + number(article[1]); result.clauseLabel = article[0].replace(/\s/g, ''); remaining = remaining.replace(article[0], ' '); }
      else {
        const section = remaining.match(/(?:^|\s)(?:条款\s*)?([A-Z]\.)?\d+(?:\.\d+)+(?:$|\s)/i);
        if (section) { result.clauseLabel = section[0].trim().replace(/^条款\s*/, ''); result.clause = 'section:' + norm(result.clauseLabel); remaining = remaining.replace(section[0], ' '); }
      }
      result.literal = norm(remaining);
      result.separateKeywords = /\S\s+\S/.test(remaining.trim());
      result.concepts = concepts.filter(c => remaining.includes(c.phrase)).filter((c, i, list) => !list.some(other => other !== c && other.phrase.includes(c.phrase)));
      if (result.mode === 'phrase' && result.literal) result.phrases.push(result.literal);
      result.terms = [...new Set([...result.phrases, ...(result.mode === 'phrase' ? [] : tokenize(remaining, options.descriptive))])];
      if (!result.terms.length && result.literal) result.terms = [result.literal];
      result.groups = result.terms.map(term => {
        const alternatives = result.mode === 'expanded' && !result.phrases.includes(term) ? aliases.find(a => a.includes(term)) : null;
        return {term, variants: alternatives || [term]};
      });
      return result;
    }
    function search(query, options = {}) {
      if (options.descriptive && !options.singleStatement) {
        const statements = String(query || '').split(/[；;。\n]+/).map(s => s.trim()).filter(Boolean);
        if (statements.length > 1) {
          const parts = statements.map(statement => search(statement, {...options, singleStatement: true}));
          const merged = new Map();
          for (const part of parts) for (const item of part.items) {
            const previous = merged.get(item.entry.key);
            if (!previous || item.score > previous.score) merged.set(item.entry.key, item);
          }
          return {items: [...merged.values()].sort((a, b) => b.roleRank - a.roleRank || b.score - a.score), plan: {...parts[0].plan, query: String(query).trim(), statements: parts.map(p => p.plan), terms: [...new Set(parts.flatMap(p => p.plan.terms))]}};
        }
      }
      const parsed = plan(query, options);
      if (!parsed.query || parsed.invalidDocument) return {items: [], plan: parsed};
      const scoped = entries.filter(e => (!options.category || docs.get(e.record.doc).category === options.category) && (!options.scope || e.record.doc === options.scope) && (!parsed.docIds.length || parsed.docIds.includes(e.record.doc)) && (!parsed.clause || articleKey(e.record.clause) === parsed.clause) && (!parsed.formulaOnly || e.records.some(r => r.formulaImage)));
      const frequencies = parsed.groups.map(g => scoped.filter(e => g.variants.some(v => positions(e.normalized, v).length)).length);
      const items = [];
      for (const entry of scoped) {
        const hits = parsed.groups.map(g => {
          const variant = g.variants.map(term => ({term, positions: positions(entry.normalized, term)})).find(v => v.positions.length);
          return variant ? {...variant, requested: g.term} : null;
        });
        if (hits.some(h => !h)) continue;
        const title = norm(docs.get(entry.record.doc).name);
        if (parsed.concepts.some(c => !c.forms.some(form => positions(entry.normalized, form).length || positions(title, form).length))) continue;
        const literal = parsed.literal && !parsed.separateKeywords && positions(entry.normalized, parsed.literal).length > 0;
        const expanded = hits.some(h => h.term !== h.requested);
        const label = parsed.formulaOnly ? '公式原文' : !hits.length ? '条文定位' : expanded ? '扩展术语' : literal || parsed.mode === 'phrase' || (parsed.phrases.length === 1 && hits.length === 1) ? '完整词组' : '全部关键词';
        let score = (literal ? 500 : 0) + (expanded ? -100 : 0);
        for (let i = 0; i < hits.length; i++) {
          const tf = Math.min(8, hits[i].positions.length), idf = Math.log(1 + (scoped.length + 0.5) / (frequencies[i] + 0.5));
          score += 18 * idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * entry.normalized.length / averageLength));
        }
        if (hits.length) {
          const span = smallestSpan(hits), termLength = hits.reduce((sum, h) => sum + h.term.length, 0);
          score += 65 * Math.min(1, termLength / Math.max(1, span));
          score += 25 * hits.filter(h => positions(entry.heading, h.term).length).length / hits.length;
        }
        if (entry.normalized.length < 28) score -= 90;
        if (entry.role === 'scope') score -= 80;
        // A relevant title only breaks ties after every body condition passes.
        if (hits.length) score += 30 * hits.filter(h => positions(title, h.term).length).length / hits.length;
        if (literal && parsed.literal.length >= 2 && positions(title, parsed.literal).length) score += 65;
        const roleRank = entry.role === 'front' ? 0 : entry.role === 'reference' ? 1 : 2;
        const primary = parsed.formulaOnly ? entry.records.find(r => r.formulaImage) : !hits.length ? entry.record : [...entry.records].sort((a, b) => {
          const weight = r => hits.reduce((sum, h) => sum + (positions(norm(r.text), h.term).length ? 1 : 0), 0);
          return weight(b) - weight(a) || a.page - b.page;
        })[0];
        const contextTerms = parsed.concepts.filter(c => !c.forms.some(form => positions(entry.normalized, form).length)).map(c => c.phrase);
        items.push({record: primary, records: entry.records, text: entry.text, hits, contextTerms, label, score, roleRank, role: entry.role, entry});
      }
      items.sort((a, b) => parsed.terms.length ? b.roleRank - a.roleRank || b.score - a.score || a.record.page - b.record.page || a.record.doc.localeCompare(b.record.doc) : a.record.doc.localeCompare(b.record.doc) || a.entry.record.page - b.entry.record.page);
      return {items, plan: parsed};
    }
    return {search, plan, entries};
  }

  function mappedText(value) {
    const raw = String(value || ''), starts = [], ends = [];
    let text = '', offset = 0;
    for (const char of raw) {
      for (const c of char.normalize('NFKC').toLowerCase()) {
        if (ignored.test(c)) continue;
        text += c;
        for (let i = 0; i < c.length; i++) { starts.push(offset); ends.push(offset + char.length); }
      }
      offset += char.length;
    }
    return {text, starts, ends};
  }
  function ranges(text, terms) {
    const mapped = mappedText(text), spans = [];
    for (const term of [...new Set(terms.map(norm))].filter(Boolean)) {
      for (const at of positions(mapped.text, term)) spans.push([mapped.starts[at], mapped.ends[at + term.length - 1]]);
    }
    spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else merged.push([...span]);
    }
    return merged;
  }
  function snippet(text, terms, limit = 330) {
    const clean = String(text || '').trim(), spans = ranges(clean, terms);
    let at = spans[0]?.[0] || 0, best = -1;
    for (const span of spans) {
      const count = spans.filter(s => s[0] >= span[0] && s[1] <= span[0] + limit - 35).length;
      if (count > best) { best = count; at = span[0]; }
    }
    const start = Math.max(0, at - 40), end = Math.min(clean.length, start + limit);
    return (start ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
  }
  return {create, norm, tokenize, ranges, snippet};
});
