import 'dotenv/config';
import express from 'express';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { siteConfig } from './src/site-config.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const AiartClient = tencentcloud.aiart.v20221229.Client;
const HunyuanClient = tencentcloud.hunyuan.v20230901.Client;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PORT = process.env.PORT || 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// ============================================================
// 工具函数：去掉 base64 前缀
// ============================================================
function stripBase64Prefix(data: string): string {
  return data.replace(/^data:image\/\w+;base64,/, '');
}

// ============================================================
// 多图理解 + Prompt 优化（第一阶段）
// ============================================================

/** 腾讯混元 — ImageQuestion 图生问答模型 */
async function hunyuanThink(secretId: string, secretKey: string, prompt: string, image_list: string[]): Promise<string> {
  const client = new HunyuanClient({
    credential: { secretId, secretKey },
    region: "ap-shanghai",
    profile: { httpProfile: { endpoint: "hunyuan.tencentcloudapi.com" } }
  });

  // Step 1: 分别对每张图进行理解，提取关键信息
  const imageAnalysisPrompts = [
    "请详细描述这张图片的主体内容、建筑结构特征、布局方式、色彩风格和空间氛围。输出中文描述即可。",
    "请从以下候选物品中，分析这张图片中可能包含的陈设小品：茶具、屏风、盆景、灯具、座椅、矮几、字画、帘幕、香器。指出你看到的具体物品和它们的大致形态。"
  ];

  const imageDescriptions: string[] = [];
  for (let i = 0; i < image_list.length; i++) {
    try {
      const base64Data = stripBase64Prefix(image_list[i]);
      const res = await client.ImageQuestion({
        Model: "hunyuan-vision-image-question",
        Messages: [{
          Role: "user",
          Content: [{
            Type: "image_url",
            ImageUrl: { Url: `data:image/png;base64,${base64Data}` }
          }, {
            Type: "text",
            Text: imageAnalysisPrompts[i % imageAnalysisPrompts.length]
          }]
        }]
      } as any);

      const answer = (res as any).Choices?.[0]?.Message?.Content || (res as any).Answer || "";
      imageDescriptions.push(`【图片${i + 1}分析】：${answer}`);
    } catch (err: any) {
      console.warn(`图片${i + 1}理解失败:`, err.message);
      imageDescriptions.push(`【图片${i + 1}分析】：无法识别`);
    }
  }

  // Step 2: 将图片理解结果 + 原始 prompt 合成一份详细的设计指令
  const synthesisPrompt = `你是一位顶级的崂山茶展陈设计专家。请根据以下分析结果，生成一份极其详细的展陈设计指令。

【用户原始需求】
${prompt}

${imageDescriptions.join('\n')}

【你的任务】
结合以上图片分析，生成一份完整、专业的展陈设计指令，必须包含以下部分：

【优化 Prompt（英文）】
请生成一段详细的英文描述，用于输入到图生图 AI 模型。这段描述要包含：
- 整体空间结构和布局（基于原建筑不变的部分）
- 具体的陈设小品（3-6件）及其摆放位置
- 光影氛围（射灯角度、色温、氛围灯光）
- 色彩基调
- 材质质感
- 整体风格描述（崂山茶文化、山海气息）
- 输出为一张 photorealistic exhibition design rendering

【中文设计说明】
200字以内的设计思路简述，包括核心小品选择理由和空间布局策略。

请严格按照上述格式输出。`;

  try {
    const textRes = await client.ImageQuestion({
      Model: "hunyuan-vision-image-question",
      Messages: [{
        Role: "user",
        Content: [{ Type: "text", Text: synthesisPrompt }]
      }]
    } as any);
    return (textRes as any).Choices?.[0]?.Message?.Content || (textRes as any).Answer || prompt;
  } catch (err: any) {
    console.warn("混元合成 prompt 失败:", err.message);
    return prompt;
  }
}

