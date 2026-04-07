// ============================================================
// 崂山茶展陈顾问 · 网站配置文件
// ============================================================

// 每个功能独立选择最强模型，Hunyuan / Gemini 自由混搭
export const FUNCTIONS = {
  textToImage: {
    label: '文生图',
    models: [
      { value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-3.0-Instruct', provider: 'hunyuan' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image', provider: 'google' },
    ],
    default: 'gemini-3-pro-image-preview',
  },
  think: {
    label: '多图理解 + Prompt 优化',
    models: [
      { value: 'hunyuan-vision-image-question', label: 'Hunyuan-Vision', provider: 'hunyuan' },
      { value: 'gemini-3.1-pro-preview', label: 'Gemini-3.1-Pro', provider: 'google' },
    ],
    default: 'gemini-3.1-pro-preview',
  },
  consultant: {
    label: '多图参考生图（展陈顾问）',
    models: [
      { value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-3.0-Instruct', provider: 'hunyuan' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image', provider: 'google' },
    ],
    default: 'gemini-3-pro-image-preview',
  },
  reedit: {
    label: 'Mask 局部编辑',
    models: [
      { value: 'hunyuan-image-3.0-instruct', label: 'Hunyuan-3.0-Instruct', provider: 'hunyuan' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini-3-Pro-Image', provider: 'google' },
    ],
    default: 'gemini-3-pro-image-preview',
  },
} as const;

export const siteConfig = {
  siteTitle: '崂山茶展陈顾问',
  siteSubtitle: 'Laoshan Tea Exhibition Design',

  defaultConsultantPrompt: `作为专业展陈设计顾问，请参考我提供的两张参考图。
第一张图（输入图1）：这是展位空间结构图（基于SketchUp建立）。你必须【严格保持】第一张图中的所有空间结构、墙面隔断、出入口和视线通廊【完全不变】。
第二张图（输入图2）：这是陈设小品素材库。请将图2中的茶具、屏风、盆景等中式元素巧妙地融入到第一张图的空间中。
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
