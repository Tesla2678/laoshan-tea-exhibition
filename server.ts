import 'dotenv/config';
import express from 'express';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
const AiartClient = tencentcloud.aiart.v20221229.Client;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// Step 2: Prompt Enhancer - MiniMax-M2.7
// Accepts reference images + prompt → returns enhanced prompt
// ============================================================
app.post('/api/enhance', async (req, res) => {
  const { prompt, image_list } = req.body;
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return res.status(400).json({ error: { message: '缺少 MINIMAX_API_KEY' } });
  if (!prompt) return res.status(400).json({ error: { message: '缺少 prompt' } });

  try {
    console.log('[Enhance] prompt 长度:', prompt.length, '图片数:', image_list?.length);

    let messages: any[] = [];
    const textPrompt = `你是一位专业展陈设计顾问。请仔细分析我提供的参考图片，结合以下设计要求，生成一个详尽、专业的图像生成 prompt。\n\n原始设计要求：\n${prompt}\n\n请输出一个增强后的英文 prompt，包含：整体氛围、色彩、光影、材料质感、空间布局、陈设小品细节描述等。要求专业、具体、可直接用于 AI 生图。`;

    if (image_list && image_list.length > 0) {
      const imageContents: any[] = image_list.map((img: string) => ({
        type: 'image_url',
        image_url: { url: img.startsWith('data:') ? img : img }
      }));
      imageContents.push({ type: 'text', text: textPrompt });
      messages = [{ role: 'user', content: imageContents }];
    } else {
      messages = [{ role: 'user', content: [{ type: 'text', text: textPrompt }] }];
    }

    const body = {
      model: 'MiniMax-M2.7',
      messages,
      max_tokens: 1024,
    };

    const response = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Enhance] API 错误:', response.status, errText);
      return res.status(response.status).json({ error: { message: `MiniMax API 错误: ${errText}` } });
    }

    const data = await response.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim() || prompt;
    console.log('[Enhance] 输出:', enhanced.slice(0, 60));
    res.json({ data: [{ prompt: enhanced }] });
  } catch (error: any) {
    console.error('[Enhance] 服务器错误:', error);
    res.status(500).json({ error: { message: error.message || '服务器内部错误' } });
  }
});

// ============================================================
// Step 3a: MiniMax Image Gen (image-01, no multi-image ref)
// ============================================================
app.post('/api/minimax', async (req, res) => {
  const { prompt, size } = req.body;
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return res.status(400).json({ error: { message: '缺少 MINIMAX_API_KEY' } });
  if (!prompt) return res.status(400).json({ error: { message: '缺少 prompt' } });

  // size → aspect_ratio
  let aspectRatio = '1:1';
  if (size && typeof size === 'string' && size.includes('x')) {
    const [w, h] = size.split('x').map(Number);
    if (w && h) {
      const ratio = w / h;
      if (Math.abs(ratio - 1) < 0.1) aspectRatio = '1:1';
      else if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = '16:9';
      else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = '4:3';
      else if (Math.abs(ratio - 3 / 2) < 0.1) aspectRatio = '3:2';
      else if (Math.abs(ratio - 2 / 3) < 0.1) aspectRatio = '2:3';
      else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = '3:4';
      else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = '9:16';
      else if (Math.abs(ratio - 21 / 9) < 0.1) aspectRatio = '21:9';
    }
  }

  try {
    console.log('[MiniMax] 文生图 aspect_ratio:', aspectRatio);
    const requestBody = {
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      response_format: 'url',
    };

    const response = await fetch('https://api.minimax.io/v1/image_generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[MiniMax] API 错误:', response.status, errText);
      return res.status(response.status).json({ error: { message: `MiniMax API 错误: ${errText}` } });
    }

    const data = await response.json();
    const imageUrl = data.data?.image_urls?.[0] || '';
    res.json({ data: [{ url: imageUrl }] });
  } catch (error: any) {
    console.error('[MiniMax] 服务器错误:', error);
    res.status(500).json({ error: { message: error.message || '服务器内部错误' } });
  }
});

