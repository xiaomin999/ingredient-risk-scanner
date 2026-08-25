// Supabase Edge Function: ocr-vlm
// 把前端拍照的图（base64 dataURL）转给视觉大模型做 OCR 文字识别，隐藏 API Key。
//
// 部署：supabase functions deploy ocr-vlm --project-ref rbmxgcholrcwjyzwnqmv
// （在 Dashboard 粘贴本文件后点 Deploy 亦可）
//
// 环境变量（Project Settings → Edge Functions → Secrets）：
//   方式 A · 阿里云百炼（推荐，OCR 最准）
//     VLM_PROVIDER        = aliyun            （默认）
//     QWEN_API_KEY        = sk-...            （https://dashscope.aliyun.com/apiKey 领取）
//     VLM_DEFAULT_MODEL   = qwen-vl-ocr       （OCR 专精；也可 qwen-vl-plus / qwen-vl-max / qwen3-vl-flash）
//   方式 B · 智谱 GLM（完全免费、手机号注册即得，零开通门槛）
//     VLM_PROVIDER        = zhipu
//     ZHIPU_API_KEY       = ...               （https://open.bigmodel.cn 领取，GLM-4V-Flash 免费无限量）
//     VLM_DEFAULT_MODEL   = glm-4v-flash
//
// 客户端可传 {"model": "..."} 临时切换模型（需在下方 ALLOWED 列表内）。
// 函数本身不要求鉴权（verify_jwt=false），由 PWA 携带项目 anon key 匿名调用。
// 隐私：图片仅发送至你配置的厂商用于识别，本函数不存储任何图像。

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-irs-model",
  "Access-Control-Max-Age": "86400"
};

const SYSTEM_PROMPT = "你是一个专业的中文 OCR 助手。请仔细识别图片中的所有文字。\n" +
  "- 按原文逐行返回，保持原始排版与换行\n" +
  "- 不要翻译、不要总结、不要省略、不要合并多行\n" +
  "- 看不清的字符用「□」占位\n" +
  "- 只输出识别到的文字，不要任何解释或前后缀";

// 各厂商允许的模型白名单（防止客户端乱传模型名滥用）
const ALLOWED = {
  aliyun: ["qwen-vl-ocr", "qwen-vl-plus", "qwen-vl-max", "qwen3-vl-flash"],
  zhipu: ["glm-4v-flash", "glm-4v-plus"]
};

const ENDPOINTS = {
  aliyun: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  zhipu: "https://open.bigmodel.cn/api/paas/v4/chat/completions"
};

const DEFAULTS = {
  aliyun: "qwen-vl-ocr",
  zhipu: "glm-4v-flash"
};

const KEY_ENV = {
  aliyun: "QWEN_API_KEY",
  zhipu: "ZHIPU_API_KEY"
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, 405);

  const provider = (Deno.env.get("VLM_PROVIDER") || "aliyun").toLowerCase();
  if (!ENDPOINTS[provider]) {
    return jsonResponse({ error: "UNKNOWN_PROVIDER", hint: "VLM_PROVIDER 必须是 aliyun 或 zhipu" }, 400);
  }

  const apiKey = Deno.env.get(KEY_ENV[provider]);
  if (!apiKey) {
    return jsonResponse({
      error: (provider === "zhipu" ? "ZHIPU" : "QWEN") + "_API_KEY_NOT_CONFIGURED",
      hint: "在 Supabase 控制台 Project Settings → Edge Functions → Secrets 设置 " + KEY_ENV[provider]
    }, 503);
  }

  let body;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "INVALID_JSON", hint: "请求体需为 JSON" }, 400); }

  if (!body.image || typeof body.image !== "string") {
    return jsonResponse({ error: "MISSING_IMAGE", hint: "需提供 image 字段（base64 dataURL）" }, 400);
  }
  if (body.image.length > 12 * 1024 * 1024) {
    return jsonResponse({ error: "IMAGE_TOO_LARGE", hint: "请将图片长边压到 1600px 以内再上传" }, 413);
  }

  // 模型解析：客户端 model 字段 > x-irs-model header > 环境变量默认 > 内置默认
  const clientModel =
    (typeof body.model === "string" && body.model) ||
    (req.headers.get("x-irs-model") || "");
  const model =
    (ALLOWED[provider].includes(clientModel) && clientModel) ||
    (ALLOWED[provider].includes((Deno.env.get("VLM_DEFAULT_MODEL") || "").toLowerCase()) && Deno.env.get("VLM_DEFAULT_MODEL")) ||
    DEFAULTS[provider];

  const start = Date.now();
  try {
    const resp = await fetch(ENDPOINTS[provider], {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: body.image } },
              { type: "text", text: "请识别图中所有文字，按原文逐行返回。" }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2048,
        top_p: 0.9
      })
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return jsonResponse({
        error: "PROVIDER_API_ERROR",
        status: resp.status,
        provider: provider,
        detail: detail.slice(0, 1500)
      }, resp.status >= 500 ? 502 : 400);
    }

    const data = await resp.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

    return jsonResponse({
      text: String(text).trim(),
      model: model,
      provider: provider,
      latency_ms: Date.now() - start,
      usage: data.usage || null
    });
  } catch (e) {
    return jsonResponse({
      error: "OCR_CALL_FAILED",
      provider: provider,
      detail: (e && e.message) || String(e)
    }, 500);
  }
});
