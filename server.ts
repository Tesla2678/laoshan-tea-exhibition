import 'dotenv/config';
import express from 'express';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const AiartClient = tencentcloud.aiart.v20221229.Client;
const HunyuanClient = tencentcloud.hunyuan.v20230901.Client;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const PORT = process.env.PORT || 3001;
const CONFIG_FILE = './config.json';

function stripBase64(data: string) { return data.replace(/^data:image\/\w+;base64,/, ''); }
function routeProvider(model: string) { return (model || '').startsWith('hunyuan') ? 'hunyuan' : 'google'; }

// --- Load persisted config ---
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return {};
}

// --- Fetch with timeout wrapper ---
async function fetchWithTimeout(url: string, opts: RequestInit & { timeout?: number } = {}) {
  const { timeout = 60000, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal as any });
    const json = await res.json();
    clearTimeout(timer);
    return json;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`请求超时（${timeout / 1000}秒）`);
    throw err;
  }
}

// ============================================================
// GET  /api/config   — load persisted config
// POST /api/save-config — save config to file
// ============================================================
app.get('/api/config', (_req, res) => {
  res.json(loadConfig());
});

app.post('/api/save-config', (req, res) => {
  const { secretId, secretKey, apiKeys, modelMap, autoMode } = req.body;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ secretId, secretKey, apiKeys, modelMap, autoMode }, null, 2));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ============================================================
