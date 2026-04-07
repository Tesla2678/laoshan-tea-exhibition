import 'dotenv/config';
import express from 'express';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const AiartClient = tencentcloud.aiart.v20221229.Client;
const HunyuanClient = tencentcloud.hunyuan.v20230901.Client;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PORT = process.env.PORT || 3001;

function stripBase64(data: string) {
  return data.replace(/^data:image\/\w+;base64,/, '');
}

function hunyuanClient(secretId: string, secretKey: string) {
  return new AiartClient({
    credential: { secretId, secretKey },
    region: "ap-shanghai",
    profile: { httpProfile: { endpoint: "aiart.tencentcloudapi.com" } }
  });
}

function hunyuanVisionClient(secretId: string, secretKey: string) {
  return new HunyuanClient({
    credential: { secretId, secretKey },
    region: "ap-shanghai",
    profile: { httpProfile: { endpoint: "hunyuan.tencentcloudapi.com" } }
  });
}

function resolveSecret(req: any) {
  return {
    secretId: req.body.secretId || process.env.TENCENT_SECRET_ID || '',
    secretKey: req.body.secretKey || process.env.TENCENT_SECRET_KEY || '',
  };
}

function resolveGoogleKey(req: any) {
  return req.body.apiKey || process.env.GEMINI_API_KEY || '';
}

// ============================================================
// 1. 文生图  T2I
// ============================================================

