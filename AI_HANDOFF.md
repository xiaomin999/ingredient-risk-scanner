# 配料表风险扫描 · 项目交接提示词（可直接复制给另一台电脑的 AI 接着优化）

> 使用方式：把下面「给接手 AI 的提示词」整段复制，粘贴到新电脑上 WorkBuddy / Claude / ChatGPT 的新会话开头即可。它包含项目全貌、硬性约定、当前状态、待办与自测清单，AI 读完就能接着改，不用从零摸索。

---

## 给接手 AI 的提示词

你是「配料表风险扫描」(ingredient-risk-scanner) 这个纯前端 PWA 的接手开发助手。请先读完下面的「项目全貌」和「硬性约定」再动手，不要凭空猜测架构。

### 一、这个项目是做什么的
一个纯静态 PWA：用户拍照或选图（食品 / 护肤品 / 化妆品的配料表、成分表），调用视觉大模型做 OCR 提取文字，再和一份「风险成分库」比对，把可能有害的成分高亮标注，并给风险等级、风险说明、敏感人群、来源出处。数据来源：央视 3·15、各地市场监管抽检、WHO/IARC、国家药监局、《化妆品安全技术规范》、GB 2760-2024。这是一个消费科普工具，带明确免责声明（不构成医疗 / 诊断依据）。

### 二、技术栈 / 架构
- 纯静态前端，无自建后端，托管在 GitHub Pages（公开仓库）。
- 识别引擎：已弃用浏览器端 Tesseract.js，改为调用 **Supabase Edge Function `ocr-vlm`**（Deno 运行时）→ 阿里云百炼 DashScope 的 Qwen-VL。Edge Function 作为代理，隐藏 API Key、做 CORS、限流。前端把图片压缩后 base64 POST 到 `/functions/v1/ocr-vlm`。
- 多端同步：Supabase 表 `public.scan_records(id text pk, space_key text, data jsonb, updated_at timestamptz)`。前端用项目 anon key（公开，等同硬编码）走 PostgREST REST API 做 pull/push/upsert，冲突按 updated_at 后写覆盖，删除用墓碑（tombstone）。
- 离线缓存：Service Worker `sw.js`，外壳缓存优先、远程风险库 `data/` 网络优先。

### 三、目录与关键文件
- `index.html` — 单页 PWA 入口；四个 view（拍照扫描 / 风险资料库 / 拍照记录 / 关于）由底部 tab（移动端）或左侧导航（桌面端）切换。
- `js/app.js` — 主逻辑：导航、OCR 调用、成分分段提取、风险匹配、结果渲染、VLM 配置、多端同步 UI、SW 注册与自动刷新。
- `js/db.js` — 风险成分库（60 条，内置兜底）。
- `js/risk-tags.js` — 9 类「危害性质」风险标识定义 + 成分→标识映射。
- `js/health-ingredients.js` — 21 条常见健康成分百科（普通成分展开说明用）。
- `js/sync.js` — Supabase 同步模块（REST）。
- `sw.js` — Service Worker，CACHE 名 `cr-shell-v8`（当前）。
- `css/style.css` — 全部样式；移动端 `@media(max-width:680px)` 把导航改为底部 tab 条。
- `data/*.json` — 远程可更新风险库（ingredients.json / risk-tags.json / db-version.json），由 `scripts/build-data.js` 从 `js/*.js` 生成。
- `supabase/functions/ocr-vlm/index.ts` — Edge Function 源码（Deno）。
- `supabase/config.toml` — Edge Function 配置（verify_jwt = false）。
- `README.md` — 说明文档。**注意：README 里「OCR 用 Tesseract.js」等描述已过时，以代码为准。**