// POST /api/generate
// func: t2i | think | consultant | reedit
// model: 模型名（自动路由到对应厂商）
// ============================================================
app.post('/api/generate', async (req, res) => {
  const { func, model, prompt, image_list, maskImage, image_names, size, secretId, secretKey, apiKey } = req.body;
  const provider = routeProvider(model || '');
  const timeout = (func === 'consultant' || func === 'reedit') ? 120000 : 60000;

  if (provider === 'google') {
    const baseKeys = (apiKey || process.env.GEMINI_API_KEY || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);
    if (!baseKeys.length) return res.status(400).json({ error: { message: '缺少 Google API Key' } });

    const imageParts = (image_list || []).map((img: string) => ({
      inlineData: { data: stripBase64(img), mimeType: 'image/png' }
    }));
    if (maskImage) imageParts.push({ inlineData: { data: stripBase64(maskImage), mimeType: 'image/png' } });

    let lastError = '';
    for (const key of baseKeys) {
      try {
        const baseModelsUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

        if (func === 'think') {
          const names = (image_names && image_names.length === (image_list || []).length)
            ? image_names : (image_list || []).map((_: any, i: number) => `参考图${i + 1}`);

          const textPrompt = `你是一位顶级的崂山茶展陈设计专家，专注于在大型展览馆内打造崂山茶文化沉浸式空间。

【用户原始需求】
${prompt}

【参考图片（共 ${(image_list || []).length} 张）】
${names.join('\n')}

【你的任务】
深度分析以上 ${(image_list || []).length} 张参考图，生成完整的设计指令：

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

严格按格式输出。`;

          const body = { contents: { parts: [...imageParts, { text: textPrompt }] } };
          const data: any = await fetchWithTimeout(
            `${baseModelsUrl}/${model}:generateContent?key=${key}`,
            { method: 'POST', timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          );
          if (data.error) { lastError = data.error.message || 'Google API 错误'; continue; }
          const raw = data.candidates?.[0]?.content?.parts?.filter((p: any) => p.text)?.map((p: any) => p.text)?.join('') || '';
          const pm = raw.match(/【优化 Prompt（英文）】\s*([\s\S]*?)(?=【中文设计说明】|$)/i);
          const em = raw.match(/【中文设计说明】\s*([\s\S]*?)$/i);
          return res.json({ optimizedPrompt: pm?.[1]?.trim() || raw, explanation: em?.[1]?.trim() || '' });

        } else if (func === 'textToImage') {
          const data: any = await fetchWithTimeout(
            `${baseModelsUrl}/${model}:generateContent?key=${key}`,
            { method: 'POST', timeout, headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: { parts: [{ text: prompt }] }, generationConfig: { responseModalities: ['image', 'text'] } }) }
          );
          if (data.error) { lastError = data.error.message || 'Google API 错误'; continue; }
          let imageUrl = '', textPart = '';
          for (const p of data.candidates?.[0]?.content?.parts || []) {
            if (p.inlineData) imageUrl = `data:image/png;base64,${p.inlineData.data}`;
            else if (p.text) textPart += p.text;
          }
          if (!imageUrl) { lastError = '未生成图像'; continue; }
          return res.json({ data: [{ url: imageUrl, revised_prompt: textPart }] });

        } else if (func === 'consultant') {
          const textPrompt = `你是一位专业的展陈设计顾问，专注于在大型展览馆环境下打造崂山茶文化展示空间。
展会背景：外部是大型展馆（约2000平米，层高15米，人工光为主）。核心空间（图片1）是约100平米的独立展示区，通过隔断、展墙、帘幕等软性界面围合，顶部开放。
核心任务：1. 空间结构绝对一致性：以图片1为唯一且不可改变的建筑底稿，必须保持原有空间的隔断位置、展墙厚度、入口朝向、空间比例、层高以及视线通廊完全不变。2. 陈设小品精选：从图片2（素材库）中精选最适合崂山茶文化气质（自然、质朴、山海气息）的3-6件核心小品。3. 展会适配布局：将选定的小品精准置入图片1的既有空间内，主要陈设面向主入口。隔断/展墙作为展示载体。考虑灯光层次。预留观众驻留与体验动线。4. 视觉层次：确保近景（体验桌椅）、中景（展示主体）、远景（背景隔断）三层关系分明。5. 输出品质：输出一张完整、具有专业展陈质感的展示效果图，光影真实，色调温润。6. 附上简要设计说明（不超过200字），包括选用了哪些核心小品、布置位置与功能角色、以及如何营造崂山茶的独特场域感。`;
          const data: any = await fetchWithTimeout(
            `${baseModelsUrl}/${model}:generateContent?key=${key}`,
            { method: 'POST', timeout, headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: { parts: [...imageParts, { text: textPrompt }] } }) }
          );
          if (data.error) { lastError = data.error.message || 'Google API 错误'; continue; }
          let imageUrl = '', textPart = '';
          for (const p of data.candidates?.[0]?.content?.parts || []) {
            if (p.inlineData) imageUrl = `data:image/png;base64,${p.inlineData.data}`;
            else if (p.text) textPart += p.text;
          }
          if (!imageUrl) { lastError = '未生成图像'; continue; }
          return res.json({ data: [{ url: imageUrl, revised_prompt: textPart }] });

        } else if (func === 'reedit') {
          const textPrompt2 = maskImage
            ? `请对提供的图片进行局部修改。第一张是原始设计，第二张是遮罩（白色=需修改区域）。修改要求：${prompt}。仅修改遮罩区域，输出完整效果图。`
            : prompt;
          const data: any = await fetchWithTimeout(
            `${baseModelsUrl}/${model}:generateContent?key=${key}`,
            { method: 'POST', timeout, headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: { parts: [...imageParts, { text: textPrompt2 }] } }) }
          );
          if (data.error) { lastError = data.error.message || 'Google API 错误'; continue; }
          let imageUrl = '';
          for (const p of data.candidates?.[0]?.content?.parts || []) {
            if (p.inlineData) imageUrl = `data:image/png;base64,${p.inlineData.data}`;
          }
          if (!imageUrl) { lastError = '未生成图像'; continue; }
          return res.json({ data: [{ url: imageUrl }] });
        }
      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }
    console.error(`[/api/generate google/${func}] all keys failed:`, lastError);
    return res.status(500).json({ error: { message: `所有 Google API Key 均失败: ${lastError}` } });

  } else {
    const id = secretId || process.env.TENCENT_SECRET_ID || '';
    const key = secretKey || process.env.TENCENT_SECRET_KEY || '';
    if (!id || !key) return res.status(400).json({ error: { message: '缺少腾讯云 SecretId 或 SecretKey' } });

    let resolution = "1024:1024";
    if (size && typeof size === 'string' && size.includes('x')) resolution = size.replace('x', ':');

    try {
      if (func === 'think') {
        const hClient = new (HunyuanClient as any)({
          credential: { secretId: id, secretKey: key },
          region: "ap-shanghai",
          profile: { httpProfile: { endpoint: "hunyuan.tencentcloudapi.com" } }
        });

        const names = (image_names && image_names.length === (image_list || []).length)
          ? image_names : (image_list || []).map((_: any, i: number) => `参考图${i + 1}`);

        const analysisResults: string[] = [];
        const prompts = [
          "请详细描述这张图片的主体内容、建筑结构特征、布局方式、色彩风格和空间氛围。输出中文描述。",
          "请识别这张图片中的陈设物品，包括茶具、屏风、盆景、灯具、座椅等，指出具体形态和位置。"
        ];

        for (let i = 0; i < (image_list || []).length; i++) {
          try {
            const base64Data = stripBase64(image_list[i]);
            const r = await hClient.ImageQuestion({
              Model: "hunyuan-vision-image-question",
              Messages: [{ Role: "user", Content: [
                { Type: "image_url", ImageUrl: { Url: `data:image/png;base64,${base64Data}` } },
                { Type: "text", Text: prompts[i % prompts.length] }
              ]}]
            } as any);
            analysisResults.push(`【${names[i]}】：${r?.Choices?.[0]?.Message?.Content || r?.Answer || '无法识别'}`);
          } catch (e: any) {
            analysisResults.push(`【${names[i]}】：无法识别`);
          }
        }

        const synthesis = `你是一位顶级崂山茶展陈设计专家。请根据以下分析生成设计指令。

【用户需求】${prompt}
${analysisResults.join('\n')}

【输出要求】
【优化 Prompt（英文）】（包含空间结构、小品选择、布局、灯光、色调、风格等细节，用于图生图）
【中文设计说明】（200字以内，简述设计思路）`;

        try {
          const textR: any = await hClient.ImageQuestion({
            Model: "hunyuan-vision-image-question",
            Messages: [{ Role: "user", Content: [{ Type: "text", Text: synthesis }] }]
          });
          const result = textR?.Choices?.[0]?.Message?.Content || textR?.Answer || prompt;
          return res.json({ optimizedPrompt: result, explanation: "" });
        } catch {
          return res.json({ optimizedPrompt: prompt, explanation: "" });
        }

      } else {
        const client = new AiartClient({
          credential: { secretId: id, secretKey: key },
          region: "ap-shanghai",
          profile: { httpProfile: { endpoint: "aiart.tencentcloudapi.com" } }
        });

        const hasImages = Array.isArray(image_list) && image_list.length > 0;
        const params: any = {
          Prompt: prompt,
          Revise: 1,
          LogoAdd: 0
        };
        if (!hasImages) {
          params.Resolution = resolution;
        }
        if (hasImages) {
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
        return res.json({ data: [{ url: resultUrl, revised_prompt: revisedPrompt }] });
      }
    } catch (err: any) {
      console.error(`[/api/generate hunyuan/${func}] error:`, err.message);
      return res.status(500).json({ error: { message: err.message } });
    }
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Backend started on http://localhost:${PORT}`);
  console.log(`  POST /api/generate`);
  console.log(`  GET  /api/config`);
  console.log(`  POST /api/save-config`);
  console.log(`========================================\n`);
});
