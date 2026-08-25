/* 配料表风险扫描 — 主逻辑 */
(function () {
  'use strict';
  var DB = window.RISK_DB || [];

  /* ---------- 导航 / 折叠 ---------- */
  var sidebar = document.getElementById('sidebar');
  document.getElementById('collapseBtn').addEventListener('click', function () {
    sidebar.classList.toggle('collapsed');
    try { localStorage.setItem('cr_sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
  });
  try { if (localStorage.getItem('cr_sidebar_collapsed') === '1') sidebar.classList.add('collapsed'); } catch (e) {}

  var navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view');
      navItems.forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.view').forEach(function (v) {
        v.classList.toggle('active', v.id === 'view-' + view);
      });
      window.scrollTo(0, 0);
    });
  });

  /* ---------- DOM ---------- */
  var fileInput = document.getElementById('fileInput');
  var preview = document.getElementById('preview');
  var imgWrap = document.getElementById('imgWrap');
  var ocrProgress = document.getElementById('ocrProgress');
  var ocrBar = document.getElementById('ocrBar');
  var ocrText = document.getElementById('ocrText');
  var textInput = document.getElementById('textInput');
  var analyzeBtn = document.getElementById('analyzeBtn');
  var analyzeHint = document.getElementById('analyzeHint');
  var resultArea = document.getElementById('resultArea');

  /* ---------- 工具：归一化 ---------- */
  function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }
  function hasHan(s) { return /[一-鿿]/.test(s); }

  function tokenize(raw) {
    var parts = (raw || '').split(/[,，、;；\s\t\n\r()（）【】\[\]·•:：.。/\\]+/);
    return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }

  // 某条目对「单个 token」的最佳命中长度（最长别名优先，避免短别名误命中）
  // 中文：仅「token 包含别名」方向（反向前向），避免「水」误命中「双氧水」等常见字反向包含
  // 拉丁：要求 token 精确等于别名（防英文碎片误命中）
  function bestAliasLenForToken(entry, tok) {
    var tk = norm(tok);
    if (!tk) return 0;
    var best = 0;
    entry.aliases.forEach(function (a) {
      var ak = norm(a);
      if (!ak) return;
      if (hasHan(ak)) {
        if (ak.length >= 2 && tk.indexOf(ak) !== -1) {
          if (ak.length > best) best = ak.length;
        }
      } else {
        if (tk === ak && ak.length > best) best = ak.length;
      }
    });
    return best;
  }

  // 全文本拉丁连续匹配（处理英文多词名，如 Sodium Benzoate -> sodiumbenzoate）
  function entryMatchedByFullTextLatin(entry, searchText) {
    return entry.aliases.some(function (a) {
      var ak = norm(a);
      if (!ak || hasHan(ak)) return false;
      return ak.length >= 4 && searchText.indexOf(ak) !== -1;
    });
  }

  var RISK_ORDER = { high: 0, medium: 1, low: 2 };

  /* ---------- 分析 ---------- */
  function analyze() {
    var raw = textInput.value.trim();
    if (!raw) { analyzeHint.textContent = '请先拍照识别或粘贴配料表文字。'; return; }
    analyzeHint.textContent = '';
    var searchText = norm(raw);
    var tokens = tokenize(raw);

    // 每个 token 取其「最长别名命中」的条目（特定物质优先于短碎片）
    var tokenBest = {};
    tokens.forEach(function (t) {
      var bestE = null, bestLen = 0;
      DB.forEach(function (e) {
        var len = bestAliasLenForToken(e, t);
        if (len > bestLen) { bestLen = len; bestE = e; }
      });
      if (bestE) tokenBest[t] = bestE;
    });

    // 汇总命中条目：token 最佳命中 + 全文本拉丁连续命中
    var matchedMap = {};
    tokens.forEach(function (t) { if (tokenBest[t]) matchedMap[tokenBest[t].id] = tokenBest[t]; });
    DB.forEach(function (e) { if (entryMatchedByFullTextLatin(e, searchText)) matchedMap[e.id] = e; });
    var matched = Object.keys(matchedMap).map(function (id) { return matchedMap[id]; });
    matched.sort(function (a, b) { return RISK_ORDER[a.risk] - RISK_ORDER[b.risk]; });

    // token 着色
    var tokInfo = tokens.map(function (t) {
      return { t: t, level: tokenBest[t] ? tokenBest[t].risk : null };
    });

    renderResult(matched, tokInfo, tokens.length);
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderResult(matched, tokInfo, totalTokens) {
    var h = matched.filter(function (e) { return e.risk === 'high'; }).length;
    var m = matched.filter(function (e) { return e.risk === 'medium'; }).length;
    var l = matched.filter(function (e) { return e.risk === 'low'; }).length;

    var html = '';
    html += '<div class="card">';
    // 概览
    html += '<div class="summary">';
    html += '<span class="sum-pill s">共识别 <b>' + totalTokens + '</b> 项成分</span>';
    html += '<span class="sum-pill h">高风险 <b>' + h + '</b></span>';
    html += '<span class="sum-pill m">中风险 <b>' + m + '</b></span>';
    html += '<span class="sum-pill l">低风险/注意 <b>' + l + '</b></span>';
    html += '</div>';

    // 横幅
    if (h > 0) {
      html += '<div class="banner danger">⚠️ 检出 ' + h + ' 项高风险成分（多为法规禁用/非法添加）。建议谨慎选择，必要时停用并向监管部门核实。</div>';
    } else if (m > 0) {
      html += '<div class="banner warn">⚠️ 检出 ' + m + ' 项需留意的成分（限用/有争议/特定人群）。建议控制摄入或避开。</div>';
    } else if (l > 0) {
      html += '<div class="banner warn">ℹ️ 检出 ' + l + ' 项低风险/注意成分，合规使用通常安全，敏感人群请留意。</div>';
    } else {
      html += '<div class="banner ok">✅ 未在资料库中检出风险成分。仍建议结合官方信息综合判断（资料库非穷尽）。</div>';
    }

    // 风险卡片
    if (matched.length) {
      matched.forEach(function (e) {
        var catLabel = e.category.map(catName).join(' / ');
        html += '<div class="risk-card ' + e.risk + '">';
        html += '<div class="risk-head">';
        html += '<span class="risk-name">' + esc(e.name) + '</span>';
        html += '<span class="badge ' + e.risk + '">' + riskName(e.risk) + '</span>';
        html += '<span class="tag">' + esc(e.type) + '</span>';
        html += '<span class="tag">' + esc(catLabel) + '</span>';
        html += '</div>';
        html += '<div class="risk-desc">' + esc(e.riskDesc) + '</div>';
        html += '<div class="risk-meta"><b>敏感/慎用人群：</b>' + esc(e.sensitive.join('、')) + '</div>';
        html += '<div class="risk-meta"><b>来源：</b>' + esc(e.source) + '</div>';
        html += '</div>';
      });
    }

    // 识别成分云
    html += '<details style="margin-top:14px"><summary class="muted small" style="cursor:pointer">查看全部识别成分（' + totalTokens + ' 项）</summary>';
    html += '<div class="tokens" style="margin-top:10px">';
    tokInfo.forEach(function (ti) {
      var cls = ti.level ? ti.level : 'safe';
      html += '<span class="tok ' + cls + '">' + esc(ti.t) + '</span>';
    });
    html += '</div></details>';

    html += '<div class="disclaimer-mini">免责：本结果基于公开报道与法规整理，仅供参考，不构成医疗/法律建议；OCR 可能误识，请以实物标签与官方信息为准。</div>';
    html += '</div>';

    resultArea.innerHTML = html;
  }

  function catName(c) {
    return { food: '食品', skincare: '护肤品', cosmetic: '化妆品', contact: '食品接触' }[c] || c;
  }
  function riskName(r) { return { high: '高风险', medium: '中风险', low: '低风险/注意' }[r] || r; }

  analyzeBtn.addEventListener('click', analyze);

  /* ---------- OCR ---------- */
  function setProgress(p, msg) {
    ocrProgress.classList.remove('hidden');
    ocrBar.style.width = Math.round(p * 100) + '%';
    if (msg) ocrText.textContent = msg;
  }

  fileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var url = URL.createObjectURL(file);
    preview.src = url;
    imgWrap.classList.remove('hidden');
    runOCR(file);
  });

  function runOCR(file) {
    if (typeof Tesseract === 'undefined') {
      setProgress(1, 'OCR 组件未加载（可能离线）。请直接粘贴配料表文字后点击「开始分析」。');
      return;
    }
    setProgress(0.02, '正在加载识别模型…');
    Tesseract.recognize(file, 'chi_sim+eng', {
      logger: function (m) {
        if (m.status === 'recognizing text') setProgress(m.progress, '识别中… ' + Math.round(m.progress * 100) + '%');
        else setProgress(0.05, '预处理：' + (m.status || ''));
      }
    }).then(function (res) {
      var txt = res.data.text || '';
      textInput.value = txt.trim();
      setProgress(1, '识别完成，共 ' + txt.length + ' 字。可手动修正后点击「开始分析」。');
      analyzeHint.textContent = '识别完成，可点「开始分析」。';
    }).catch(function (err) {
      setProgress(1, '识别失败：' + (err && err.message ? err.message : err) + '。建议手动粘贴文字。');
    });
  }

  /* ---------- 示例 / 清空 ---------- */
  document.getElementById('sampleBtn').addEventListener('click', function () {
    textInput.value =
      '配料：小麦粉、白砂糖、植物油、脱氢乙酸钠、阿斯巴甜（含苯丙氨酸）、柠檬黄、日落黄、山梨酸钾、食用香精、焦亚硫酸钠、水。\n' +
      '成分（护肤）：水、甘油、对羟基苯甲酸甲酯、对羟基苯甲酸丙酯、DMDM乙内酰脲、二苯酮-3、水杨酸、香精、乙醇、视黄醇。';
    imgWrap.classList.add('hidden');
    analyzeHint.textContent = '已载入示例，点「开始分析」查看效果。';
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    textInput.value = ''; fileInput.value = ''; preview.src = ''; imgWrap.classList.add('hidden');
    ocrProgress.classList.add('hidden'); resultArea.innerHTML = ''; analyzeHint.textContent = '';
  });

  /* ---------- 资料库 ---------- */
  var libState = { cat: 'all', risk: 'all', q: '' };
  function renderLibrary() {
    var q = libState.q.trim().toLowerCase();
    var list = DB.filter(function (e) {
      if (libState.cat !== 'all' && e.category.indexOf(libState.cat) === -1) return false;
      if (libState.risk !== 'all' && e.risk !== libState.risk) return false;
      if (q) {
        var hay = (e.name + ' ' + e.aliases.join(' ') + ' ' + e.type).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    list.sort(function (a, b) { return RISK_ORDER[a.risk] - RISK_ORDER[b.risk]; });

    var box = document.getElementById('libList');
    if (!list.length) { box.innerHTML = '<p class="muted">没有匹配的成分。</p>'; return; }
    var html = '';
    list.forEach(function (e) {
      html += '<div class="lib-card">';
      html += '<div class="row"><span class="badge ' + e.risk + '">' + riskName(e.risk) + '</span><span class="tag">' + esc(e.type) + '</span><span class="tag">' + esc(e.category.map(catName).join('/')) + '</span></div>';
      html += '<h4>' + esc(e.name) + '</h4>';
      html += '<div class="risk-desc small">' + esc(e.riskDesc) + '</div>';
      html += '<div class="risk-meta">慎用：' + esc(e.sensitive.join('、')) + '</div>';
      html += '</div>';
    });
    box.innerHTML = html;
  }

  document.getElementById('catFilter').addEventListener('click', function (ev) {
    var b = ev.target.closest('.chip'); if (!b) return;
    this.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === b); });
    libState.cat = b.getAttribute('data-cat'); renderLibrary();
  });
  document.getElementById('riskFilter').addEventListener('click', function (ev) {
    var b = ev.target.closest('.chip'); if (!b) return;
    this.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === b); });
    libState.risk = b.getAttribute('data-risk'); renderLibrary();
  });
  document.getElementById('libSearch').addEventListener('input', function () {
    libState.q = this.value; renderLibrary();
  });
  renderLibrary();

  /* ---------- PWA Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
