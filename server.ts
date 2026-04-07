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
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PORT = process.env.PORT || 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// --- 前端初始化配置 + .env 密钥（自动填充到前端 Settings） ---
app.get('/api/init-config', (_req, res) => {
  res.json({
    site: {
      title: siteConfig.siteTitle,
      subtitle: siteConfig.siteSubtitle,
      defaultConsultantPrompt: siteConfig.defaultConsultantPrompt,
      designPrinciples: siteConfig.designPrinciples,
      loadingText: siteConfig.loadingText,
      loadingSubText: siteConfig.loadingSubText,
      emptyTitle: siteConfig.emptyTitle,
      emptyDesc: siteConfig.emptyDesc,
      footer: siteConfig.footer,
    },
    defaults: {
      provider: 'hunyuan',
      hunyuanBaseUrl: siteConfig.api.hunyuan.baseUrl,
      hunyuanModel: siteConfig.api.hunyuan.model,
      googleBaseUrl: siteConfig.api.google.baseUrl,
      googleModelConsultant: siteConfig.api.google.model.consultant,
      googleModelReedit: siteConfig.api.google.model.reedit,
      googleModelGenerator: siteConfig.api.google.model.generator,
    },
    // 密钥始终从 .env 读取，绝不硬编码
    secrets: {
      secretId: process.env.TENCENT_SECRET_ID || '',
      secretKey: process.env.TENCENT_SECRET_KEY || '',
      googleApiKey: process.env.GEMINI_API_KEY || '',
    },
    ports: {
      backend: PORT,
      frontend: FRONTEND_PORT,
    },
  });
});

// --- Hunyuan ( Tencent Cloud ) Endpoint ---
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
    profile: { 
      httpProfile: { 
        endpoint: "aiart.tencentcloudapi.com" 
      } 
    }
  });

  let resolution = "1024:1024";
  if (size && typeof size === 'string' && size.includes('x')) {
    resolution = size.replace('x', ':');
  }

  try {
    console.log("收到 Hunyuan 请求:", { prompt, resolution, imagesCount: image_list?.length });

    const submitParams: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0
    };

    if (image_list && Array.isArray(image_list)) {
      submitParams.Images = image_list.map((img: string) => img.replace(/^data:image\/\w+;base64,/, ''));
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

    res.json({
      data: [{ url: resultUrl, revised_prompt: revisedPrompt }]
    });

  } catch (error: any) {
    console.error("Hunyuan API 错误:", error);
    res.status(500).json({ 
      error: { message: error.message || "服务器内部错误" } 
    });
  }
});

// --- Google Gemini Endpoint ---
app.post('/api/google', async (req, res) => {
  const { prompt, image_list, size, apiKey: reqKey, mode, maskImage } = req.body;
  
  const apiKey = reqKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(400).json({ error: { message: "缺少 Google Gemini API Key" } });
  }

  try {
    console.log("收到 Google 请求:", { prompt, mode, imagesCount: image_list?.length, hasMask: !!maskImage });

    const ai = new GoogleGenAI({ apiKey });

    const imageParts: any[] = [];
    
    if (image_list && Array.isArray(image_list)) {
      for (const img of image_list) {
        const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
        imageParts.push({
          inlineData: {
            data: base64Data,
            mimeType: 'image/png',
          },
        });
      }
    }

    if (maskImage) {
      const maskBase64 = maskImage.replace(/^data:image\/\w+;base64,/, '');
      imageParts.push({
        inlineData: {
          data: maskBase64,
          mimeType: 'image/png',
        },
      });
    }

    let textPrompt = prompt;
    // consultant / reedit / generator 统一使用 gemini-3-pro-image-preview
    const model = siteConfig.api.google.model.consultant;

    if (mode === 'consultant' && imageParts.length >= 2) {
      textPrompt = `你是一位专业的展陈设计顾问，专注于在大型展览馆环境下打造崂山茶文化展示空间。
              
              展会背景：
              - 外部是大型展馆（约2000平米，层高15米，人工光为主）。
              - 核心空间（图片1）是约100平米的独立展示区，通过隔断、展墙、帘幕等软性界面围合，顶部开放。
              
              你的核心任务（最高优先级）：
              1. **空间结构绝对一致性**：以图片1为唯一且不可改变的建筑底稿。必须保持原有空间的隔断位置、展墙厚度、入口朝向、空间比例、层高以及视线通廊**完全不变**。严禁对图片1中的任何建筑构件进行删除、移动或变形。
              2. **陈设小品精选**：从图片2（素材库）中精选最适合崂山茶文化气质（自然、质朴、山海气息）的3-6件核心小品。
              3. **展会适配布局**：
                 - 将选定的小品精准"置入"图片1的既有空间内。
                 - 主要陈设面向主入口，具有视觉吸引力。
                 - 隔断/展墙作为展示载体（挂画、装置等）。
                 - 考虑灯光层次：使用射灯、氛围灯强化重点，弥补展馆高远带来的光线不足。
                 - 预留观众驻留与体验动线。
              4. **视觉层次**：确保近景（体验桌椅）、中景（展示主体）、远景（背景隔断）三层关系分明。
              5. **输出品质**：输出一张完整、具有专业展陈质感的展示效果图，光影真实，色调温润。
              6. **附上简要设计说明**（不超过200字），包括：选用了哪些核心小品、布置位置与功能角色、以及如何营造崂山茶的独特场域感。`;
    } else if (mode === 'reedit' && maskImage) {
      textPrompt = `请对提供的图片进行局部修改。
              
              第一张图是原始设计。
              第二张图是遮罩（Mask），白色区域代表需要修改的范围。
              
              修改要求：${prompt}。
              
              请保持遮罩区域以外的所有内容完全不变，仅在遮罩范围内进行修改。输出修改后的完整效果图。`;
    } else if (mode === 'generator') {
      textPrompt = `设计一个位于大型展馆内的崂山茶文化展位：${prompt}。风格要求：自然、质朴、山海气息、专业展陈效果图、灯光层次丰富。`;
    }

    const contents: any = { parts: [...imageParts, { text: textPrompt }] };

    const response = await ai.models.generateContent({
      model,
      contents,
    });

    let imageUrl = '';
    let explanation = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      } else if (part.text) {
        explanation += part.text;
      }
    }

    if (!imageUrl) {
      throw new Error("未能生成效果图，请检查 API 响应。");
    }

    res.json({
      data: [{ url: imageUrl, revised_prompt: explanation || "生成成功。" }]
    });

  } catch (error: any) {
    console.error("Google API 错误:", error);
    res.status(500).json({ 
      error: { message: error.message || "服务器内部错误" } 
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  后端服务已启动`);
  console.log(`  后端:  http://localhost:${PORT}`);
  console.log(`  前端:  http://localhost:${FRONTEND_PORT}`);
  console.log(`  初始化配置: GET http://localhost:${PORT}/api/init-config`);
  console.log(`========================================\n`);
});
