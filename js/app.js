/* 配料表风险扫描 — 主逻辑 */
(function () {
  'use strict';
  var DB = window.RISK_DB || [];
  var TAGS = window.RISK_TAGS || {};
  var TAG_MAP = window.RISK_TAG_MAP || {};

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
      if (view === 'records') renderRecords(curRecFilter);
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

  var lastPhotoDataUrl = null;   // 最近一次拍照的图片 dataURL（用于保存记录缩略图）
  var currentResult = null;      // 当前分析结果 {raw, matched, totalTokens}
  var curRecFilter = 'all';

  /* ---------- 工具：归一化 ---------- */
  function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }
  function hasHan(s) { return /[一-鿿]/.test(s); }

  function tokenize(raw) {
    var parts = (raw || '').split(/[,，、;；\s\t\n\r()（）【】\[\]·•:：.。/\\]+/);
    return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }

  // 某条目对「单个 token」的最佳命中长度（最长别名优先，避免短别名误命中）
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

  function catName(c) {
    return { food: '食品', skincare: '护肤品', cosmetic: '化妆品', contact: '食品接触', unknown: '未分类' }[c] || c;
  }
  function riskName(r) { return { high: '高风险', medium: '中风险', low: '低风险/注意' }[r] || r; }
  function verdictName(v) { return { high: '高风险', medium: '注意', low: '低风险', safe: '安全' }[v] || v; }

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function hexA(hex, a) {
    var h = (hex || '#000').replace('#', '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function badgeStyle(color) {
    return 'color:' + color + ';border-color:' + color + ';background:' + hexA(color, 0.12) + ';';
  }
  function tagsOf(entry) { return TAG_MAP[entry.id] || []; }

  /* ---------- 自动分类 / 命名 ---------- */
  function deriveCategory(matched) {
    if (!matched.length) return 'unknown';
    var cnt = {};
    matched.forEach(function (e) {
      (e.category || []).forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
    });
    var max = 0, maxC = [];
    Object.keys(cnt).forEach(function (c) {
      if (cnt[c] > max) { max = cnt[c]; maxC = [c]; }
      else if (cnt[c] === max) { maxC.push(c); }
    });
    return maxC.length === 1 ? maxC[0] : 'unknown';
  }
  function deriveName(raw) {
    var lines = (raw || '').split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var first = lines[0] || '';
    if (first.length > 40) first = first.slice(0, 40);
    return first || '未命名产品';
  }

  /* ---------- 风险标识汇总 ---------- */
  function tagSummary(matched) {
    var map = {};
    matched.forEach(function (e) {
      tagsOf(e).forEach(function (t) {
        if (!map[t]) map[t] = { count: 0, maxRisk: 'low' };
        map[t].count++;
        if (RISK_ORDER[e.risk] < RISK_ORDER[map[t].maxRisk]) map[t].maxRisk = e.risk;
      });
    });
    return map;
  }
  function verdictOf(matched) {
    if (!matched.length) return 'safe';
    var v = 'low';
    matched.forEach(function (e) { if (RISK_ORDER[e.risk] < RISK_ORDER[v]) v = e.risk; });
    return v;
  }
  function renderRiskBadges(summary) {
    var keys = Object.keys(TAGS);
    var parts = [];
    keys.forEach(function (t) {
      if (!summary[t]) return;
      var info = TAGS[t];
      var cnt = summary[t].count;
      parts.push('<span class="risk-badge" style="' + badgeStyle(info.color) + '" title="' + esc(info.desc) + '">' +
        '<span class="rb-ico">' + info.icon + '</span>' + esc(info.label) +
        (cnt > 1 ? ' <b>×' + cnt + '</b>' : '') + '</span>');
    });
    if (!parts.length) return '<span class="risk-badge safe">✅ 无风险标识</span>';
    return parts.join('');
  }

  /* ---------- 分析 ---------- */
  function analyze() {
    var raw = textInput.value.trim();
    if (!raw) { analyzeHint.textContent = '请先拍照识别或粘贴配料表文字。'; return; }
    analyzeHint.textContent = '';
    var searchText = norm(raw);
    var tokens = tokenize(raw);

    var tokenBest = {};
    tokens.forEach(function (t) {
      var bestE = null, bestLen = 0;
      DB.forEach(function (e) {
        var len = bestAliasLenForToken(e, t);
        if (len > bestLen) { bestLen = len; bestE = e; }
      });
      if (bestE) tokenBest[t] = bestE;
    });

    var matchedMap = {};
    tokens.forEach(function (t) { if (tokenBest[t]) matchedMap[tokenBest[t].id] = tokenBest[t]; });
    DB.forEach(function (e) { if (entryMatchedByFullTextLatin(e, searchText)) matchedMap[e.id] = e; });
    var matched = Object.keys(matchedMap).map(function (id) { return matchedMap[id]; });
    matched.sort(function (a, b) { return RISK_ORDER[a.risk] - RISK_ORDER[b.risk]; });

    var tokInfo = tokens.map(function (t) {
      return { t: t, level: tokenBest[t] ? tokenBest[t].risk : null };
    });

    currentResult = { raw: raw, matched: matched, totalTokens: tokens.length };
    renderResult(currentResult, tokInfo);
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResult(res, tokInfo) {
    var matched = res.matched;
    var totalTokens = res.totalTokens;
    var h = matched.filter(function (e) { return e.risk === 'high'; }).length;
    var m = matched.filter(function (e) { return e.risk === 'medium'; }).length;
    var l = matched.filter(function (e) { return e.risk === 'low'; }).length;
    var verdict = verdictOf(matched);
    var summary = tagSummary(matched);

    var html = '';
    html += '<div class="card">';

    html += '<div class="verdict-bar v-' + verdict + '">' +
      '<span class="vb-ico">' + (verdict === 'safe' ? '✅' : (verdict === 'high' ? '🔴' : (verdict === 'medium' ? '🟠' : '🟡'))) + '</span>' +
      '<span class="vb-text">总体判定：<b>' + verdictName(verdict) + '</b></span>' +
      '<span class="vb-sub">共识别 ' + totalTokens + ' 项成分</span></div>';

    html += '<div class="summary">';
    html += '<span class="sum-pill h">高风险 <b>' + h + '</b></span>';
    html += '<span class="sum-pill m">中风险 <b>' + m + '</b></span>';
    html += '<span class="sum-pill l">低风险/注意 <b>' + l + '</b></span>';
    html += '</div>';

    if (h > 0) {
      html += '<div class="banner danger">⚠️ 检出 ' + h + ' 项高风险成分（多为法规禁用/非法添加）。建议谨慎选择，必要时停用并向监管部门核实。</div>';
    } else if (m > 0) {
      html += '<div class="banner warn">⚠️ 检出 ' + m + ' 项需留意的成分（限用/有争议/特定人群）。建议控制摄入或避开。</div>';
    } else if (l > 0) {
      html += '<div class="banner warn">ℹ️ 检出 ' + l + ' 项低风险/注意成分，合规使用通常安全，敏感人群请留意。</div>';
    } else {
      html += '<div class="banner ok">✅ 未在资料库中检出风险成分。仍建议结合官方信息综合判断（资料库非穷尽）。</div>';
    }

    html += '<div class="risk-badges"><div class="rb-title">风险标识</div>' + renderRiskBadges(summary) + '</div>';

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

    html += '<details style="margin-top:14px"><summary class="muted small" style="cursor:pointer">查看全部识别成分（' + totalTokens + ' 项）</summary>';
    html += '<div class="tokens" style="margin-top:10px">';
    tokInfo.forEach(function (ti) {
      var cls = ti.level ? ti.level : 'safe';
      html += '<span class="tok ' + cls + '">' + esc(ti.t) + '</span>';
    });
    html += '</div></details>';

    html += '<div class="save-panel">';
    html += '<h4>保存到「拍照记录」</h4>';
    html += '<div class="save-row">';
    html += '<input id="recName" class="input" maxlength="40" placeholder="产品名称（可修改）" />';
    html += '<select id="recCat" class="input">' +
      '<option value="food">食品</option>' +
      '<option value="skincare">护肤品</option>' +
      '<option value="cosmetic">化妆品</option>' +
      '<option value="contact">食品接触</option>' +
      '<option value="unknown">未分类</option>' +
      '</select>';
    html += '</div>';
    html += '<div class="save-actions">';
    html += '<button id="saveRecBtn" class="btn btn-primary">💾 保存这条记录</button>';
    html += '<span id="saveHint" class="muted small"></span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="disclaimer-mini">免责：本结果基于公开报道与法规整理，仅供参考，不构成医疗/法律建议；OCR 可能误识，请以实物标签与官方信息为准。</div>';
    html += '</div>';

    resultArea.innerHTML = html;

    var rn = document.getElementById('recName'); if (rn) rn.value = deriveName(res.raw);
    var rc = document.getElementById('recCat'); if (rc) rc.value = deriveCategory(matched);
    var sb = document.getElementById('saveRecBtn');
    if (sb) sb.addEventListener('click', saveRecord);
  }

  /* ---------- 拍照记录（本地 + Supabase 多端同步） ---------- */
  var REC_KEY = 'irs_records';
  function loadRecords() { try { return JSON.parse(localStorage.getItem(REC_KEY)) || []; } catch (e) { return []; } }
  function saveRecords(arr) {
    try { localStorage.setItem(REC_KEY, JSON.stringify(arr)); }
    catch (e) { alert('保存失败：浏览器本地存储空间可能已满（缩略图过多），请删除部分旧记录。'); }
  }
  function makeThumb(dataUrl) {
    return new Promise(function (resolve) {
      if (!dataUrl) { resolve(null); return; }
      var img = new Image();
      img.onload = function () {
        var maxW = 320, w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', 0.7)); } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }
  function buildRecord(name, cat, source) {
    return {
      id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      updated_at: Date.now(),
      name: name,
      category: cat,
      verdict: verdictOf(currentResult ? currentResult.matched : []),
      tagSummary: tagSummary(currentResult ? currentResult.matched : []),
      matched: (currentResult ? currentResult.matched : []).map(function (e) {
        return { id: e.id, name: e.name, risk: e.risk, tags: tagsOf(e), type: e.type };
      }),
      thumb: null,
      source: source,
      deleted: false
    };
  }
  function saveRecord() {
    if (!currentResult) { return; }
    var name = (document.getElementById('recName').value || '').trim() || '未命名产品';
    var cat = document.getElementById('recCat').value;
    var source = lastPhotoDataUrl ? 'camera' : 'paste';
    var rec = buildRecord(name, cat, source);
    makeThumb(lastPhotoDataUrl).then(function (thumb) {
      rec.thumb = thumb;
      var arr = loadRecords(); arr.unshift(rec); saveRecords(arr);
      var hint = document.getElementById('saveHint');
      if (hint) hint.textContent = '已保存 ✓ 可在「拍照记录」查看';
      pushRecordToSync(rec);
    });
  }

  // 删除：用「墓碑」标记 deleted=true 并同步，确保跨设备也能删除
  function deleteRecord(id) {
    var arr = loadRecords();
    var rec = arr.filter(function (r) { return r.id === id; })[0];
    if (rec) {
      rec.deleted = true;
      rec.updated_at = Date.now();
      saveRecords(arr);
      if (window.IRSSync) {
        var cfg = window.IRSSync.getCfg();
        if (cfg.enabled && cfg.space) window.IRSSync.push([rec]).catch(function () {});
      }
    }
  }

  function pushRecordToSync(rec) {
    if (!window.IRSSync) return;
    var cfg = window.IRSSync.getCfg();
    if (!cfg.enabled || !cfg.space) return;
    window.IRSSync.push([rec]).catch(function (e) {
      setSyncStatus('同步推送失败：' + (e && e.message ? e.message : e), false);
    });
  }

  function recBadgesHTML(summary) {
    var keys = Object.keys(TAGS);
    var parts = [];
    keys.forEach(function (t) {
      if (!summary[t]) return;
      var info = TAGS[t];
      parts.push('<span class="risk-badge mini" style="' + badgeStyle(info.color) + '" title="' + esc(info.desc) + '">' +
        '<span class="rb-ico">' + info.icon + '</span>' + esc(info.label) +
        (summary[t].count > 1 ? ' ×' + summary[t].count : '') + '</span>');
    });
    return parts.join('') || '<span class="risk-badge safe">✅ 安全</span>';
  }

  function recCardHTML(r) {
    var thumb = r.thumb
      ? '<img src="' + r.thumb + '" alt="" />'
      : '<div class="rec-ph">' + (r.source === 'camera' ? '📷' : '📄') + '</div>';
    return '<div class="rec-card" data-id="' + esc(r.id) + '">' +
      '<div class="rec-thumb">' + thumb + '</div>' +
      '<div class="rec-body">' +
        '<div class="rec-title">' + esc(r.name) +
          ' <span class="verdict v-' + r.verdict + '">' + verdictName(r.verdict) + '</span></div>' +
        '<div class="rec-cat">' + catName(r.category) + ' · ' + (r.matched ? r.matched.length : 0) + ' 项风险成分</div>' +
        '<div class="rec-badges">' + recBadgesHTML(r.tagSummary || {}) + '</div>' +
        '<div class="rec-actions">' +
          '<button class="btn-mini" data-act="detail">详情</button>' +
          '<button class="btn-mini danger" data-act="del">删除</button>' +
        '</div>' +
        '<div class="rec-detail hidden"></div>' +
      '</div>' +
    '</div>';
  }

  function recDetailHTML(r) {
    var html = '<div class="rd-inner">';
    if (!r.matched || !r.matched.length) {
      html += '<p class="muted small">本次未检出风险成分。</p>';
    } else {
      r.matched.forEach(function (e) {
        var tb = (e.tags || []).map(function (t) {
          var info = TAGS[t]; if (!info) return '';
          return '<span class="risk-badge mini" style="' + badgeStyle(info.color) + '"><span class="rb-ico">' + info.icon + '</span>' + esc(info.label) + '</span>';
        }).join('');
        html += '<div class="rd-item">' +
          '<div class="rd-row"><span class="risk-name">' + esc(e.name) + '</span>' +
          '<span class="badge ' + e.risk + '">' + riskName(e.risk) + '</span></div>' +
          '<div class="rd-tags">' + (tb || '<span class="muted small">—</span>') + '</div>' +
          '</div>';
      });
    }
    html += '<div class="muted small" style="margin-top:8px">保存时间：' + new Date(r.ts).toLocaleString('zh-CN') + '</div>';
    html += '</div>';
    return html;
  }

  function renderRecords(filter) {
    var arr = loadRecords().filter(function (r) { return !r.deleted; });
    var box = document.getElementById('recList');
    if (!box) return;
    if (!arr.length) {
      box.innerHTML = '<p class="muted">还没有拍照记录。去「拍照扫描」识别一个产品，点「保存这条记录」即可收录到这里。</p>';
      return;
    }
    var cats = ['food', 'skincare', 'cosmetic', 'contact', 'unknown'];
    var html = '';
    cats.forEach(function (cat) {
      if (filter !== 'all' && filter !== cat) return;
      var items = arr.filter(function (r) { return r.category === cat; });
      if (!items.length) return;
      html += '<div class="rec-group"><h3 class="rec-group-title">' + catName(cat) +
        ' <span class="muted small">(' + items.length + ')</span></h3><div class="rec-grid">';
      items.forEach(function (r) { html += recCardHTML(r); });
      html += '</div></div>';
    });
    if (!html) html = '<p class="muted">该分类下暂无记录。</p>';
    box.innerHTML = html;
  }

  var recListEl = document.getElementById('recList');
  if (recListEl) {
    recListEl.addEventListener('click', function (ev) {
      var card = ev.target.closest('.rec-card'); if (!card) return;
      var id = card.getAttribute('data-id');
      var actBtn = ev.target.closest('[data-act]');
      if (!actBtn) return;
      var act = actBtn.getAttribute('data-act');
      if (act === 'del') {
        if (confirm('确定删除这条记录？')) { deleteRecord(id); renderRecords(curRecFilter); }
      } else if (act === 'detail') {
        var det = card.querySelector('.rec-detail');
        if (!det) return;
        if (det.classList.contains('hidden')) {
          var rec = loadRecords().filter(function (r) { return r.id === id; })[0];
          det.innerHTML = rec ? recDetailHTML(rec) : '';
          det.classList.remove('hidden');
          actBtn.textContent = '收起';
        } else {
          det.classList.add('hidden');
          actBtn.textContent = '详情';
        }
      }
    });
  }
  var recFilterEl = document.getElementById('recFilter');
  if (recFilterEl) {
    recFilterEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      this.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === b); });
      curRecFilter = b.getAttribute('data-cat');
      renderRecords(curRecFilter);
    });
  }

  /* ---------- 多端同步 UI ---------- */
  function setSyncStatus(text, ok) {
    var el = document.getElementById('syncStatus');
    if (el) { el.textContent = text; el.className = 'sync-status' + (ok === true ? ' ok' : (ok === false ? ' err' : '')); }
  }
  function syncNow() {
    if (!window.IRSSync) { setSyncStatus('同步模块未加载', false); return; }
    var cfg = window.IRSSync.getCfg();
    if (!cfg.enabled || !cfg.space) { setSyncStatus('未启用或缺少同步空间', false); return; }
    window.IRSSync.sync(loadRecords, saveRecords, setSyncStatus).then(function () {
      renderRecords(curRecFilter);
    }).catch(function () {});
  }
  function initSyncUI() {
    var toggle = document.getElementById('syncToggle');
    var spaceText = document.getElementById('syncSpaceText');
    var configBox = document.getElementById('syncConfig');
    var cfg = (window.IRSSync && window.IRSSync.getCfg) ? window.IRSSync.getCfg() : { enabled: false, space: '' };
    if (toggle) toggle.checked = cfg.enabled;
    if (spaceText) spaceText.textContent = cfg.space || '（未设置）';
    if (configBox) configBox.classList.toggle('hidden', !cfg.enabled);
    if (cfg.enabled) syncNow();
    else setSyncStatus('同步已关闭');
  }

  var syncToggle = document.getElementById('syncToggle');
  if (syncToggle) {
    syncToggle.addEventListener('change', function () {
      var on = syncToggle.checked;
      localStorage.setItem('irs_sync_on', on ? '1' : '0');
      var configBox = document.getElementById('syncConfig');
      if (configBox) configBox.classList.toggle('hidden', !on);
      if (on) {
        var space = localStorage.getItem('irs_sync_space');
        if (!space) {
          space = 'irs_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
          localStorage.setItem('irs_sync_space', space);
        }
        var spaceText = document.getElementById('syncSpaceText');
        if (spaceText) spaceText.textContent = space;
        syncNow();
      } else {
        setSyncStatus('同步已关闭');
      }
    });
  }
  var syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) syncNowBtn.addEventListener('click', syncNow);
  var syncCopyBtn = document.getElementById('syncCopyBtn');
  if (syncCopyBtn) syncCopyBtn.addEventListener('click', function () {
    var s = localStorage.getItem('irs_sync_space') || '';
    if (s && navigator.clipboard) navigator.clipboard.writeText(s);
  });

  /* ---------- 风险标识图例（关于页） ---------- */
  (function renderTagLegend() {
    var box = document.getElementById('tagLegend');
    if (!box) return;
    var html = '';
    Object.keys(TAGS).forEach(function (t) {
      var info = TAGS[t];
      html += '<span class="risk-badge" style="' + badgeStyle(info.color) + '" title="' + esc(info.desc) + '">' +
        '<span class="rb-ico">' + info.icon + '</span>' + esc(info.label) + '</span>';
    });
    box.innerHTML = html;
  })();

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
    var reader = new FileReader();
    reader.onload = function () { lastPhotoDataUrl = reader.result; };
    reader.readAsDataURL(file);
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
    lastPhotoDataUrl = null;
    analyzeHint.textContent = '已载入示例，点「开始分析」查看效果。';
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    textInput.value = ''; fileInput.value = ''; preview.src = ''; imgWrap.classList.add('hidden');
    ocrProgress.classList.add('hidden'); resultArea.innerHTML = ''; analyzeHint.textContent = '';
    lastPhotoDataUrl = null; currentResult = null;
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

  /* ---------- 远程成分库（可更新）：优先拉取 data/*.json，失败回退内置 ---------- */
  var dbStatusEl = document.getElementById('dbStatus');
  function setDbStatus(text, ok) {
    if (!dbStatusEl) return;
    dbStatusEl.textContent = text;
    dbStatusEl.className = 'db-status' + (ok === true ? ' ok' : (ok === false ? ' err' : ''));
  }
  function loadRemoteDB() {
    setDbStatus('正在同步最新成分库…');
    var noStore = { cache: 'no-store' };
    Promise.all([
      fetch('data/ingredients.json', noStore).then(function (r) { return r.json(); })
        .then(function (d) { if (Array.isArray(d) && d.length) DB = d; })
        .catch(function () { DB = window.RISK_DB || DB; }),
      fetch('data/risk-tags.json', noStore).then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.tags) TAGS = d.tags; if (d && d.map) TAG_MAP = d.map; })
        .catch(function () { TAGS = window.RISK_TAGS || TAGS; TAG_MAP = window.RISK_TAG_MAP || TAG_MAP; })
    ]).then(function () {
      try { renderLibrary(); } catch (e) {}
      fetch('data/db-version.json', noStore).then(function (r) { return r.json(); }).then(function (v) {
        setDbStatus('成分库已同步（更新于 ' + (v.updated || v.version || '最新') + '）', true);
      }).catch(function () { setDbStatus('使用内置成分库（离线）', true); });
      initSyncUI();
    }).catch(function () {
      setDbStatus('使用内置成分库（离线）', true);
      initSyncUI();
    });
  }
  loadRemoteDB();

  /* ---------- PWA Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
