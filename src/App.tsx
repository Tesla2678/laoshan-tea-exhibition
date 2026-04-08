/**
 * Step 1: 文字生图
 * 简洁流水线：一个 prompt 输入 → MiniMax image-01 生成图片
 */

import React, { useState } from 'react';
import { Sparkles, Loader2, Settings, Palette, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface GenerationResult {
  imageUrl: string;
  revisedPrompt?: string;
}

// --- Config types ---
type Engine = 'minimax' | 'hunyuan';
type HunyuanSize = '1024x1024' | '1920x1080' | '1080x1920' | '1024x768' | '768x1024';

const defaultConfig = {
  t2i_engine: 'minimax' as Engine,
  hunyuanSize: '1024x1024' as HunyuanSize,
};

export default function Step1App() {
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveConfig = (newConfig: typeof config) => {
    setConfig(newConfig);
    setShowSettings(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const url = config.t2i_engine === 'minimax'
        ? 'http://localhost:3001/api/minimax'
        : 'http://localhost:3001/api/hunyuan';

      // 混元只支持特定 Resolution，用户选什么就传什么
      const sizeMap: Record<string, string> = {
        '1024x1024': '1024:1024',
        '1920x1080': '1280:720',
        '1080x1920': '720:1280',
        '1280x720':  '1280:720',
        '720x1280':  '720:1280',
        '1024x768':  '1024:768',
        '768x1024':  '768:1024',
      };
      const hunyanSize = sizeMap[config.hunyuanSize] ?? '1024:1024';
      const body: any = { prompt, size: hunyanSize };
      if (config.t2i_engine === 'hunyuan') {
        // secrets 由后端从 .env 读取，前端不传
        body.model = 'hunyuan-image-3.0-instruct';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `请求失败 (${response.status})`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url || data.data?.[0?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null];
      if (!imageUrl) throw new Error('未返回图片');

      setResult({ imageUrl, revisedPrompt: data.data?.[0]?.revised_prompt });
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F5F2ED]/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-lg flex items-center justify-center">
              <Palette className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-tight">Step 1 · 文生图</h1>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Text to Image</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Prompt Input */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-stone-900 rounded-full" />
            <h2 className="text-lg font-serif font-bold">描述你想要的图像</h2>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：崂山茶展位，自然质朴，山海气息，专业展陈效果图，灯光层次丰富..."
            className="w-full h-40 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 outline-none transition-all resize-none text-sm leading-relaxed"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={cn(
              'w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all',
              prompt.trim() && !isGenerating
                ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            )}
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? '生成中...' : '生成图片'}
          </button>
        </section>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs">
            {error}
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="rounded-3xl overflow-hidden bg-white shadow-2xl shadow-stone-200">
                <img src={result.imageUrl} alt="Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
              </div>
              {result.revisedPrompt && (
                <div className="mt-4 p-6 rounded-2xl bg-white border border-stone-100">
                  <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">增强后 Prompt</p>
                  <p className="text-stone-700 text-sm leading-relaxed">{result.revisedPrompt}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-stone-600" /> 设置
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">文生图模型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['minimax', 'hunyuan'] as Engine[]).map((eng) => (
                      <button key={eng} onClick={() => setConfig({ ...config, t2i_engine: eng })}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-bold border transition-all',
                          config.t2i_engine === eng
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                        )}
                      >
                        {eng === 'minimax' ? 'MiniMax image-01' : '腾讯云混元'}
                      </button>
                    ))}
                  </div>
                </div>

                {config.t2i_engine === 'hunyuan' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                      分辨率（仅混元）
                    </label>
                    <select
                      value={config.hunyuanSize}
                      onChange={(e) => setConfig({ ...config, hunyuanSize: e.target.value as HunyuanSize })}
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-medium border border-stone-200 bg-white focus:border-stone-400 outline-none"
                    >
                      <option value="1024x1024">1:1 · 1024×1024（正方形）</option>
                      <option value="1920x1080">16:9 · 1920×1080（横向宽屏）</option>
                      <option value="1080x1920">9:16 · 1080×1920（竖向宽屏）</option>
                      <option value="1024x768">4:3 · 1024×768（横向）</option>
                      <option value="768x1024">3:4 · 768×1024（竖向）</option>
                    </select>
                    <p className="text-[10px] text-stone-400">混元仅支持以上特定比例，请勿选择其他比例</p>
                  </div>
                )}
                <button onClick={() => saveConfig(config)}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all">
                  保存配置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
