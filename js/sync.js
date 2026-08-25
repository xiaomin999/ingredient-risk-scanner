/*
 * 多端同步模块 (Supabase REST / PostgREST)
 * 仅使用项目 anon key（公开，与前端硬编码等价），无需引入第三方 SDK。
 * 数据表：public.scan_records(id pk, space_key, data jsonb, updated_at)
 * 同步空间：用 space_key 区分不同用户/设备组；同一 space_key 的多台设备共享记录。
 * 冲突策略：按 updated_at 取较新版本（后写覆盖）；删除用「墓碑(tombstone)」标记 deleted:true 并同步，
 *           确保删除也能跨设备传播，而不是硬删后另一台设备又把它加回来。
 *
 * 注意：本模块只负责「读/写 Supabase」。是否启用、space_key 由 app.js 通过 localStorage 控制。
 *       建表 SQL 需用户在 Supabase SQL Editor 执行一次（见 README / 应用内「关于」）。
 */
(function (root) {
  'use strict';

  // 默认连接你的 Supabase 项目（rbmxgcholrcwjyzwnqmv）。如要换项目，可在 localStorage 覆盖。
  var CFG = {
    url: 'https://rbmxgcholrcwjyzwnqmv.supabase.co',
    anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJibXhnY2hvbHJjd2p5enducW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjAyNzQsImV4cCI6MjEwMzEzNjI3NH0.q0iqUzOAGc1YuOUY9vb8sf4fl7JxTqg9BvHLc5xLP14',
    table: 'scan_records'
  };

  function getCfg() {
    return {
      url: localStorage.getItem('irs_sb_url') || CFG.url,
      anon: localStorage.getItem('irs_sb_anon') || CFG.anon,
      space: localStorage.getItem('irs_sync_space') || '',
      enabled: localStorage.getItem('irs_sync_on') === '1'
    };
  }

  function api(path, opts) {
    var c = getCfg();
    opts = opts || {};
    var headers = {
      'apikey': c.anon,
      'Authorization': 'Bearer ' + c.anon,
      'Content-Type': 'application/json'
    };
    if (opts.headers) {
      Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    }
    return fetch(c.url + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body
    });
  }

  // 拉取某 space 的全部记录（含已删除墓碑），按 updated_at 升序
  function pull() {
    var c = getCfg();
    return api('scan_records?space_key=eq.' + encodeURIComponent(c.space) + '&order=updated_at.asc', { method: 'GET' })
      .then(function (r) {
        if (!r.ok) throw new Error('拉取失败 HTTP ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        return (rows || []).map(function (x) { return x.data; });
      });
  }

  // 批量 upsert（新增 / 更新 / 删除墓碑统一走 upsert，按 id 冲突合并）
  function push(records) {
    if (!records || !records.length) return Promise.resolve();
    var c = getCfg();
    var body = records.map(function (r) {
      return {
        id: r.id,
        space_key: c.space,
        data: r,
        updated_at: new Date(r.updated_at || Date.now()).toISOString()
      };
    });
    return api('scan_records?on_conflict=id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('推送失败 HTTP ' + r.status);
      return r;
    });
  }

  // 协调：push 本地 -> pull 远程 -> 按 id 取最新 -> 写回本地
  function sync(getLocal, setLocal, onStatus) {
    var c = getCfg();
    if (!c.enabled || !c.space) {
      if (onStatus) onStatus('同步未启用', false);
      return Promise.resolve();
    }
    var local = getLocal();
    if (onStatus) onStatus('正在同步…');
    return push(local)
      .then(function () { return pull(); })
      .then(function (remote) {
        var map = {};
        local.forEach(function (r) { map[r.id] = r; });
        remote.forEach(function (r) {
          var cur = map[r.id];
          if (!cur || (r.updated_at || 0) >= (cur.updated_at || 0)) map[r.id] = r;
        });
        var merged = Object.keys(map).map(function (k) { return map[k]; });
        setLocal(merged);
        if (onStatus) onStatus('同步完成（共 ' + merged.length + ' 条）', true);
        return merged;
      })
      .catch(function (e) {
        if (onStatus) onStatus('同步失败：' + (e && e.message ? e.message : e), false);
        return Promise.reject(e);
      });
  }

  var API = { getCfg: getCfg, pull: pull, push: push, sync: sync, CFG: CFG };
  root.IRSSync = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
