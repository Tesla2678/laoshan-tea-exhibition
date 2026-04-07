/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, Image as ImageIcon, Sparkles, Loader2, Info,
  RefreshCw, Palette, Settings, X, Brain, Plus, Trash2, Pencil, Check, Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { siteConfig, MODEL_OPTIONS } from './site-config';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

declare global { interface Window {
  __SECRET_ID__: string; __SECRET_KEY__: string;
  __GOOGLE_API_KEY__: string; __BACKEND_PORT__: string; __FRONTEND_PORT__: string;
}}
const env = {
  siteTitle: siteConfig.siteTitle,
  siteSubtitle: siteConfig.siteSubtitle,
  frontendPort: window.__FRONTEND_PORT__ || '3000',
  secretId: window.__SECRET_ID__ || '',
  secretKey: window.__SECRET_KEY__ || '',
  googleApiKey: window.__GOOGLE_API_KEY__ || '',
};

// --- Types ---
interface DesignResult { imageUrl: string; explanation: string; }
interface RefImage { id: string; image: string; name: string; }
type Provider = 'hunyuan' | 'google';

// --- 可命名图片卡 ---
const NamedImageCard = ({ img, idx, onRename, onRemove }: { img: RefImage; idx: number; onRename: (id: string, name: string) => void; onRemove: (id: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(img.name);
  const commit = () => { onRename(img.id, name || `图片${idx + 1}`); setEditing(false); };
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-sm hover:shadow-md transition-all">
      <img src={img.image} alt={img.name} className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">#{idx + 1}</div>
      <div className="p-2 border-t border-stone-100">
        {editing ? (
          <div className="flex items-center gap-1">
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(img.name); setEditing(false); } }}
              className="flex-1 px-2 py-1 text-xs rounded bg-stone-50 border border-stone-200 outline-none font-mono" autoFocus />
            <button onClick={commit} className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"><Check className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 truncate flex-1">{img.name}</span>
            <div className="flex gap-1 ml-1">
              <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => onRemove(img.id)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 拖拽上传 ---
const DropZone = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: onFiles, accept: { 'image/*': [] }, multiple: true } as any);
  return (
    <div {...getRootProps()}
      className={cn("border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-8",
        isDragActive ? "border-emerald-400 bg-emerald-50" : "border-stone-200 hover:border-stone-400 bg-stone-50/50")}>
      <input {...getInputProps()} />
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors", isDragActive ? "bg-emerald-100" : "bg-stone-100")}>
        <Plus className={cn("w-6 h-6", isDragActive ? "text-emerald-500" : "text-stone-400")} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-stone-600">点击或拖拽上传参考图</p>
        <p className="text-xs text-stone-400 mt-1">支持多张，点击图片可命名</p>
      </div>
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

// --- 每个功能的模型选择行 ---
const ModelSelectRow = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 w-28 flex-shrink-0">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono outline-none focus:border-stone-400">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// --- 主应用 ---
export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<Provider>('hunyuan');
  const [secretId, setSecretId] = useState(env.secretId);
  const [secretKey, setSecretKey] = useState(env.secretKey);
  const [googleApiKey, setGoogleApiKey] = useState(env.googleApiKey);

  // 4 个功能的模型
  const [models, setModels] = useState({
    textToImage: MODEL_OPTIONS.hunyuan.defaultModels.textToImage,
    think: MODEL_OPTIONS.hunyuan.defaultModels.think,
    consultant: MODEL_OPTIONS.hunyuan.defaultModels.consultant,
    reedit: MODEL_OPTIONS.hunyuan.defaultModels.reedit,
  });

  const [refImages, setRefImages] = useState<RefImage[]>([]);
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

  // 思考阶段
  const [thinkingPhase, setThinkingPhase] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [optimizedExplanation, setOptimizedExplanation] = useState('');
  const [isFinalGenerating, setIsFinalGenerating] = useState(false);

  const modelOpts = MODEL_OPTIONS[provider];

  const updateModel = (func: keyof typeof models, v: string) => {
    setModels(prev => ({ ...prev, [func]: v }));
  };

  const addImages = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setRefImages(prev => [...prev, {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          image: reader.result as string,
          name: file.name.replace(/\.[^.]+$/, '')
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const renameImage = useCallback((id: string, name: string) => {
    setRefImages(prev => prev.map(img => img.id === id ? { ...img, name } : img));
  }, []);

  const removeImage = useCallback((id: string) => {
    setRefImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // Step 1: 思考
  const handleStartThinking = async () => {
    if (refImages.length < 1) return;
    setIsGenerating(true); setThinkingPhase(true);
    setError(null); setOptimizedPrompt(''); setOptimizedExplanation('');

    try {
      const res = await fetch('/api/think', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: consultantPrompt,
          image_list: refImages.map(img => img.image),
          image_names: refImages.map(img => img.name),
          provider,
          secretId, secretKey,
          apiKey: googleApiKey,
          thinkModel: models.think,
          consultantModel: models.consultant,
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
      const data = await res.json();
      setOptimizedPrompt(data.optimizedPrompt || consultantPrompt);
      setOptimizedExplanation(data.explanation || '');
    } catch (err: any) { setError(err.message); setThinkingPhase(false); }
    finally { setIsGenerating(false); }
  };

  // Step 2: 生图（consultant）
  const handleConfirmGenerate = async () => {
    if (!optimizedPrompt) return;
    setIsFinalGenerating(true); setThinkingPhase(false);
    setError(null); setResult(null); setIsBrushMode(false); setMaskBase64(null);

    try {
      if (provider === 'hunyuan') {
        if (!secretId || !secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch('/api/hunyuan/consultant', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId, secretKey, model: models.consultant, prompt: optimizedPrompt, size: "1024:1024", image_list: refImages.map(img => img.image) }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (!imageUrl) throw new Error("未返回有效图像");
        setResult({ imageUrl, explanation: optimizedExplanation || data.data?.[0]?.revised_prompt || "生成成功。" });
      } else {
        if (!googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google/consultant', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: googleApiKey, model: models.consultant, prompt: optimizedPrompt, image_list: refImages.map(img => img.image), size: imageSize }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: optimizedExplanation || data.data[0].revised_prompt || "生成成功。" });
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsFinalGenerating(false); }
  };

  // 局部重绘
  const handleReEdit = async () => {
    if (!result || !maskBase64 || !editPrompt) return;
    setIsFinalGenerating(true); setError(null);
    try {
      if (provider === 'hunyuan') {
        if (!secretId || !secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch('/api/hunyuan/reedit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId, secretKey, model: models.reedit, prompt: editPrompt, size: "1024:1024", image_list: [result.imageUrl, maskBase64] }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ ...result, imageUrl: data.data[0].url });
      } else {
        if (!googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google/reedit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: googleApiKey, model: models.reedit, prompt: editPrompt, image_list: [result.imageUrl], maskImage: maskBase64, size: imageSize }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ ...result, imageUrl: data.data[0].url });
      }
      setIsBrushMode(false); setMaskBase64(null); setEditPrompt('');
    } catch (err: any) { setError(err.message); }
    finally { setIsFinalGenerating(false); }
  };

  // 灵感生成
  const handleGenerateFromScratch = async () => {
    if (!prompt) return;
    setIsGenerating(true); setError(null);
    try {
      if (provider === 'hunyuan') {
        if (!secretId || !secretKey) { setShowSettings(true); throw new Error("请先设置 SecretId"); }
        const res = await fetch('/api/hunyuan/t2i', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretId, secretKey, model: models.textToImage, prompt: `设计一个位于大型展馆内的崂山茶文化展位：${prompt}。风格要求：自然、质朴、山海气息，专业展陈效果图，灯光层次丰富。`, size: "1024:1024" }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      } else {
        if (!googleApiKey) { setShowSettings(true); throw new Error("请先设置 Google API Key"); }
        const res = await fetch('/api/google/t2i', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: googleApiKey, model: models.textToImage, prompt, size: imageSize }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `失败 (${res.status})`); }
        const data = await res.json();
        if (!data.data?.[0]?.url) throw new Error("未返回有效图像");
        setResult({ imageUrl: data.data[0].url, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsGenerating(false); }
  };

  const saveConfig = () => setShowSettings(false);
  const frontUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F5F2ED]/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-lg flex items-center justify-center"><Palette className="text-white w-6 h-6" /></div>
            <div><h1 className="text-xl font-serif font-bold tracking-tight">{env.siteTitle}</h1>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">{env.siteSubtitle}</p></div>
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
                  {/* 参考图 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">参考图（点击命名）</label>
                      <span className="text-[10px] text-stone-400">{refImages.length} 张</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {refImages.map((img, idx) => (
                        <NamedImageCard key={img.id} img={img} idx={idx} onRename={renameImage} onRemove={removeImage} />
                      ))}
                      <DropZone onFiles={addImages} />
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">设计指令 Prompt</label>
                    <textarea value={consultantPrompt} onChange={(e) => setConsultantPrompt(e.target.value)}
                      className="w-full h-40 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 transition-all resize-none text-sm leading-relaxed" />
                  </div>

                  {/* 阶段1 */}
                  {!thinkingPhase && !result && (
                    <button onClick={handleStartThinking} disabled={refImages.length < 1 || isGenerating}
                      className={cn("w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                        refImages.length >= 1 && !isGenerating ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
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
                        <p className="text-sm text-amber-700">正在深度分析 {refImages.length} 张图片，优化设计指令...</p>
                      </div>
                      <button disabled className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-stone-200 text-stone-400 cursor-not-allowed">
                        <Loader2 className="w-5 h-5 animate-spin" /> 分析中，请稍候
                      </button>
                    </div>
                  )}

                  {/* 阶段3: 显示优化结果 */}
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
                      {([{ label: '2K', value: '2048x2048' }, { label: '4K', value: '4096x4096' }] as const).map(s => (
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
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}生成空间构想
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

          {/* Right Column */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {thinkingPhase && !result && (
                <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {refImages.map((img, idx) => (
                      <div key={img.id} className="relative rounded-2xl overflow-hidden bg-white shadow-lg">
                        <img src={img.image} alt={img.name} className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">#{idx+1}</div>
                        <div className="p-2 border-t border-stone-100"><p className="text-xs font-medium text-stone-600 truncate">{img.name}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-center">
                    <Brain className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-amber-700">AI 正在深度分析 {refImages.length} 张参考图...</p>
                    <p className="text-xs text-amber-500 mt-1">结合您的设计指令，生成最优化的展陈方案</p>
                  </div>
                </motion.div>
              )}

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
                        placeholder="描述修改要求..." className="w-full h-24 p-4 rounded-2xl bg-white border border-emerald-200 focus:border-emerald-400 transition-all resize-none text-sm" />
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

              {!result && !thinkingPhase && !isGenerating && !isFinalGenerating && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="aspect-[16/10] rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mb-6"><Palette className="w-10 h-10 text-stone-200" /></div>
                  <h3 className="text-xl font-serif font-bold text-stone-400">{siteConfig.emptyTitle}</h3>
                  <p className="text-sm text-stone-400 mt-2 max-w-xs">{siteConfig.emptyDesc}</p>
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
              onClick={() => saveConfig()} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-stone-600" /> API 配置</h2>
                <button onClick={() => saveConfig()} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-5 h-5 text-stone-400" /></button>
              </div>

              <div className="p-6 space-y-6">
                {/* URL 信息 */}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-stone-500">Local:</span><span className="font-mono text-stone-700">http://localhost:{env.frontendPort}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">LAN:</span><span className="font-mono text-stone-700">{frontUrl}</span></div>
                </div>

                {/* 模型提供商切换 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">模型提供商</label>
                  <div className="flex gap-3">
                    {(['hunyuan', 'google'] as Provider[]).map(p => (
                      <button key={p} onClick={() => {
                        setProvider(p);
                        setModels({
                          textToImage: MODEL_OPTIONS[p].defaultModels.textToImage,
                          think: MODEL_OPTIONS[p].defaultModels.think,
                          consultant: MODEL_OPTIONS[p].defaultModels.consultant,
                          reedit: MODEL_OPTIONS[p].defaultModels.reedit,
                        });
                      }}
                        className={cn("flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                          provider === p ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400")}>
                        {MODEL_OPTIONS[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 密钥 */}
                {provider === 'hunyuan' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretId</label>
                      <input type="text" value={secretId} onChange={(e) => setSecretId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretKey</label>
                      <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" /></div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Google API Key</label>
                    <input type="password" value={googleApiKey} onChange={(e) => setGoogleApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm font-mono" />
                  </div>
                )}

                {/* 4 个功能各自选模型 */}
                <div className="border-t border-stone-100 pt-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">各功能模型配置</p>

                  <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                    {/* 文生图 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-stone-400" />
                        <span className="text-xs font-bold text-stone-700">文生图</span>
                        <span className="text-[10px] text-stone-400 ml-auto">{provider === 'google' ? 'Google Gemini' : 'Tencent Hunyuan'}</span>
                      </div>
                      <ModelSelectRow
                        label=""
                        value={models.textToImage}
                        options={modelOpts.models.textToImage}
                        onChange={(v) => updateModel('textToImage', v)}
                      />
                    </div>

                    {/* 多图理解 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-stone-400" />
                        <span className="text-xs font-bold text-stone-700">多图理解 + Prompt 优化</span>
                        <span className="text-[10px] text-stone-400 ml-auto">{provider === 'google' ? 'Google Gemini' : 'Tencent Hunyuan'}</span>
                      </div>
                      <ModelSelectRow
                        label=""
                        value={models.think}
                        options={modelOpts.models.think}
                        onChange={(v) => updateModel('think', v)}
                      />
                    </div>

                    {/* 多图参考生图 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-stone-400" />
                        <span className="text-xs font-bold text-stone-700">多图参考生图（展陈顾问）</span>
                        <span className="text-[10px] text-stone-400 ml-auto">{provider === 'google' ? 'Google Gemini' : 'Tencent Hunyuan'}</span>
                      </div>
                      <ModelSelectRow
                        label=""
                        value={models.consultant}
                        options={modelOpts.models.consultant}
                        onChange={(v) => updateModel('consultant', v)}
                      />
                    </div>

                    {/* Mask 编辑 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-stone-400" />
                        <span className="text-xs font-bold text-stone-700">Mask 局部编辑</span>
                        <span className="text-[10px] text-stone-400 ml-auto">{provider === 'google' ? 'Google Gemini' : 'Tencent Hunyuan'}</span>
                      </div>
                      <ModelSelectRow
                        label=""
                        value={models.reedit}
                        options={modelOpts.models.reedit}
                        onChange={(v) => updateModel('reedit', v)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button onClick={saveConfig}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 shadow-lg shadow-stone-200">保存配置</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
