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

function stripBase64(data: string) { return data.replace(/^data:image\/\w+;base64,/, ''); }

// 根据 model 名自动路由到 Hunyuan 或 Google
function routeByModel(model: string): 'hunyuan' | 'google' {
  return model.startsWith('hunyuan') ? 'hunyuan' : 'google';
}

// ============================================================
// 统一入口：/api/generate
// func: t2i | think | consultant | reedit
// model: 模型名（自动路由到对应厂商）
// ============================================================
app.post('/api/generate', async (req, res) => {
  const { func, model, prompt, image_list, maskImage, image_names, size, secretId, secretKey, apiKey } = req.body;

  const provider = routeByModel(model || '');
  const key = provider === 'hunyuan'
    ? (secretId || process.env.TENCENT_SECRET_ID || '')
    : (apiKey || process.env.GEMINI_API_KEY || '');

  if (!key) {
    return res.status(400).json({ error: { message: provider === 'hunyuan' ? '缺少 SecretId/SecretKey' : '缺少 Google API Key' } });
  }

  try {
    if (provider === 'google') {
      const ai = new GoogleGenAI({ apiKey: key });
      const imageParts = (image_list || []).map((img: string) => ({
        inlineData: { data: stripBase64(img), mimeType: 'image/png' }
      }));
      if (maskImage) imageParts.push({ inlineData: { data: stripBase64(maskImage), mimeType: 'image/png' } });

      let textPrompt = prompt;
      let resultImage = '';

      if (func === 'think') {
        // 多图理解
        const names = (image_names && image_names.length === (image_list || []).length)
          ? image_names : (image_list || []).map((_: any, i: number) => `参考图${i + 1}`);

        textPrompt = `你是一位顶级的崂山茶展陈设计专家，专注于在大型展览馆内打造崂山茶文化沉浸式空间。

【用户原始需求】
${prompt}

【参考图片（共 ${(image_list || []).length} 张）】
${(image_list || []).map((_: string, i: number) => names[i]).join('\n')}

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

        const response = await ai.models.generateContent({ model, contents: { parts: [...imageParts, { text: textPrompt }] } });
        const raw = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
        const pm = raw.match(/【优化 Prompt（英文）】\s*([\s\S]*?)(?=【中文设计说明】|$)/i);
        const em = raw.match(/【中文设计说明】\s*([\s\S]*?)$/i);
        return res.json({ optimizedPrompt: pm?.[1]?.trim() || raw, explanation: em?.[1]?.trim() || '' });

      } else if (func === 't2i') {
        const response = await ai.models.generateContent({
          model, contents: { parts: [{ text: prompt }] },
          config: { responseModalities: ['image', 'text'] }
        } as any);
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) resultImage = `data:image/png;base64,${part.inlineData.data}`;
        }
        const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
        if (!resultImage) throw new Error("未生成图像");
        return res.json({ data: [{ url: resultImage, revised_prompt: textPart }] });

      } else if (func === 'consultant') {
        textPrompt = `你是一位专业的展陈设计顾问，专注于在大型展览馆环境下打造崂山茶文化展示空间。
展会背景：外部是大型展馆（约2000平米，层高15米，人工光为主）。核心空间（图片1）是约100平米的独立展示区，通过隔断、展墙、帘幕等软性界面围合，顶部开放。
核心任务：1. 空间结构绝对一致性：以图片1为唯一且不可改变的建筑底稿，必须保持原有空间的隔断位置、展墙厚度、入口朝向、空间比例、层高以及视线通廊完全不变。2. 陈设小品精选：从图片2（素材库）中精选最适合崂山茶文化气质（自然、质朴、山海气息）的3-6件核心小品。3. 展会适配布局：将选定的小品精准置入图片1的既有空间内，主要陈设面向主入口。隔断/展墙作为展示载体。考虑灯光层次。预留观众驻留与体验动线。4. 视觉层次：确保近景（体验桌椅）、中景（展示主体）、远景（背景隔断）三层关系分明。5. 输出品质：输出一张完整、具有专业展陈质感的展示效果图，光影真实，色调温润。6. 附上简要设计说明（不超过200字），包括选用了哪些核心小品、布置位置与功能角色、以及如何营造崂山茶的独特场域感。`;
        const response = await ai.models.generateContent({ model, contents: { parts: [...imageParts, { text: textPrompt }] } });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) resultImage = `data:image/png;base64,${part.inlineData.data}`;
        }
        const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
        if (!resultImage) throw new Error("未生成图像");
        return res.json({ data: [{ url: resultImage, revised_prompt: textPart }] });

      } else if (func === 'reedit') {
        textPrompt = maskImage
          ? `请对提供的图片进行局部修改。第一张是原始设计，第二张是遮罩（白色=需修改区域）。修改要求：${prompt}。仅修改遮罩区域，输出完整效果图。`
          : prompt;
        const response = await ai.models.generateContent({ model, contents: { parts: [...imageParts, { text: textPrompt }] } });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) resultImage = `data:image/png;base64,${part.inlineData.data}`;
        }
        if (!resultImage) throw new Error("未生成图像");
        return res.json({ data: [{ url: resultImage }] });
      }

    } else {
      // Hunyuan
      const { Hunyuanaccountprovince_pub } = require('tencentcloud-sdk-nodejs/tencentcloud/services/hunyuanaccountprovince.v20230928');
      const hClient = new (HunyuanClient as any)({
        credential: { secretId: key, secretKey: secretKey || process.env.TENCENT_SECRET_KEY || '' },
        region: "ap-shanghai",
        profile: { httpProfile: { endpoint: "hunyuan.tencentcloudapi.com" } }
      });

      let resolution = "1024:1024";
      if (size && typeof size === 'string' && size.includes('x')) resolution = size.replace('x', ':');

      if (func === 'think') {
        const names = (image_names && image_names.length === (image_list || []).length)
          ? image_names : (image_list || []).map((_: any, i: number) => `参考图${i + 1}`);

        const analysisResults: string[] = [];
        for (let i = 0; i < (image_list || []).length; i++) {
          try {
            const prompts = [
              "请详细描述这张图片的主体内容、建筑结构特征、布局方式、色彩风格和空间氛围。输出中文描述。",
              "请识别这张图片中的陈设物品，包括茶具、屏风、盆景、灯具、座椅等，指出具体形态和位置。"
            ];
            const r = await hClient.ImageQuestion({
              Model: "hunyuan-vision-image-question",
              Messages: [{ Role: "user", Content: [
                { Type: "image_url", ImageUrl: { Url: image_list[i] } },
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
          const textR = await hClient.ImageQuestion({
            Model: "hunyuan-vision-image-question",
            Messages: [{ Role: "user", Content: [{ Type: "text", Text: synthesis }] }]
          } as any);
          const result = textR?.Choices?.[0]?.Message?.Content || textR?.Answer || prompt;
          return res.json({ optimizedPrompt: result, explanation: "" });
        } catch {
          return res.json({ optimizedPrompt: prompt, explanation: "" });
        }

      } else {
        // t2i / consultant / reedit — all use SubmitTextToImageJob
        const client = new AiartClient({
          credential: { secretId: key, secretKey: secretKey || process.env.TENCENT_SECRET_KEY || '' },
          region: "ap-shanghai",
          profile: { httpProfile: { endpoint: "aiart.tencentcloudapi.com" } }
        });

        const params: any = {
          Prompt: prompt,
          Resolution: resolution,
          Revise: 1,
          LogoAdd: 0
        };
        if (image_list && Array.isArray(image_list) && image_list.length > 0) {
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
    }
  } catch (err: any) {
    console.error(`/api/generate [${func}] [${provider}] error:`, err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Backend started on http://localhost:${PORT}`);
  console.log(`  Unified endpoint: POST /api/generate`);
  console.log(`========================================\n`);
});
