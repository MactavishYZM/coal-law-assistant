(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('data-json').textContent);
  const docs = new Map(D.docs.map(d => [d.id, d]));
  const records = new Map(D.records.map(r => [r.id, r]));
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s，。、；：！？!?,.;:()（）《》<>【】\[\]"'·—_\/\-]/g, '');
  const imgPath = (d, n) => `pages/${d.id}/${String(n).padStart(3, '0')}.webp`;
  const queryTerms = q => {
    const raw = norm(q), terms = [raw];
    const synonyms = {'大直径': ['大孔径', '钻孔卸压'], '应力监测': ['采动应力', '应力在线监测'], '卸压爆破': ['煤层卸压爆破', '顶板预裂'], '微震': ['微震监测'], '冲击地压': ['防冲', '冲击危险']};
    for (const [key, values] of Object.entries(synonyms)) if (raw.includes(key)) terms.push(...values.map(norm));
    return terms.filter(Boolean);
  };
  function score(record, query, category, scope, bodyPriority) {
    const doc = docs.get(record.doc), first = norm(query);
    if (!doc || !first || (category && doc.category !== category) || (scope && doc.id !== scope)) return 0;
    const text = norm(record.text), clause = norm(record.clause), terms = queryTerms(query);
    let value = 0;
    if (text.includes(first)) value += 130 + Math.min(6, text.split(first).length - 1) * 7 + Math.max(0, 18 - Math.floor(text.indexOf(first) / 9));
    if (clause === first) value += 95; else if (first.length >= 2 && clause.includes(first)) value += 28;
    if (norm(doc.code).includes(first)) value += 90;
    if (norm(doc.name).includes(first)) value += 23;
    if (record.formulaImage && first === '公式') value += 140;
    if (terms.slice(1).some(term => text.includes(term))) value += 38;
    if (value < 130) {
      const parts = first.length > 2 ? [...new Set(Array.from({length: first.length - 1}, (_, i) => first.slice(i, i + 2)))] : [first];
      const hits = parts.filter(term => text.includes(term)).length;
      if (!hits && !value) return 0;
      value += 55 * hits / parts.length;
    }
    if (bodyPriority && doc.category.includes('标准')) value += 10;
    if (record.text.length < 20) value -= 8;
    return Math.max(0, value);
  }
  function excerpt(text, query) {
    const clean = String(text || '').trim();
    let at = clean.toLowerCase().indexOf(query.toLowerCase());
    if (at < 0) at = 0;
    const start = Math.max(0, at - 65), end = Math.min(clean.length, Math.max(start + 330, at + 230));
    return (start ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
  }
  function highlight(text, query) {
    if (!query) return esc(text);
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    let end = 0, html = '';
    for (const match of text.matchAll(rx)) {
      html += esc(text.slice(end, match.index)) + '<mark>' + esc(match[0]) + '</mark>';
      end = match.index + match[0].length;
    }
    return html + esc(text.slice(end));
  }
  function originalBody(record, doc) {
    const name = record.originalKind === 'formula' ? '公式及符号说明 · PDF原文' : record.originalKind === 'table' ? '表格 · PDF原文' : '条文 · PDF原文';
    let content;
    if (record.formulaImage) {
      content = `<img class="formula-image" src="${encodeURI(record.formulaImage)}" alt="${esc(doc.name)} ${esc(record.clause)}公式原文" loading="lazy" data-record="${esc(record.id)}" role="button" tabindex="0">`;
    } else {
      const [x, y, w, h] = record.sourceRect, [pw, ph] = record.pageSize;
      content = `<svg class="source-region" viewBox="${x} ${y} ${w} ${h}" style="aspect-ratio:${w}/${h}" data-record="${esc(record.id)}" role="button" tabindex="0" aria-label="${esc(doc.name)}原文条文"><image href="${encodeURI(imgPath(doc, record.page))}" x="0" y="0" width="${pw}" height="${ph}"/></svg>`;
    }
    return `<section class="original-body"><div class="original-label">${name}</div>${content}<div class="original-actions"><button class="btn secondary open-formula" data-record="${esc(record.id)}">${record.formulaImage ? '放大公式原文' : '放大原文'}</button><span>PDF第${record.page}页</span></div></section>`;
  }
  function card(item, query) {
    const record = item.record, doc = docs.get(record.doc), source = doc.path, n = record.page;
    const label = record.textSource.startsWith('native') ? 'PDF原生文字' : '逐行重识别';
    const body = record.displayOriginal ? originalBody(record, doc) : `<div class="excerpt corrected-text">${highlight(excerpt(record.text, query), query)}</div>${record.text.length > 330 ? `<details class="full-text"><summary>展开本条文字</summary><div class="corrected-text">${highlight(record.text, query)}</div></details>` : ''}`;
    return `<article class="match" data-record-id="${esc(record.id)}"><div class="match-title"><div><b>${esc(doc.name)}</b> <span class="pill">${esc(doc.category)}</span> <span class="pill corrected-pill">${label}</span><div class="meta">${esc(doc.code)} · PDF第${n}/${doc.pages}页 ${record.clause ? '· ' + esc(record.clause) : ''}</div></div><span class="score">相关度 ${Math.round(item.score)}</span></div>${body}<details class="preview"><summary class="preview-head">核对PDF整页 · 第${n}/${doc.pages}页</summary><div class="preview-body"><img src="${encodeURI(imgPath(doc, n))}" loading="lazy" alt="${esc(doc.name)} 第${n}页原文" tabindex="0" role="button" data-doc="${esc(doc.id)}" data-page="${n}"></div></details><div class="actions"><button class="btn secondary open-img" data-doc="${esc(doc.id)}" data-page="${n}">查看原文整页</button><a class="document-link" href="${encodeURI(source)}#page=${n}" target="_blank" rel="noopener">打开PDF</a></div></article>`;
  }
  let results = [], cursor = 0, query = '', activeScope = '';
  function draw(target, list, append, text) {
    const node = $(target), part = list.slice(cursor, cursor + 18);
    if (!append) node.innerHTML = '';
    node.insertAdjacentHTML('beforeend', part.map(item => card(item, text)).join(''));
    cursor += part.length;
    if (target === '#results') $('#more').classList.toggle('hidden', cursor >= list.length);
  }
  function perform(value, incident = false) {
    const text = String(value || '').trim();
    const category = incident ? '' : $('#category').value, scope = incident ? '' : activeScope;
    const bodyPriority = incident || $('#onlytext').checked;
    const found = D.records.map(record => ({record, score: score(record, text, category, scope, bodyPriority)})).filter(item => item.score >= 30).sort((a, b) => b.score - a.score || a.record.page - b.record.page);
    cursor = 0;
    if (!incident) { results = found; query = text; }
    draw(incident ? '#incidentResults' : '#results', found, false, text);
    $(incident ? '#incidentInfo' : '#searchInfo').textContent = text ? `找到${found.length}条结果，当前显示${Math.min(cursor, found.length)}条。${scope ? '限定资料：' + docs.get(scope).name : ''}` : '请输入关键词';
    $('#more').classList.toggle('hidden', incident || cursor >= found.length);
  }
  $('#go').onclick = () => perform($('#q').value);
  $('#q').onkeydown = event => { if (event.key === 'Enter') perform($('#q').value); };
  $('#clear').onclick = () => { $('#q').value = ''; activeScope = ''; perform(''); };
  $('#category').onchange = () => perform($('#q').value);
  $('#more').onclick = () => draw('#results', results, true, query);
  $('#incidentGo').onclick = () => perform($('#incident').value, true);
  $('#incidentClear').onclick = () => { $('#incident').value = ''; perform('', true); };
  const tabs = ['search', 'incident', 'library'];
  document.querySelectorAll('[data-tab]').forEach(tab => tab.onclick = () => {
    tabs.forEach(name => $('#' + name + 'Panel').classList.toggle('hidden', name !== tab.dataset.tab));
    document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === tab));
  });
  $('#doclist').innerHTML = D.docs.map(doc => `<div class="doc"><div><div class="doc-name">${esc(doc.name)}</div><small>${esc(doc.code)} · ${esc(doc.category)} · ${doc.pages}页</small></div><div class="actions"><button class="btn secondary doc-search" data-id="${esc(doc.id)}">检索该文件</button><a class="document-link" href="${encodeURI(doc.path)}" target="_blank" rel="noopener">PDF原文</a></div></div>`).join('');
  $('#doclist').onclick = event => {
    const element = event.target.closest('.doc-search');
    if (!element) return;
    activeScope = element.dataset.id;
    document.querySelector('[data-tab="search"]').click();
    $('#q').value = docs.get(activeScope).code;
    perform($('#q').value);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
  let viewDoc = null, viewPage = 1;
  function view(id, page, record = null) {
    viewDoc = docs.get(id);
    if (!viewDoc) return;
    viewPage = Math.max(1, Math.min(viewDoc.pages, Number(page)));
    const formula = record?.formulaImage;
    const path = formula || imgPath(viewDoc, viewPage);
    $('#viewtitle').textContent = viewDoc.name + (formula ? ' · 公式原文' : '');
    $('#viewpage').textContent = `${viewPage} / ${viewDoc.pages}`;
    $('#viewimage').src = encodeURI(path);
    $('#viewimage').classList.toggle('formula-view', !!formula);
    $('#saveimg').href = encodeURI(path);
    $('#saveimg').download = `${viewDoc.code}_p${viewPage}.${formula ? 'png' : 'webp'}`;
    $('#openpdf').href = encodeURI(viewDoc.path) + '#page=' + viewPage;
    $('#prev').disabled = viewPage === 1;
    $('#next').disabled = viewPage === viewDoc.pages;
    $('#viewer').classList.add('active');
  }
  function openElement(element) {
    if (element.dataset.record) {
      const record = records.get(element.dataset.record);
      if (record) view(record.doc, record.page, record);
    } else view(element.dataset.doc, element.dataset.page);
  }
  document.addEventListener('click', event => {
    const element = event.target.closest('.open-formula,.formula-image,.source-region,.open-img,.preview img[data-doc]');
    if (element) openElement(element);
  });
  $('#close').onclick = () => $('#viewer').classList.remove('active');
  $('#prev').onclick = () => view(viewDoc.id, viewPage - 1);
  $('#next').onclick = () => view(viewDoc.id, viewPage + 1);
  document.addEventListener('keydown', event => {
    if ($('#viewer').classList.contains('active')) {
      if (event.key === 'Escape') $('#close').click();
      if (event.key === 'ArrowLeft' && !$('#prev').disabled) $('#prev').click();
      if (event.key === 'ArrowRight' && !$('#next').disabled) $('#next').click();
    } else if (event.key === 'Enter' && event.target.matches('.formula-image,.source-region,.preview img[data-doc]')) openElement(event.target);
  });
  $('#docstat').textContent = `内置原文：${D.docs.length}份`;
  $('#recordstat').textContent = `检索单元：${D.records.length}条`;
  $('#pagestat').textContent = `原文公式片段：${D.quality.formulaImageCount}处`;
  const params = new URLSearchParams(location.search);
  if (params.has('q')) { $('#q').value = params.get('q'); perform($('#q').value); }
})();