// Hunyuan T2I
app.post('/api/hunyuan/t2i', async (req, res) => {
  const { prompt, size, secretId, secretKey, model } = req.body;
  const { secretId: id, secretKey: key } = resolveSecret(req);
  if (!id || !key) return res.status(400).json({ error: { message: "缺少腾讯云 SecretId 或 SecretKey" } });

  const client = hunyuanClient(id, key);
  let resolution = "1024:1024";
  if (size && typeof size === 'string' && size.includes('x')) resolution = size.replace('x', ':');

  try {
    const params: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0
    };
    const submitRes = await client.SubmitTextToImageJob(params);
    const jobId = submitRes.JobId;

    let resultUrl = "";
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const q = await client.QueryTextToImageJob({ JobId: jobId });
      if (q.JobStatusCode === "5") { resultUrl = q.ResultImage?.[0] || ""; break; }
      if (q.JobStatusCode === "4") throw new Error(`生成失败: ${q.JobErrorMsg}`);
    }
    if (!resultUrl) throw new Error("任务超时");
    res.json({ data: [{ url: resultUrl }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// Google T2I
app.post('/api/google/t2i', async (req, res) => {
  const { prompt, size, apiKey, model } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return res.status(400).json({ error: { message: "缺少 Google API Key" } });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const m = model || 'gemini-3.1-flash-preview';
    const aspect = size === '4096x4096' ? '1:1' : '1:1';

    const response = await ai.models.generateContent({
      model: m,
      contents: { parts: [{ text: prompt }] },
      config: { responseModalities: ['image', 'text'] }
    } as any);

    let imageUrl = '';
    let text = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      else if (part.text) text += part.text;
    }
    if (!imageUrl) throw new Error("未生成图像");
    res.json({ data: [{ url: imageUrl, revised_prompt: text }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ============================================================
// 2. 多图理解（Prompt 优化）
// ============================================================

app.post('/api/think', async (req, res) => {
  const { prompt, image_list, image_names, provider, secretId, secretKey, apiKey, thinkModel, consultantModel } = req.body;

  if (!image_list || image_list.length < 1) {
    return res.json({ optimizedPrompt: prompt, explanation: "" });
  }

  const names = (image_names && image_names.length === image_list.length)
    ? image_names
    : image_list.map((_: any, i: number) => `参考图${i + 1}`);

  try {
    if (provider === 'google') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) return res.status(400).json({ error: { message: "缺少 Google API Key" } });
      const model = thinkModel || 'gemini-3.1-pro-preview';

      const ai = new GoogleGenAI({ apiKey: key });
      const imageParts = image_list.map((img: string) => ({
        inlineData: { data: stripBase64(img), mimeType: 'image/png' }
      }));

      const thinkingPrompt = `你是一位顶级的崂山茶展陈设计专家，专注于在大型展览馆内打造崂山茶文化沉浸式空间。

【用户原始需求】
${prompt}

【参考图片（共 ${image_list.length} 张）】
${image_list.map((_: string, i: number) => `${names[i]}：`).join('\n')}

【你的任务】
深度分析以上 ${image_list.length} 张参考图，生成完整的设计指令：

【优化 Prompt（英文）】
生成一段详细的英文描述（150-300词），用于输入到图生图 AI。必须包含：
- 整体空间结构和布局（基于原建筑不变的部分）
- 精选3-6件核心陈设小品及其精确摆放位置
- 近景/中景/远景层次安排
- 灯光设计（射灯、色温3200K-4000K、氛围光）
- 崂山山海气息的色彩基调（米白、木色、青灰）
- photorealistic exhibition design rendering, 高清真实感

【中文设计说明】（200字以内）
简述核心设计思路和小品选择理由。

严格按格式输出，不要偏离格式。`;

      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...imageParts, { text: thinkingPrompt }] }
      });

      const raw = response.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text).map((p: any) => p.text).join('') || "";

      const promptMatch = raw.match(/【优化 Prompt（英文）】\s*([\s\S]*?)(?=【中文设计说明】|$)/i);
      const explainMatch = raw.match(/【中文设计说明】\s*([\s\S]*?)$/i);

      return res.json({
        optimizedPrompt: promptMatch?.[1]?.trim() || raw,
        explanation: explainMatch?.[1]?.trim() || ""
      });

    } else {
      // Hunyuan Vision
      const { secretId: id, secretKey: key } = resolveSecret(req);
      if (!id || !key) return res.status(400).json({ error: { message: "缺少腾讯云密钥" } });
      const client = hunyuanVisionClient(id, key);

      const analysisResults: string[] = [];
      for (let i = 0; i < image_list.length; i++) {
        try {
          const base64Data = stripBase64(image_list[i]);
          const prompts = [
            "请详细描述这张图片的主体内容、建筑结构特征、布局方式、色彩风格和空间氛围。输出中文描述。",
            "请识别这张图片中的陈设物品，包括茶具、屏风、盆景、灯具、座椅等，指出具体形态和位置。"
          ];
          const r = await client.ImageQuestion({
            Model: "hunyuan-vision-image-question",
            Messages: [{
              Role: "user",
              Content: [
                { Type: "image_url", ImageUrl: { Url: `data:image/png;base64,${base64Data}` } },
                { Type: "text", Text: prompts[i % prompts.length] }
              ]
            }]
          } as any);
          analysisResults.push(`【${names[i]}】：${(r as any).Choices?.[0]?.Message?.Content || (r as any).Answer || '无法识别'}`);
        } catch (e: any) {
          analysisResults.push(`【${names[i]}】：无法识别`);
        }
      }

      // 合成为完整 prompt
      const synthesis = `你是一位顶级崂山茶展陈设计专家。请根据以下分析生成设计指令。

【用户需求】${prompt}

${analysisResults.join('\n')}

【输出要求】
【优化 Prompt（英文）】（包含空间结构、小品选择、布局、灯光、色调、风格等细节，用于图生图）
【中文设计说明】（200字以内，简述设计思路）`;

      try {
        const textR = await client.ImageQuestion({
          Model: "hunyuan-vision-image-question",
          Messages: [{ Role: "user", Content: [{ Type: "text", Text: synthesis }] }]
        } as any);
        const result = (textR as any).Choices?.[0]?.Message?.Content || (textR as any).Answer || prompt;
        return res.json({ optimizedPrompt: result, explanation: "" });
      } catch {
        return res.json({ optimizedPrompt: prompt, explanation: "" });
      }
    }
  } catch (err: any) {
    console.error("/api/think error:", err);
    res.json({ optimizedPrompt: prompt, explanation: "" });
  }
});

// ============================================================
// 3. 多图参考生图（展陈顾问）
// ============================================================

app.post('/api/hunyuan/consultant', async (req, res) => {
  const { prompt, image_list, size, secretId, secretKey } = req.body;
  const { secretId: id, secretKey: key } = resolveSecret(req);
  if (!id || !key) return res.status(400).json({ error: { message: "缺少腾讯云密钥" } });

  const client = hunyuanClient(id, key);
  let resolution = "1024:1024";
  if (size && typeof size === 'string' && size.includes('x')) resolution = size.replace('x', ':');

  try {
    const params: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0
    };
    if (image_list && Array.isArray(image_list)) {
      params.Images = image_list.map((img: string) => stripBase64(img));
    }

    const submitRes = await client.SubmitTextToImageJob(params);
    const jobId = submitRes.JobId;
    let resultUrl = "", revisedPrompt = "";
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const q = await client.QueryTextToImageJob({ JobId: jobId });
      if (q.JobStatusCode === "5") { resultUrl = q.ResultImage?.[0] || ""; revisedPrompt = q.RevisedPrompt?.[0] || ""; break; }
      if (q.JobStatusCode === "4") throw new Error(`生成失败: ${q.JobErrorMsg}`);
    }
    if (!resultUrl) throw new Error("任务超时");
    res.json({ data: [{ url: resultUrl, revised_prompt: revisedPrompt }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/api/google/consultant', async (req, res) => {
  const { prompt, image_list, size, apiKey, model } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return res.status(400).json({ error: { message: "缺少 Google API Key" } });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const m = model || 'gemini-3-pro-image-preview';
    const imageParts = (image_list || []).map((img: string) => ({
      inlineData: { data: stripBase64(img), mimeType: 'image/png' }
    }));

    const response = await ai.models.generateContent({
      model: m,
      contents: { parts: [...imageParts, { text: prompt }] }
    });

    let imageUrl = '', explanation = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      else if (part.text) explanation += part.text;
    }
    if (!imageUrl) throw new Error("未生成图像");
    res.json({ data: [{ url: imageUrl, revised_prompt: explanation }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ============================================================
// 4. Mask 局部编辑
// ============================================================

app.post('/api/hunyuan/reedit', async (req, res) => {
  const { prompt, image_list, size, secretId, secretKey } = req.body;
  const { secretId: id, secretKey: key } = resolveSecret(req);
  if (!id || !key) return res.status(400).json({ error: { message: "缺少腾讯云密钥" } });

  const client = hunyuanClient(id, key);
  let resolution = "1024:1024";
  if (size && typeof size === 'string' && size.includes('x')) resolution = size.replace('x', ':');

  try {
    const params: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0
    };
    if (image_list && Array.isArray(image_list)) {
      params.Images = image_list.map((img: string) => stripBase64(img));
    }
    const submitRes = await client.SubmitTextToImageJob(params);
    const jobId = submitRes.JobId;
    let resultUrl = "";
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const q = await client.QueryTextToImageJob({ JobId: jobId });
      if (q.JobStatusCode === "5") { resultUrl = q.ResultImage?.[0] || ""; break; }
      if (q.JobStatusCode === "4") throw new Error(`生成失败: ${q.JobErrorMsg}`);
    }
    if (!resultUrl) throw new Error("任务超时");
    res.json({ data: [{ url: resultUrl }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/api/google/reedit', async (req, res) => {
  const { prompt, image_list, maskImage, size, apiKey, model } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return res.status(400).json({ error: { message: "缺少 Google API Key" } });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const m = model || 'gemini-3-pro-image-preview';
    const parts: any[] = [];
    if (image_list) image_list.forEach((img: string) => parts.push({ inlineData: { data: stripBase64(img), mimeType: 'image/png' } }));
    if (maskImage) parts.push({ inlineData: { data: stripBase64(maskImage), mimeType: 'image/png' } });

    const fullPrompt = maskImage
      ? `请对提供的图片进行局部修改。第一张是原始设计，第二张是遮罩（白色=需修改区域）。修改要求：${prompt}。仅修改遮罩区域，输出完整效果图。`
      : prompt;

    const response = await ai.models.generateContent({ model: m, contents: { parts: [...parts, { text: fullPrompt }] } });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
    }
    if (!imageUrl) throw new Error("未生成图像");
    res.json({ data: [{ url: imageUrl }] });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Backend started on http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