/** Google Gemini — 用 vision 深度分析多图，生成优化 prompt */
async function googleThink(apiKey: string, prompt: string, image_list: string[]): Promise<{ optimizedPrompt: string; explanation: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const imageParts: any[] = image_list.map((img) => ({
    inlineData: { data: stripBase64Prefix(img), mimeType: 'image/png' }
  }));

  const thinkingPrompt = `你是一位顶级的崂山茶展陈设计专家，专注于在大型展览馆内打造崂山茶文化沉浸式空间。

【用户原始需求】
${prompt}

【你的任务】
深度分析以上两张参考图，然后生成完整的设计指令：

第一步 - 图片解读：
- 图片1（展位空间）：分析原建筑结构、隔断位置、入口方向、空间比例、层高特性
- 图片2（陈设素材）：识别图中可用的茶文化小品（茶具、屏风、盆景、灯具、座椅等）

第二步 - 生成设计指令：
【优化 Prompt（英文）】
生成一段详细的英文描述（150-300词），用于输入到图生图 AI。必须包含：
- 基于原建筑不变的空间结构描述
- 精选3-6件核心陈设小品及其精确摆放位置
- 近景/中景/远景层次安排
- 灯光设计（射灯角度、色温3200K-4000K、氛围光层次）
- 崂山山海气息的色彩基调（米白、木色、青灰）
- photorealistic exhibition design rendering, 高清真实感

【中文设计说明】（200字以内）
简述核心设计思路和小品选择理由。

严格按格式输出，不要偏离格式。`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: { parts: [...imageParts, { text: thinkingPrompt }] }
  });

  const raw = response.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join('') || "";

  const promptMatch = raw.match(/【优化 Prompt（英文）】\s*([\s\S]*?)(?=【中文设计说明】|$)/i);
  const explainMatch = raw.match(/【中文设计说明】\s*([\s\S]*?)$/i);

  return {
    optimizedPrompt: promptMatch?.[1]?.trim() || raw,
    explanation: explainMatch?.[1]?.trim() || ""
  };
}

// ============================================================
// API 路由
// ============================================================

/** Step 1: 多图理解 + Prompt 优化 */
app.post('/api/think', async (req, res) => {
  const { prompt, image_list, provider, secretId, secretKey, apiKey } = req.body;

  if (!image_list || image_list.length < 2) {
    return res.json({ optimizedPrompt: prompt, explanation: "" });
  }

  try {
    if (provider === 'google') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) return res.status(400).json({ error: { message: "缺少 Google API Key" } });
      const result = await googleThink(key, prompt, image_list);
      return res.json(result);
    } else {
      const id = secretId || process.env.TENCENT_SECRET_ID;
      const key = secretKey || process.env.TENCENT_SECRET_KEY;
      if (!id || !key) return res.status(400).json({ error: { message: "缺少腾讯云密钥" } });
      const optimizedPrompt = await hunyuanThink(id, key, prompt, image_list);
      return res.json({ optimizedPrompt, explanation: "" });
    }
  } catch (err: any) {
    console.error("/api/think error:", err);
    res.json({ optimizedPrompt: prompt, explanation: "" });
  }
});

// ============================================================
// 展陈设计 /api/hunyuan（保持不变）
// ============================================================

app.post('/api/hunyuan', async (req, res) => {
  const { prompt, image_list, size, secretId: reqId, secretKey: reqKey } = req.body;
  
  const secretId = reqId || process.env.TENCENT_SECRET_ID;
  const secretKey = reqKey || process.env.TENCENT_SECRET_KEY;
  
  if (!secretId || !secretKey) {
    return res.status(400).json({ error: { message: "缺少腾讯云 SecretId 或 SecretKey" } });
  }

  const client = new AiartClient({
    credential: { secretId, secretKey },
    region: "ap-shanghai",
    profile: { httpProfile: { endpoint: "aiart.tencentcloudapi.com" } }
  });

  let resolution = "1024:1024";
  if (size && typeof size === 'string' && size.includes('x')) {
    resolution = size.replace('x', ':');
  }

  try {
    console.log("收到 Hunyuan 请求:", { prompt: prompt?.slice(0, 50), resolution, imagesCount: image_list?.length });

    const submitParams: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0
    };

    if (image_list && Array.isArray(image_list)) {
      submitParams.Images = image_list.map((img: string) => stripBase64Prefix(img));
    }

    const submitRes = await client.SubmitTextToImageJob(submitParams);
    const jobId = submitRes.JobId;
    console.log("任务提交成功, JobId:", jobId);

    let resultUrl = "";
    let revisedPrompt = "";
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const queryRes = await client.QueryTextToImageJob({ JobId: jobId });
      const statusCode = queryRes.JobStatusCode;
      console.log(`[${jobId}] 状态码: ${statusCode} (${queryRes.JobStatusMsg})`);
      if (statusCode === "5") {
        resultUrl = queryRes.ResultImage?.[0] || "";
        revisedPrompt = queryRes.RevisedPrompt?.[0] || "";
        break;
      } else if (statusCode === "4") {
        throw new Error(`生成失败: ${queryRes.JobErrorMsg || "未知错误"}`);
      }
    }

    if (!resultUrl) throw new Error("任务超时或未返回图片 URL");

    res.json({ data: [{ url: resultUrl, revised_prompt: revisedPrompt }] });

  } catch (error: any) {
    console.error("Hunyuan API 错误:", error);
    res.status(500).json({ error: { message: error.message || "服务器内部错误" } });
  }
});