// ============================================================
// Step 3b: 腾讯云混元 (多图融合 + 单图文生图)
// ============================================================
app.post('/api/hunyuan', async (req, res) => {
  const { prompt, image_list, size, secretId: reqId, secretKey: reqKey } = req.body;
  const secretId = reqId || process.env.TENCENT_SECRET_ID;
  const secretKey = reqKey || process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) return res.status(400).json({ error: { message: '缺少腾讯云 SecretId 或 SecretKey' } });

  const client = new AiartClient({
    credential: { secretId, secretKey },
    region: 'ap-shanghai',
    profile: { httpProfile: { endpoint: 'aiart.tencentcloudapi.com' } }
  });

  // 将 WxH 尺寸转换为腾讯云混元支持的 Resolution 宽高比格式
  // 腾讯云只接受特定的 W:H 比例枚举值，不接受任意数值
  const toResolution = (sizeStr: string | undefined): string => {
    if (!sizeStr || typeof sizeStr !== 'string' || !sizeStr.includes('x')) {
      return '1024:1024';
    }
    const [w, h] = sizeStr.split('x').map(Number);
    if (!w || !h) return '1024:1024';
    const ratio = w / h;
    // 混元支持的宽高比枚举
    const ratios: [number, string][] = [
      [1.0, '1024:1024'],
      [16 / 9, '1280:720'],
      [9 / 16, '720:1280'],
      [4 / 3, '1024:768'],
      [3 / 4, '768:1024'],
      [2 / 1, '1280:640'],
      [1 / 2, '640:1280'],
      [21 / 9, '1472:630'],
      [9 / 21, '630:1472'],
    ];
    for (const [r, res] of ratios) {
      if (Math.abs(ratio - r) < 0.05) return res;
    }
    // 最接近的默认
    return '1024:1024';
  };

  const resolution = toResolution(size);

  try {
    console.log('[Hunyuan] prompt 长度:', prompt.length, '图片数:', image_list?.length, 'Resolution:', resolution);
    const submitParams: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0,
    };
    if (image_list && image_list.length > 0) {
      submitParams.Images = image_list.map((img: string) => img.replace(/^data:image\/\w+;base64,/, ''));
    }

    const submitRes = await client.SubmitTextToImageJob(submitParams);
    const jobId = submitRes.JobId;
    console.log('[Hunyuan] JobId:', jobId);

    let resultUrl = '';
    let revisedPrompt = '';
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const queryRes = await client.QueryTextToImageJob({ JobId: jobId });
      if (queryRes.JobStatusCode === '5') {
        resultUrl = queryRes.ResultImage?.[0] || '';
        revisedPrompt = queryRes.RevisedPrompt?.[0] || '';
        break;
      } else if (queryRes.JobStatusCode === '4') {
        throw new Error(`生成失败: ${queryRes.JobErrorMsg || '未知错误'}`);
      }
    }
    if (!resultUrl) throw new Error('任务超时或未返回图片 URL');
    res.json({ data: [{ url: resultUrl, revised_prompt: revisedPrompt }] });
  } catch (error: any) {
    console.error('[Hunyuan] 错误:', error);
    res.status(500).json({ error: { message: error.message || '服务器内部错误' } });
  }
});

// ============================================================
// Step 4: Mask 局部重绘 (腾讯云混元)
// ============================================================
app.post('/api/mask-edit', async (req, res) => {
  const { prompt, image_list, size, secretId: reqId, secretKey: reqKey } = req.body;
  const secretId = reqId || process.env.TENCENT_SECRET_ID;
  const secretKey = reqKey || process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) return res.status(400).json({ error: { message: '缺少腾讯云 SecretId 或 SecretKey' } });

  const client = new AiartClient({
    credential: { secretId, secretKey },
    region: 'ap-shanghai',
    profile: { httpProfile: { endpoint: 'aiart.tencentcloudapi.com' } }
  });

  // 将 WxH 尺寸转换为腾讯云混元支持的 Resolution 宽高比格式（复用上面的 toResolution）
  const toResolution = (sizeStr: string | undefined): string => {
    if (!sizeStr || typeof sizeStr !== 'string' || !sizeStr.includes('x')) {
      return '1024:1024';
    }
    const [w, h] = sizeStr.split('x').map(Number);
    if (!w || !h) return '1024:1024';
    const ratio = w / h;
    const ratios: [number, string][] = [
      [1.0, '1024:1024'],
      [16 / 9, '1280:720'],
      [9 / 16, '720:1280'],
      [4 / 3, '1024:768'],
      [3 / 4, '768:1024'],
      [2 / 1, '1280:640'],
      [1 / 2, '640:1280'],
      [21 / 9, '1472:630'],
      [9 / 21, '630:1472'],
    ];
    for (const [r, res] of ratios) {
      if (Math.abs(ratio - r) < 0.05) return res;
    }
    return '1024:1024';
  };

  const resolution = toResolution(size);

  try {
    if (!image_list || image_list.length < 2) {
      throw new Error('局部重绘需要原图和蒙版图');
    }
    const submitParams: any = {
      Prompt: prompt,
      Resolution: resolution,
      Revise: 1,
      LogoAdd: 0,
      Images: image_list.map((img: string) => img.replace(/^data:image\/\w+;base64,/, '')),
    };

    const submitRes = await client.SubmitTextToImageJob(submitParams);
    const jobId = submitRes.JobId;
    console.log('[MaskEdit] JobId:', jobId);

    let resultUrl = '';
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const queryRes = await client.QueryTextToImageJob({ JobId: jobId });
      if (queryRes.JobStatusCode === '5') {
        resultUrl = queryRes.ResultImage?.[0] || '';
        break;
      } else if (queryRes.JobStatusCode === '4') {
        throw new Error(`局部重绘失败: ${queryRes.JobErrorMsg || '未知错误'}`);
      }
    }
    if (!resultUrl) throw new Error('局部重绘任务超时');
    res.json({ data: [{ url: resultUrl }] });
  } catch (error: any) {
    console.error('[MaskEdit] 错误:', error);
    res.status(500).json({ error: { message: error.message || '服务器内部错误' } });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`后端已启动: http://localhost:${PORT}`));
