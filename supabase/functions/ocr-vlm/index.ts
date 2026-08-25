// 部署：supabase functions deploy ocr-vlm --project-ref rbmxgcholrcwjyzwnqmv
// 必需环境变量：QWEN_API_KEY （阿里云百炼 DashScope API Key，sk- 开头；开通 https://dashscope.aliyun.com/apiKey 领取）
// 可选环境变量：VLM_DEFAULT_MODEL （默认 qwen-vl-plus；想用更强模型可设 qwen-vl-max）
// 函数本身不要求鉴权（verify_jwt=false），由 PWA 携带项目 anon key 匿名调用。
// 隐私：图片会发送到阿里云百炼用于识别，本函数不存储任何图像。

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400"
};

const SYSTEM_PROMPT = "你是一个专业的中文 OCR 助手。请仔细识别图片中的所有文字。\n" +
  "- 按原文逐行返回，保持原始排版与换行\n" +
  "- 不要翻译、不要总结、不要省略\n" +
  "- 看不清的字符用「□」占位\n" +
  "- 只输出识别到的文字，不要任何解释或前后缀";

const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const apiKey = Deno.env.get("QWEN_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      error: "QWEN_API_KEY_NOT_CONFIGURED",
      hint: "在 Supabase 控制台 Project Settings → Edge Functions → Secrets 设置 QWEN_API_KEY"
    }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON", hint: "请求体需为 JSON" }, 400);
  }

  if (!body.image || typeof body.image !== "string") {
    return jsonResponse({ error: "MISSING_IMAGE", hint: "需提供 image 字段（base64 dataURL）" }, 400);
  }

  // 简单的容量保护：base64 长度超 12MB（≈ 9MB 原图）直接拒绝
  if (body.image.length > 12 * 1024 * 1024) {
    return jsonResponse({ error: "IMAGE_TOO_LARGE", hint: "请将图片长边压到 1600px 以内再上传" }, 413);
  }

  const model = body.model || Deno.env.get("VLM_DEFAULT_MODEL") || "qwen-vl-plus";
  const start = Date.now();

  try {
    const resp = await fetch(DASHSCOPE_URL, {
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
        error: "DASHSCOPE_ERROR",
        status: resp.status,
        detail: detail.slice(0, 1000)
      }, resp.status >= 500 ? 502 : 400);
    }

    const data = await resp.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

    return jsonResponse({
      text: String(text).trim(),
      model: model,
      latency_ms: Date.now() - start,
      usage: data.usage || null
    });
  } catch (e) {
    return jsonResponse({
      error: "OCR_CALL_FAILED",
      detail: (e && e.message) || String(e)
    }, 500);
  }
});