// ============================================================
// 展陈设计 /api/google（保持不变）
// ============================================================

app.post('/api/google', async (req, res) => {
  const { prompt, image_list, size, apiKey: reqKey, mode, maskImage } = req.body;
  
  const apiKey = reqKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(400).json({ error: { message: "缺少 Google Gemini API Key" } });
  }

  try {
    console.log("收到 Google 请求:", { prompt: prompt?.slice(0, 50), mode, imagesCount: image_list?.length });

    const ai = new GoogleGenAI({ apiKey });

    const imageParts: any[] = [];
    
    if (image_list && Array.isArray(image_list)) {
      for (const img of image_list) {
        imageParts.push({ inlineData: { data: stripBase64Prefix(img), mimeType: 'image/png' } });
      }
    }

    if (maskImage) {
      imageParts.push({ inlineData: { data: stripBase64Prefix(maskImage), mimeType: 'image/png' } });
    }

    let textPrompt = prompt;
    const model = siteConfig.api.google.model.consultant;

    if (mode === 'consultant' && imageParts.length >= 2) {
      textPrompt = `你是一位专业的展陈设计顾问，专注于在大型展览馆环境下打造崂山茶文化展示空间。
              展会背景：外部是大型展馆（约2000平米，层高15米，人工光为主）。核心空间（图片1）是约100平米的独立展示区，通过隔断、展墙、帘幕等软性界面围合，顶部开放。
              核心任务：1. 空间结构绝对一致性：以图片1为唯一且不可改变的建筑底稿，必须保持原有空间的隔断位置、展墙厚度、入口朝向、空间比例、层高以及视线通廊完全不变。2. 陈设小品精选：从图片2（素材库）中精选最适合崂山茶文化气质（自然、质朴、山海气息）的3-6件核心小品。3. 展会适配布局：将选定的小品精准置入图片1的既有空间内，主要陈设面向主入口，具有视觉吸引力。隔断/展墙作为展示载体。考虑灯光层次：使用射灯、氛围灯强化重点。预留观众驻留与体验动线。4. 视觉层次：确保近景（体验桌椅）、中景（展示主体）、远景（背景隔断）三层关系分明。5. 输出品质：输出一张完整、具有专业展陈质感的展示效果图，光影真实，色调温润。6. 附上简要设计说明（不超过200字），包括选用了哪些核心小品、布置位置与功能角色、以及如何营造崂山茶的独特场域感。`;
    } else if (mode === 'reedit' && maskImage) {
      textPrompt = `请对提供的图片进行局部修改。第一张图是原始设计。第二张图是遮罩（Mask），白色区域代表需要修改的范围。修改要求：${prompt}。请保持遮罩区域以外的所有内容完全不变，仅在遮罩范围内进行修改。输出修改后的完整效果图。`;
    } else if (mode === 'generator') {
      textPrompt = `设计一个位于大型展馆内的崂山茶文化展位：${prompt}。风格要求：自然、质朴、山海气息，专业展陈效果图、灯光层次丰富。`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...imageParts, { text: textPrompt }] },
    });

    let imageUrl = '';
    let explanation = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      else if (part.text) explanation += part.text;
    }

    if (!imageUrl) throw new Error("未能生成效果图，请检查 API 响应。");

    res.json({ data: [{ url: imageUrl, revised_prompt: explanation || "生成成功。" }] });

  } catch (error: any) {
    console.error("Google API 错误:", error);
    res.status(500).json({ error: { message: error.message || "服务器内部错误" } });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Backend started`);
  console.log(`  Backend:  http://localhost:${PORT}`);
  console.log(`  Frontend: http://localhost:${FRONTEND_PORT}`);
  console.log(`========================================\n`);
});
