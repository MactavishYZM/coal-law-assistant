(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('data-json').textContent);
  const docs = new Map(D.docs.map(d => [d.id, d]));
  const records = new Map(D.records.map(r => [r.id, r]));
  const engine = CoalSearch.create(D);
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const imgPath = (d, n) => `pages/${d.id}/${String(n).padStart(3, '0')}.webp`;
  function highlight(text, terms) {
    let end = 0, html = '';
    for (const [start, stop] of CoalSearch.ranges(text, terms)) {
      html += esc(text.slice(end, start)) + '<mark>' + esc(text.slice(start, stop)) + '</mark>';
      end = stop;
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
  function recordBody(record, doc, terms) {
    return record.displayOriginal ? originalBody(record, doc) : `<div class="excerpt corrected-text">${highlight(CoalSearch.snippet(record.text, terms), terms)}</div>${record.text.length > 330 ? `<details class="full-text"><summary>展开本页条文文字</summary><div class="corrected-text">${highlight(record.text, terms)}</div></details>` : ''}`;
  }
  function card(item) {
    const record = item.record, doc = docs.get(record.doc), source = doc.path, n = record.page;
    const label = record.textSource.startsWith('native') ? 'PDF原生文字' : '逐行重识别';
    const terms = item.hits.map(h => h.term), others = item.records.filter(r => r.id !== record.id);
    const pages = [...new Set(item.records.map(r => r.page))];
    const pageLabel = pages.length > 1 ? `${pages[0]}–${pages[pages.length - 1]}` : String(n);
    const reason = (item.hits.length ? `正文命中：${item.hits.map(h => `<span class="hit-term">${esc(h.term)}${h.term !== h.requested ? ' ← ' + esc(h.requested) : ''}</span>`).join(' ')}` : item.label === '公式原文' ? '含直接提取自PDF的公式原图' : '按文件或条款号定位') + (item.contextTerms.length ? `<span class="context-term"> · 结合本文件主题：${esc(item.contextTerms.join('、'))}</span>` : '');
    const role = item.role === 'reference' ? ' · 引用文件' : item.role === 'front' ? ' · 目录或说明' : '';
    const continuation = others.length ? `<details class="continuation"><summary>本条另有${others.length}段跨页内容 · 展开核对</summary>${others.map(r => `<section class="continued-record"><div class="meta">PDF第${r.page}页 · ${esc(r.clause)}</div>${recordBody(r, doc, terms)}<button class="btn secondary open-img" data-doc="${esc(doc.id)}" data-page="${r.page}">查看第${r.page}页原文</button></section>`).join('')}</details>` : '';
    return `<article class="match" data-record-id="${esc(record.id)}"><div class="match-title"><div><b>${esc(doc.name)}</b> <span class="pill">${esc(doc.category)}</span> <span class="pill corrected-pill">${label}</span><div class="meta">${esc(doc.code)} · PDF第${pageLabel}/${doc.pages}页 ${record.clause ? '· ' + esc(record.clause) : ''}</div></div><span class="score">${esc(item.label + role)}</span></div><div class="match-reason">${reason}</div>${recordBody(record, doc, terms)}${continuation}<details class="preview"><summary class="preview-head">核对PDF整页 · 第${n}/${doc.pages}页</summary><div class="preview-body"><img src="${encodeURI(imgPath(doc, n))}" loading="lazy" alt="${esc(doc.name)} 第${n}页原文" tabindex="0" role="button" data-doc="${esc(doc.id)}" data-page="${n}"></div></details><div class="actions"><button class="btn secondary open-img" data-doc="${esc(doc.id)}" data-page="${n}">查看原文整页</button><a class="document-link" href="${encodeURI(source)}#page=${n}" target="_blank" rel="noopener">打开PDF</a></div></article>`;
  }
  const states = {search: {items: [], cursor: 0}, incident: {items: [], cursor: 0}};
  function draw(kind, append = false) {
    const state = states[kind], target = kind === 'search' ? '#results' : '#incidentResults';
    const part = state.items.slice(state.cursor, state.cursor + 18);
    if (!append) $(target).innerHTML = '';
    $(target).insertAdjacentHTML('beforeend', part.map(card).join(''));
    state.cursor += part.length;
    $(kind === 'search' ? '#more' : '#incidentMore').classList.toggle('hidden', state.cursor >= state.items.length);
    updateInfo(kind);
  }
  function updateInfo(kind) {
    const state = states[kind], info = $(kind === 'search' ? '#searchInfo' : '#incidentInfo');
    if (!state.plan?.query) { info.textContent = kind === 'search' ? '输入关键词后点击检索。' : '输入隐患描述后检索。'; return; }
    const selected = state.scope || state.plan.docIds[0], scope = selected ? `限定文件：${docs.get(selected).name}。` : '';
    const clause = state.plan.clauseLabel ? `条款：${state.plan.clauseLabel}。` : '';
    const terms = state.plan.statements ? `按${state.plan.statements.length}项描述分别检索，每项关键词全部满足：${state.plan.statements.map(p => '【' + p.terms.join('、') + '】').join('；')}。` : state.plan.terms.length ? `关键词全部满足：${state.plan.terms.join('、')}。` : '';
    const concepts = !state.plan.statements && state.plan.concepts?.length ? `术语关联：${state.plan.concepts.map(c => c.phrase).join('、')}。` : '';
    const empty = state.plan.invalidDocument ? '未收录该标准号，请核对编号和年份。' : '没有满足全部条件的条文，可减少关键词或调整限定文件。';
    info.textContent = (state.items.length ? `找到${state.items.length}条结果，已显示${state.cursor}条；同一条款的跨页内容已合并。` : empty) + scope + clause + terms + concepts;
    $(kind === 'search' ? '#results' : '#incidentResults').classList.toggle('empty-results', !state.items.length);
  }
  function perform(value, incident = false) {
    const text = String(value || '').trim();
    const kind = incident ? 'incident' : 'search';
    const options = {category: incident ? '' : $('#category').value, scope: incident ? '' : $('#document').value, mode: incident ? 'all' : $('#searchmode').value, descriptive: incident};
    const found = engine.search(text, options);
    states[kind] = {...found, scope: options.scope, cursor: 0};
    draw(kind);
  }
  $('#go').onclick = () => perform($('#q').value);
  $('#q').onkeydown = event => { if (event.key === 'Enter') perform($('#q').value); };
  $('#clear').onclick = () => { $('#q').value = ''; $('#document').value = ''; $('#category').value = ''; syncDocuments(); perform(''); };
  function syncDocuments() {
    const selected = $('#document').value;
    $('#document').innerHTML = '<option value="">全部文件</option>' + D.docs.filter(d => !$('#category').value || d.category === $('#category').value).map(d => `<option value="${esc(d.id)}">${esc(d.code)} · ${esc(d.name)}</option>`).join('');
    if ([...$('#document').options].some(o => o.value === selected)) $('#document').value = selected;
  }
  syncDocuments();
  $('#category').onchange = () => { syncDocuments(); perform($('#q').value); };
  $('#document').onchange = $('#searchmode').onchange = () => perform($('#q').value);
  $('#more').onclick = () => draw('search', true);
  $('#incidentMore').onclick = () => draw('incident', true);
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
    $('#category').value = '';
    syncDocuments();
    $('#document').value = element.dataset.id;
    document.querySelector('[data-tab="search"]').click();
    $('#q').value = docs.get(element.dataset.id).code;
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
