/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, Image as ImageIcon, Sparkles, Loader2, Info,
  Maximize2, RefreshCw, Palette, Settings, X, Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { siteConfig } from './site-config';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

declare global { interface Window {
  __SECRET_ID__: string; __SECRET_KEY__: string;
  __GOOGLE_API_KEY__: string; __BACKEND_PORT__: string; __FRONTEND_PORT__: string;
}}
const env = {
  siteTitle: siteConfig.siteTitle,
  siteSubtitle: siteConfig.siteSubtitle,
  backendPort: window.__BACKEND_PORT__ || '3001',
  frontendPort: window.__FRONTEND_PORT__ || '3000',
  secretId: window.__SECRET_ID__ || '',
  secretKey: window.__SECRET_KEY__ || '',
  googleApiKey: window.__GOOGLE_API_KEY__ || '',
};

interface DesignResult { imageUrl: string; explanation: string; }

// --- 图片上传 ---
const ImageUpload = ({ label, image, onUpload, icon: Icon }: { label: string; image: string | null; onUpload: (b64: string) => void; icon: any }) => {
  const onDrop = useCallback((files: File[]) => {
    const r = new FileReader();
    r.onload = () => onUpload(r.result as string);
    r.readAsDataURL(files[0]);
  }, [onUpload]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false } as any);
  return (
    <div {...getRootProps()} className={cn("relative aspect-video rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden group",
      isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200 hover:border-stone-400 bg-stone-50/50", image && "border-none")}>
      <input {...getInputProps()} />
      {image ? (
        <>
          <img src={image} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
            <p className="text-white text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> 重新上传</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Icon className="w-6 h-6 text-stone-500" /></div>
          <p className="text-sm font-medium text-stone-700">{label}</p>
          <p className="text-xs text-stone-400 mt-1">点击或拖拽图片至此</p>
        </div>
      )}
    </div>
  );
};

// --- 涂抹画布 ---
const BrushCanvas = ({ imageUrl, onSaveMask, onCancel }: { imageUrl: string; onSaveMask: (b64: string) => void; onCancel: () => void }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);

  const getPos = (e: React.MouseEvent | React.TouchEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    return 'touches' in e ? { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }
      : { x: (e as React.MouseEvent).clientX - r.left, y: (e as React.MouseEvent).clientY - r.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { x, y } = getPos(e, c);
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e, canvasRef.current);
    ctx.lineTo(x, y); ctx.strokeStyle = 'rgba(255,0,0,0.5)'; ctx.lineWidth = brushSize;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const stop = () => setIsDrawing(false);
  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    const tc = document.createElement('canvas');
    tc.width = c.width; tc.height = c.height;
    const ctx = tc.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, tc.width, tc.height);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, tc.width, tc.height);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i] > 0 || d.data[i+1] > 0 || d.data[i+2] > 0) { d.data[i]=255; d.data[i+1]=255; d.data[i+2]=255; d.data[i+3]=255; }
      else { d.data[i]=0; d.data[i+1]=0; d.data[i+2]=0; d.data[i+3]=255; }
    }
    ctx.putImageData(d, 0, 0);
    onSaveMask(tc.toDataURL('image/png'));
  };

  return (
    <div className="relative w-full h-full group">
      <img src={imageUrl} alt="Edit" className="w-full h-auto block rounded-3xl"
        onLoad={(e) => { if (canvasRef.current) { canvasRef.current.width = e.currentTarget.width; canvasRef.current.height = e.currentTarget.height; } }} />
      <canvas ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      <div className="absolute top-4 left-4 flex gap-2">
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg flex items-center gap-3 border border-stone-200">
          <div className="flex items-center gap-2 px-2 border-r border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-400">笔刷</span>
            <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 accent-stone-900" />
          </div>
          <button onClick={() => { const c = canvasRef.current; if (c) { const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c.width, c.height); } }}
            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-600" title="清空"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-white/90 text-stone-600 rounded-xl text-xs font-bold hover:bg-white">取消</button>
        <button onClick={save} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> 确认</button>
      </div>
    </div>
  );
};