### 四、硬性约定（务必遵守，都是踩过的坑）
1. **绝不擅自改用户的数据库 / Supabase 记录**。建表、写数据一律让用户自己在 Supabase SQL Editor 执行。AI 只允许做只读 curl 探测连通性。这是用户明确要求的红线。
2. **改了 `index.html` / `css/style.css` / `js/*.js` / `sw.js` 中任一文件，必须给 `sw.js` 的 CACHE 改名 +1**（当前 `cr-shell-v8` → 改完变 `cr-shell-v9`）。否则已装 PWA 或刷新过的浏览器会一直用旧缓存，用户看到「没变化」。改 `sw.js` 本身也同理。
3. **本地预览**：`python -m http.server 8080 --bind 127.0.0.1`，浏览器开 `http://127.0.0.1:8080/`。禁止用 `file://` 直接打开（会 404，且 SW / clipboard 不可用）。
4. **部署**：GitHub 仓库 `xiaomin999/ingredient-risk-scanner`（Public）。改完 `git add` 相关文件 → commit → push 到 `main`。GitHub Pages（legacy / main 分支模式）会自动重建，约 1–3 分钟生效。
5. **PAT（推送凭证）**：push 需要 GitHub Personal Access Token（`ghp_` 开头，至少含 `repo` scope）。当前 `.github/workflows/deploy.yml` 已写好但从未 push 成功——原因是现有 PAT 缺 `workflow` scope，GitHub 拒绝接收 workflow 文件。若要启用 Actions 自动部署，需用带 `workflow` scope 的 PAT，或去 GitHub Web UI 直接建 workflow 文件。
6. **移动端 vs 桌面端 UI**：≤680px 是底部 tab 栏（图标 + 小字，固定在屏幕底部，带 iPhone 安全区）；>680px 是左侧 236px 可折叠导航（折叠到 72px 图标条）。改导航相关 UI 时两套都要照顾。
7. **风险库扩展流程**：编辑 `js/db.js`（或 `risk-tags.js` / `health-ingredients.js`）后，跑 `node scripts/build-data.js` 生成 `data/*.json`（远程可更新），并把 `data/db-version.json` 的 `version` 升一位。

### 五、当前状态（截至 2026-09-14）
- 已上线（CACHE `cr-shell-v8`，db-version `1.1.1`）。
- 拍照 + 相册选择 两个图片入口均已就绪。
- 多端同步 UI 完整：开启自动生成同步空间 ID、复制、粘贴已有 ID 应用、立即同步、建表 SQL 内嵌。但**真正能同步的前提是用户先在 Supabase 建表**（见 README / 应用内「拍照记录」面板里的 SQL）。
- Edge Function `ocr-vlm` 源码已写好，但**需用户在 Supabase Dashboard 部署**并设 Secrets（`QWEN_API_KEY` 或 `ZHIPU_API_KEY`、`VLM_PROVIDER`），并在函数设置里关闭「Verify JWT」。未部署前，拍照识别会报 401 / 503。

### 六、已知坑 / 待办
- [ ] 用户在 Supabase 建表 + 部署 Edge Function（否则 OCR 与多端同步都跑不起来）。
- [ ] OCR 识别整张包装时，已用 `extractIngredientsSection()` 截取「配料」段、剔除地址 / 公司 / 许可证 / 宣传语；若发现新的杂质类型，在 `app.js` 的 `isNoiseToken()` 与 stoppers 正则里补。
- [ ] 风险库若需扩充，按「约定 7」流程走。
- [ ] 想启用 Actions 自动部署见「约定 5」。
- 复制按钮已做三档降级（Clipboard API → execCommand → 选中文本），旧版静默失败已修。

### 七、改动后自测清单
- `node --check js/app.js js/sync.js js/db.js js/risk-tags.js js/health-ingredients.js` 语法零报错。
- bump 了 sw CACHE 版本并 push。
- `curl -s https://xiaomin999.github.io/ingredient-risk-scanner/sw.js | grep cr-shell-v` 确认版本号已变。
- `curl -s https://xiaomin999.github.io/ingredient-risk-scanner/index.html | grep "<新元素 id>"` 确认改动已上线。
- 手机端把 PWA 上滑退出重开（或浏览器硬刷）验证新 UI。

### 八、给下个会话的开场白建议
「我准备继续优化配料表风险扫描。先告诉我你想改哪块（UI 交互 / 识别精度 / 风险库内容 / 多端同步 / 部署），我会先按交接文档读相关代码、确认影响面，再给你方案或动手。」
