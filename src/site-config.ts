// ============================================================
// 崂山茶展陈顾问 · 网站配置文件
// 硬编码内容在此处管理，每次启动自动加载
// ============================================================

export const siteConfig = {
  // --- 网站信息 ---
  siteTitle: '崂山茶展陈顾问',
  siteSubtitle: 'Laoshan Tea Exhibition Design',

  // --- 默认设计指令 Prompt ---
  defaultConsultantPrompt: `作为专业展陈设计顾问,请参考我提供的两张参考图。
第一张图(输入图1):这是展位空间结构图(基于SketchUp建立)。你必须【严格保持】第一张图中的所有空间结构、墙面隔断、出入口和视线通廊【完全不变】。
第二张图(输入图2):这是陈设小品素材库。请将图2中的茶具、屏风、盆景等中式元素巧妙地融入到第一张图的空间中。
风格要求:自然质朴,山海气息,高级专业展陈效果图,灯光层次丰富,克制陈设(3-6件核心小品),打造崂山茶文化沉浸式质感。务必在不改变原建筑结构的前提下,呈现出照片级的高清真实光影效果!`,

  // --- 设计原则列表 ---
  designPrinciples: [
    '忠于原空间：严格保持隔断、入口与视线通廊不变。',
    '展会适配：考虑人流视线，主要陈设面向主入口。',
    '灯光层次：使用射灯与氛围灯强化展陈重点。',
    '崂山山海：体现自然质朴、有山海气息的地域特色。',
    '克制陈设：以3-6件核心小品构建沉浸式场域。',
  ],

  // --- API 配置默认值 ---
  api: {
    hunyuan: {
      baseUrl: 'http://localhost:3001/api/hunyuan',
      model: 'hunyuan-image-3.0-instruct',
    },
    google: {
      baseUrl: 'http://localhost:3001/api/google',
      model: {
        consultant: 'gemini-3-pro-image-preview',
        reedit: 'gemini-3-pro-image-preview',
        generator: 'gemini-3-pro-image-preview',
      },
    },
  },

  // --- 加载状态文案 ---
  loadingText: '正在为您构思...',
  loadingSubText: '正在分析展位结构与视线，打造沉浸式崂山茶场域',

  // --- 空状态文案 ---
  emptyTitle: '等待开启设计之旅',
  emptyDesc: '请在左侧上传您的展位空间结构图与陈设素材，我们将为您生成专业的崂山茶展陈效果图。',

  // --- 版权信息 ---
  footer: {
    copyright: '© 2026 崂山茶展陈顾问 · 沉浸式设计系统',
    links: [
      { label: '关于崂山茶', href: '#' },
      { label: '设计规范', href: '#' },
      { label: '联系我们', href: '#' },
    ],
  },
};

// 供 server.ts 读取的类型（不带默认值，仅做类型标注）
export interface SiteConfig {
  siteTitle: string;
  siteSubtitle: string;
  defaultConsultantPrompt: string;
  designPrinciples: string[];
  api: {
    hunyuan: {
      baseUrl: string;
      model: string;
    };
    google: {
      baseUrl: string;
      model: {
        consultant: string;
        reedit: string;
        generator: string;
      };
    };
  };
  loadingText: string;
  loadingSubText: string;
  emptyTitle: string;
  emptyDesc: string;
  footer: {
    copyright: string;
    links: { label: string; href: string }[];
  };
}