// --- 主应用 ---
export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({
    provider: 'hunyuan' as 'hunyuan' | 'google',
    baseUrl: `http://localhost:${env.backendPort}/api/hunyuan`,
    secretId: env.secretId, secretKey: env.secretKey,
    model: 'hunyuan-image-3.0-instruct',
    googleApiKey: env.googleApiKey,
  });

  const [spaceImage, setSpaceImage] = useState<string | null>(null);
  const [libraryImage, setLibraryImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'consultant' | 'generator'>('consultant');
  const [consultantPrompt, setConsultantPrompt] = useState(siteConfig.defaultConsultantPrompt);
  const [prompt, setPrompt] = useState('');
  const [imageSize, setImageSize] = useState<string>('2048x2048');
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  // 思考阶段状态
  const [thinkingPhase, setThinkingPhase] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [optimizedExplanation, setOptimizedExplanation] = useState('');
  const [isFinalGenerating, setIsFinalGenerating] = useState(false);

  const saveConfig = (cfg: typeof config) => { setConfig(cfg); setShowSettings(false); };

  // --- Step 1: 多图理解 + 优化 Prompt ---
  const handleStartThinking = async () => {
    if (!spaceImage || !libraryImage) return;
    setIsGenerating(true); setThinkingPhase(true);
    setError(null); setOptimizedPrompt(''); setOptimizedExplanation('');

    try {
      const res = await fetch('/api/think', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: consultantPrompt, image_list: [spaceImage, libraryImage],
          provider: config.provider, secretId: config.secretId, secretKey: config.secretKey, apiKey: config.googleApiKey,
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
      const data = await res.json();
      setOptimizedPrompt(data.optimizedPrompt || consultantPrompt);
      setOptimizedExplanation(data.explanation || '');
    } catch (err: any) { setError(err.message); setThinkingPhase(false); }
    finally { setIsGenerating(false); }
  };

  // --- Step 2: 用优化 Prompt 生成最终效果图 ---
  const handleConfirmGenerate = async () => {
    if (!optimizedPrompt) return;
    setIsFinalGenerating(true); setThinkingPhase(false);
    setError(null); setResult(null); setIsBrushMode(false); setMaskBase64(null);

    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch(config.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId: config.secretId, secretKey: config.secretKey, model: config.model, prompt: optimizedPrompt, size: "1024:1024", response_format: "url", image_list: [spaceImage, libraryImage] }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (!imageUrl) throw new Error("未返回有效图像");
        setResult({ imageUrl, explanation: optimizedExplanation || data.data?.[0]?.revised_prompt || "生成成功。" });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: config.googleApiKey, prompt: optimizedPrompt, mode: 'consultant', image_list: [spaceImage, libraryImage], size: "1024x1024" }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: optimizedExplanation || data.data[0].revised_prompt || "生成成功。" });
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsFinalGenerating(false); }
  };

  // --- 局部重绘 ---
  const handleReEdit = async () => {
    if (!result || !maskBase64 || !editPrompt) return;
    setIsFinalGenerating(true); setError(null);
    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch(config.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId: config.secretId, secretKey: config.secretKey, model: config.model, prompt: editPrompt, size: "1024:1024", image_list: [result.imageUrl, maskBase64] }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ ...result, imageUrl: data.data[0].url });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: config.googleApiKey, prompt: editPrompt, mode: 'reedit', image_list: [result.imageUrl], maskImage: maskBase64, size: "1024x1024" }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ ...result, imageUrl: data.data[0].url });
      }
      setIsBrushMode(false); setMaskBase64(null); setEditPrompt('');
    } catch (err: any) { setError(err.message); }
    finally { setIsFinalGenerating(false); }
  };

  // --- 灵感生成 ---
  const handleGenerateFromScratch = async () => {
    if (!prompt) return;
    setIsGenerating(true); setError(null);
    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch(config.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId: config.secretId, secretKey: config.secretKey, model: config.model, prompt: `设计一个位于大型展馆内的崂山茶文化展位：${prompt}。风格要求：自然、质朴、山海气息，专业展陈效果图、灯光层次丰富。`, size: "1024:1024", response_format: "url", image_list: [] }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: config.googleApiKey, prompt, mode: 'generator', size: imageSize }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsGenerating(false); }
  };

  const frontUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F5F2ED]/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-lg flex items-center justify-center"><Palette className="text-white w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-tight">{env.siteTitle}</h1>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">{env.siteSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-1 bg-stone-100 p-1 rounded-full">
              <button onClick={() => { setActiveTab('consultant'); setResult(null); setThinkingPhase(false); }}
                className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", activeTab === 'consultant' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700")}>展陈顾问</button>
              <button onClick={() => { setActiveTab('generator'); setResult(null); setThinkingPhase(false); }}
                className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", activeTab === 'generator' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700")}>灵感生成</button>
            </nav>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-stone-100 rounded-full text-stone-500"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-stone-900 rounded-full" />
                <h2 className="text-lg font-serif font-bold">{activeTab === 'consultant' ? '上传设计素材' : '描述您的灵感'}</h2>
              </div>

              {activeTab === 'consultant' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">图片 1：展位空间结构图</label>
                    <ImageUpload label="展位结构" image={spaceImage} onUpload={setSpaceImage} icon={Maximize2} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">图片 2：陈设小品素材库</label>
                    <ImageUpload label="素材库" image={libraryImage} onUpload={setLibraryImage} icon={ImageIcon} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">设计指令 Prompt</label>
                    <textarea value={consultantPrompt} onChange={(e) => setConsultantPrompt(e.target.value)}
                      className="w-full h-40 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 transition-all resize-none text-sm leading-relaxed" />
                  </div>

                  {/* 阶段1: 开始分析 */}
                  {!thinkingPhase && !result && (
                    <button onClick={handleStartThinking} disabled={!spaceImage || !libraryImage || isGenerating}
                      className={cn("w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                        spaceImage && libraryImage && !isGenerating ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed")}>
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                      AI 深度分析 + 优化设计指令
                    </button>
                  )}

                  {/* 阶段2: 思考中 */}
                  {thinkingPhase && !result && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
                        <p className="text-sm text-amber-700">正在深度分析图片，优化设计指令...</p>
                      </div>
                      <button disabled className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-stone-200 text-stone-400 cursor-not-allowed">
                        <Loader2 className="w-5 h-5 animate-spin" /> 分析中，请稍候
                      </button>
                    </div>
                  )}

                  {/* 阶段3: 显示优化结果 + 确认生成 */}
                  {thinkingPhase && optimizedPrompt && !result && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      {optimizedExplanation && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">AI 设计解读</p>
                          <p className="text-sm text-emerald-700 leading-relaxed">{optimizedExplanation}</p>
                        </div>
                      )}
                      <div className="p-4 rounded-2xl bg-white border border-stone-200">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">优化后的设计指令</p>
                        <textarea value={optimizedPrompt} onChange={(e) => setOptimizedPrompt(e.target.value)}
                          className="w-full h-32 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs leading-relaxed resize-none" />
                      </div>
                      <button onClick={handleConfirmGenerate} disabled={isFinalGenerating}
                        className={cn("w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                          !isFinalGenerating ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                          : "bg-emerald-300 text-white cursor-not-allowed")}>
                        {isFinalGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isFinalGenerating ? '正在生成效果图...' : '确认生成效果图'}
                      </button>
                      <button onClick={() => { setThinkingPhase(false); setOptimizedPrompt(''); setOptimizedExplanation(''); }}
                        className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 text-center">← 重新分析</button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">设计关键词</label>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="例如：靠窗的榻榻米，原木色调，点缀几株绿植..."
                      className="w-full h-32 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 transition-all resize-none text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">输出分辨率</label>
                    <div className="flex gap-2">
                      {([{ label: '2K', value: '2048x2048' }, { label: '4K', value: '4096x4096' }] as const).map((s) => (
                        <button key={s.value} onClick={() => setImageSize(s.value)}
                          className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                            imageSize === s.value ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400")}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleGenerateFromScratch} disabled={!prompt || isGenerating}
                    className={cn("w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                      prompt && !isGenerating ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed")}>
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}生成空间构想
                  </button>
                </div>
              )}

              {error && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />{error}</motion.div>}
            </section>

            <section className="p-6 rounded-3xl bg-white border border-stone-100 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Info className="w-4 h-4 text-stone-400" />设计原则</h3>
              <ul className="space-y-3">
                {siteConfig.designPrinciples.map((t, i) => (
                  <li key={i} className="flex gap-3 text-xs text-stone-500 leading-relaxed"><span className="text-stone-300 font-serif italic">0{i+1}</span>{t}</li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {/* 思考阶段（显示图片预览） */}
              {thinkingPhase && !result && (
                <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-6">
                  <div className="rounded-3xl overflow-hidden bg-white shadow-2xl shadow-stone-200">
                    <img src={spaceImage!} alt="Space" className="w-full h-auto" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md text-[10px] font-bold text-stone-600">图1：展位结构</div>
                  </div>
                  <div className="rounded-3xl overflow-hidden bg-white shadow-2xl shadow-stone-200">
                    <img src={libraryImage!} alt="Library" className="w-full h-auto" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md text-[10px] font-bold text-stone-600">图2：陈设素材</div>
                  </div>
                  <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-center">
                    <Brain className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-amber-700">AI 正在深度分析两张图片...</p>
                    <p className="text-xs text-amber-500 mt-1">结合您的设计指令，生成最优化的展陈方案</p>
                  </div>
                </motion.div>
              )}

              {/* 最终生成中 */}
              {(isGenerating || isFinalGenerating) && !result && !thinkingPhase && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="aspect-[16/10] rounded-3xl bg-stone-200/50 flex flex-col items-center justify-center gap-4 p-12 text-center">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-stone-400 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-stone-900 rounded-full animate-pulse" /></div>
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-stone-600">正在为您构思...</p>
                    <p className="text-sm text-stone-400 mt-2">正在生成崂山茶展陈效果图</p>
                  </div>
                </motion.div>
              )}

              {/* 有结果 */}
              {result && (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                  <div className="relative group rounded-3xl overflow-hidden bg-white shadow-2xl shadow-stone-200">
                    {isBrushMode ? (
                      <BrushCanvas imageUrl={result.imageUrl} onSaveMask={setMaskBase64}
                        onCancel={() => { setIsBrushMode(false); setMaskBase64(null); }} />
                    ) : (
                      <>
                        <img src={result.imageUrl} alt="Result" className="w-full h-auto" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={() => setIsBrushMode(true)}
                            className="px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md text-[10px] font-bold text-stone-900 flex items-center gap-2 hover:bg-white">
                            <RefreshCw className="w-3 h-3" /> 局部重绘</button>
                          <div className="px-3 py-1.5 rounded-full bg-stone-900/80 text-[10px] font-bold text-white">Final Render</div>
                        </div>
                      </>
                    )}
                  </div>

                  {maskBase64 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="p-8 rounded-3xl bg-emerald-50 border border-emerald-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600">局部重绘</h3>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="描述修改要求..."
                        className="w-full h-24 p-4 rounded-2xl bg-white border border-emerald-200 focus:border-emerald-400 transition-all resize-none text-sm" />
                      <div className="flex gap-3">
                        <button onClick={() => setMaskBase64(null)}
                          className="flex-1 py-3 rounded-xl bg-white text-stone-500 font-bold text-xs border border-emerald-200 hover:bg-emerald-100">重新涂抹</button>
                        <button onClick={handleReEdit} disabled={!editPrompt || isFinalGenerating}
                          className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700">
                          {isFinalGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {isFinalGenerating ? '生成中...' : '执行局部重绘'}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-8 rounded-3xl bg-white border border-stone-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400">设计说明</h3>
                        <div className="w-8 h-px bg-stone-200" />
                      </div>
                      <div className="text-stone-700 leading-relaxed font-serif text-lg italic">{result.explanation}</div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 空状态 */}
              {!result && !thinkingPhase && !isGenerating && !isFinalGenerating && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="aspect-[16/10] rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mb-6"><Palette className="w-10 h-10 text-stone-200" /></div>
                  <h3 className="text-xl font-serif font-bold text-stone-400">等待开启设计之旅</h3>
                  <p className="text-sm text-stone-400 mt-2 max-w-xs">上传两张参考图，AI 将深度分析并生成专业展陈效果图</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-stone-600" /> API 配置</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-5 h-5 text-stone-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-stone-500">Local:</span><span className="font-mono text-stone-700">http://localhost:{env.frontendPort}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">LAN:</span><span className="font-mono text-stone-700">{frontUrl}</span></div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Model Provider</label>
                  <div className="flex gap-3">
                    <button onClick={() => setConfig({ ...config, provider: 'hunyuan' })}
                      className={cn("flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                        config.provider === 'hunyuan' ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400")}>Tencent Hunyuan</button>
                    <button onClick={() => setConfig({ ...config, provider: 'google' })}
                      className={cn("flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                        config.provider === 'google' ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400")}>Google Gemini</button>
                  </div>
                </div>
                {config.provider === 'hunyuan' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">API URL</label>
                      <input type="text" value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretId</label>
                        <input type="text" value={config.secretId} onChange={(e) => setConfig({ ...config, secretId: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" /></div>
                      <div className="space-y-1.5"><label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretKey</label>
                        <input type="password" value={config.secretKey} onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" /></div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Model</label>
                      <input type="text" value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" />
                      <p className="text-[10px] text-stone-400 italic">Tencent Hunyuan-Image-3.0-Instruct</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Google API Key</label>
                    <input type="password" value={config.googleApiKey} onChange={(e) => setConfig({ ...config, googleApiKey: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" />
                    <p className="text-[10px] text-stone-400 italic">via /api/google - gemini-3-pro-image-preview</p>
                  </div>
                )}
                <div className="pt-4">
                  <button onClick={() => saveConfig(config)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 shadow-lg shadow-stone-200">Save Config</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 border-t border-stone-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xs text-stone-400 font-medium">{siteConfig.footer.copyright}</div>
          <div className="flex gap-8">
            {siteConfig.footer.links.map((l, i) => (
              <a key={i} href={l.href} className="text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-stone-900">{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
