// ============================================================
// 崂山茶展陈顾问 · 网站配置文件
// ============================================================

// 4 个功能的模型选项
// 每个功能只保留最强模型：Hunyuan vs Gemini 最强者对比
export const MODEL_OPTIONS = {
  hunyuan: {
    label: 'Tencent Hunyuan（最强）',
    models: {
      textToImage:       [{ value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-Image-3.0-Instruct' }],
      think:            [{ value: 'hunyuan-vision-image-question', label: 'Hunyuan-Vision-Image-Question' }],
      consultant:        [{ value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-Image-3.0-Instruct' }],
      reedit:           [{ value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-Image-3.0-Instruct' }],
    },
  },
  google: {
    label: 'Google Gemini（最强）',
    models: {
      textToImage:       [{ value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image-Preview' }],
      think:              [{ value: 'gemini-3.1-pro-preview', label: 'Gemini-3.1-Pro-Preview' }],
      consultant:         [{ value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image-Preview' }],
      reedit:             [{ value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image-Preview' }],
    },
  },
} as const;

export const siteConfig = {
  siteTitle: '崂山茶展陈顾问',
  siteSubtitle: 'Laoshan Tea Exhibition Design',

  defaultConsultantPrompt: `作为专业展陈设计顾问，请参考我提供的参考图，将茶具、屏风、盆景等中式元素巧妙地融入空间。
风格要求：自然质朴，山海气息，高级专业展陈效果图，灯光层次丰富，克制陈设（3-6件核心小品），打造崂山茶文化沉浸式质感。务必在不改变原建筑结构的前提下，呈现出照片级的高清真实光影效果！`,

  designPrinciples: [
    '忠于原空间：严格保持隔断、入口与视线通廊不变。',
    '展会适配：考虑人流视线，主要陈设面向主入口。',
    '灯光层次：使用射灯与氛围灯强化展陈重点。',
    '崂山山海：体现自然质朴、有山海气息的地域特色。',
    '克制陈设：以3-6件核心小品构建沉浸式场域。',
  ],

  loadingText: '正在为您构思...',
  loadingSubText: '正在分析展位结构与视线，打造沉浸式崂山茶场域',

  emptyTitle: '等待开启设计之旅',
  emptyDesc: '上传多张参考图，AI 将深度分析并生成专业展陈效果图',

  footer: {
    copyright: '© 2026 崂山茶展陈顾问 · 沉浸式设计系统',
    links: [
      { label: '关于崂山茶', href: '#' },
      { label: '设计规范', href: '#' },
      { label: '联系我们', href: '#' },
    ],
  },
};
