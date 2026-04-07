/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  Info,
  Maximize2,
  RefreshCw,
  Palette,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { siteConfig } from './site-config';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface DesignResult {
  imageUrl: string;
  explanation: string;
}

// --- 从后端加载的站点配置（含 .env 密钥） ---
interface SiteCfg {
  title: string;
  subtitle: string;
  defaultConsultantPrompt: string;
  designPrinciples: string[];
  loadingText: string;
  loadingSubText: string;
  emptyTitle: string;
  emptyDesc: string;
  footer: {
    copyright: string;
    links: { label: string; href: string }[];
  };
}

interface InitConfig {
  site: SiteCfg;
  defaults: {
    provider: 'hunyuan' | 'google';
    hunyuanBaseUrl: string;
    hunyuanModel: string;
    googleBaseUrl: string;
    googleModelConsultant: string;
    googleModelReedit: string;
    googleModelGenerator: string;
  };
  secrets: {
    secretId: string;
    secretKey: string;
    googleApiKey: string;
  };
  ports: {
    backend: string;
    frontend: string;
  };
}

// --- 图片上传组件 ---
const ImageUpload = ({ 
  label, 
  image, 
  onUpload, 
  icon: Icon 
}: { 
  label: string; 
  image: string | null; 
  onUpload: (base64: string) => void;
  icon: any;
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative aspect-video rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden group",
        isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200 hover:border-stone-400 bg-stone-50/50",
        image && "border-none"
      )}
    >
      <input {...getInputProps()} />
      {image ? (
        <>
          <img src={image} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-white text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> 重新上传
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-stone-500" />
          </div>
          <p className="text-sm font-medium text-stone-700">{label}</p>
          <p className="text-xs text-stone-400 mt-1">点击或拖拽图片至此</p>
        </div>
      )}
    </div>
  );
};

// --- 涂抹画布组件 ---
const BrushCanvas = ({ 
  imageUrl, 
  onSaveMask,
  onCancel
}: { 
  imageUrl: string; 
  onSaveMask: (maskBase64: string) => void;
  onCancel: () => void;
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.globalCompositeOperation = 'source-over';
    tempCtx.drawImage(canvas, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0 || imageData.data[i+1] > 0 || imageData.data[i+2] > 0) {
        imageData.data[i] = 255; imageData.data[i+1] = 255; imageData.data[i+2] = 255; imageData.data[i+3] = 255;
      } else {
        imageData.data[i] = 0; imageData.data[i+1] = 0; imageData.data[i+2] = 0; imageData.data[i+3] = 255;
      }
    }
    tempCtx.putImageData(imageData, 0, 0);
    onSaveMask(tempCanvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="relative w-full h-full group">
      <img 
        src={imageUrl} 
        alt="To Edit" 
        className="w-full h-auto block rounded-3xl"
        onLoad={(e) => {
          if (canvasRef.current) {
            canvasRef.current.width = e.currentTarget.width;
            canvasRef.current.height = e.currentTarget.height;
          }
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="absolute top-4 left-4 flex gap-2">
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg flex items-center gap-3 border border-stone-200">
          <div className="flex items-center gap-2 px-2 border-r border-stone-200">
            <span className="text-[10px] font-bold uppercase text-stone-400">笔刷大小</span>
            <input 
              type="range" min="10" max="100" value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24 accent-stone-900"
            />
          </div>
          <button onClick={clearCanvas} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-600" title="清除画板">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-white/90 backdrop-blur-md text-stone-600 rounded-xl text-xs font-bold shadow-lg hover:bg-white transition-all">
          取消
        </button>
        <button onClick={handleSave} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-stone-800 transition-all flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> 确认涂抹区域
        </button>
      </div>
    </div>
  );
};

// --- 主应用 ---
export default function App() {
  // 站点配置（从后端 /api/init-config 加载，含 .env 密钥）
  const [initConfig, setInitConfig] = useState<InitConfig | null>(null);
  const [initDone, setInitDone] = useState(false);

  // 读取后端配置
  useEffect(() => {
    fetch('/api/init-config')
      .then(r => r.json())
      .then((cfg: InitConfig) => {
        setInitConfig(cfg);
        // 用 .env 密钥 + 后端默认配置初始化表单
        setConfig({
          provider: cfg.defaults.provider,
          baseUrl: cfg.defaults.hunyuanBaseUrl,
          secretId: cfg.secrets.secretId,
          secretKey: cfg.secrets.secretKey,
          model: cfg.defaults.hunyuanModel,
          googleApiKey: cfg.secrets.googleApiKey,
          backendPort: cfg.ports.backend,
          frontendPort: cfg.ports.frontend,
        });
        setInitDone(true);
      })
      .catch(() => {
        // 后端未启动，仍可展示页面（密钥需手动填写）
        setInitDone(true);
      });
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({
    provider: 'hunyuan' as 'hunyuan' | 'google',
    baseUrl: 'http://localhost:3001/api/hunyuan',
    secretId: '',
    secretKey: '',
    model: 'hunyuan-image-3.0-instruct',
    googleApiKey: '',
    backendPort: '3001',
    frontendPort: '3000',
  });

  const saveConfig = (newConfig: typeof config) => {
    setConfig(newConfig);
    setShowSettings(false);
  };

  const [spaceImage, setSpaceImage] = useState<string | null>(null);
  const [libraryImage, setLibraryImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'consultant' | 'generator'>('consultant');
  const [consultantPrompt, setConsultantPrompt] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageSize, setImageSize] = useState<string>('2048x2048');
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  // 初始化默认 prompt（等 initConfig 加载后）
  useEffect(() => {
    if (initConfig?.site.defaultConsultantPrompt) {
      setConsultantPrompt(initConfig.site.defaultConsultantPrompt);
    }
  }, [initConfig]);

  const ensureValidSize = (_size: string) => "1024:1024";

  // --- 展陈顾问 ---
  const handleGenerateDesign = async () => {
    if (!spaceImage || !libraryImage) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setIsBrushMode(false);
    setMaskBase64(null);

    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 SecretId 和 SecretKey"); }
        const url = config.baseUrl || 'http://localhost:3001/api/hunyuan';
        const body: any = {
          secretId: config.secretId,
          secretKey: config.secretKey,
          model: config.model,
          prompt: consultantPrompt,
          size: ensureValidSize(imageSize),
          response_format: "url",
          image_list: [spaceImage, libraryImage]
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        const explanation = data.data?.[0]?.revised_prompt || "生成成功。";
        if (!imageUrl) throw new Error("API 未返回有效的图像数据。");
        setResult({ imageUrl, explanation });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 Google API Key"); }
        const response = await fetch('http://localhost:3001/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: config.googleApiKey,
            prompt: consultantPrompt,
            mode: 'consultant',
            image_list: [spaceImage, libraryImage],
            size: imageSize
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        const explanation = data.data?.[0]?.revised_prompt || "生成成功。";
        if (!imageUrl) throw new Error("API 未返回有效的图像数据。");
        setResult({ imageUrl, explanation });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成过程中发生错误");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- 局部重绘 ---
  const handleReEdit = async () => {
    if (!result || !maskBase64 || !editPrompt) return;
    setIsGenerating(true);
    setError(null);

    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 SecretId 和 SecretKey"); }
        const url = config.baseUrl || 'http://localhost:3001/api/hunyuan';
        const body: any = {
          secretId: config.secretId,
          secretKey: config.secretKey,
          model: config.model,
          prompt: editPrompt,
          size: ensureValidSize(imageSize),
          image_list: [result.imageUrl, maskBase64]
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) throw new Error("API 未返回有效的重绘图像数据。");
        setResult({ ...result, imageUrl });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 Google API Key"); }
        const response = await fetch('http://localhost:3001/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: config.googleApiKey,
            prompt: editPrompt,
            mode: 'reedit',
            image_list: [result.imageUrl],
            maskImage: maskBase64,
            size: imageSize
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) throw new Error("API 未返回有效的重绘图像数据。");
        setResult({ ...result, imageUrl });
      }
      setIsBrushMode(false);
      setMaskBase64(null);
      setEditPrompt('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "修改过程中发生错误");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- 灵感生成 ---
  const handleGenerateFromScratch = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);

    try {
      if (config.provider === 'hunyuan') {
        if (!config.secretId || !config.secretKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 SecretId 和 SecretKey"); }
        const url = config.baseUrl || 'http://localhost:3001/api/hunyuan';
        const body = {
          secretId: config.secretId,
          secretKey: config.secretKey,
          model: config.model,
          prompt: `设计一个位于大型展馆内的崂山茶文化展位：${prompt}。风格要求：自然、质朴、山海气息、专业展陈效果图、灯光层次丰富。`,
          size: ensureValidSize(imageSize),
          response_format: "url",
          image_list: []
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (!imageUrl) throw new Error("API 未返回有效的图像数据。");
        setResult({ imageUrl, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      } else {
        if (!config.googleApiKey) { setShowSettings(true); throw new Error("请先点击右上角齿轮设置 Google API Key"); }
        const response = await fetch('http://localhost:3001/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: config.googleApiKey,
            prompt,
            mode: 'generator',
            size: imageSize
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || err.message || `API 请求失败 (${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) throw new Error("API 未返回有效的图像数据。");
        setResult({ imageUrl, explanation: `基于您的灵感："${prompt}" 生成的崂山茶空间构想。` });
      }
    } catch (err: any) {
      setError(err.message || "生成过程中发生错误");
    } finally {
      setIsGenerating(false);
    }
  };

  const cfg = initConfig?.site;
  const ports = initConfig?.ports;
  const backUrl = `http://localhost:${ports?.backend || '3001'}`;
  const frontUrl = `http://localhost:${ports?.frontend || '3000'}`;

  const s = siteConfig; // 本地备用配置（后端未启动时使用）

  // 等待初始化（最多展示加载态）
  if (!initDone) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
          <p className="text-sm text-stone-500">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F5F2ED]/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-lg flex items-center justify-center">
              <Palette className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-tight">{cfg?.title ?? s.siteTitle}</h1>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">{cfg?.subtitle ?? s.siteSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-1 bg-stone-100 p-1 rounded-full">
              <button 
                onClick={() => { setActiveTab('consultant'); setResult(null); }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === 'consultant' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
                )}
              >
                展陈顾问
              </button>
              <button 
                onClick={() => { setActiveTab('generator'); setResult(null); }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === 'generator' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
                )}
              >
                灵感生成
              </button>
            </nav>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500" title="设置 API">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-stone-900 rounded-full" />
                <h2 className="text-lg font-serif font-bold">
                  {activeTab === 'consultant' ? '上传设计素材' : '描述您的灵感'}
                </h2>
              </div>

              {activeTab === 'consultant' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">图片 1：展位空间结构图 (SketchUp)</label>
                    <ImageUpload label="展位结构" image={spaceImage} onUpload={setSpaceImage} icon={Maximize2} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">图片 2：陈设小品素材库</label>
                    <ImageUpload label="素材库" image={libraryImage} onUpload={setLibraryImage} icon={ImageIcon} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">设计指令 (Prompt)</label>
                    <textarea
                      value={consultantPrompt}
                      onChange={(e) => setConsultantPrompt(e.target.value)}
                      placeholder="请输入设计指令..."
                      className="w-full h-40 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 focus:ring-0 transition-all resize-none text-sm leading-relaxed"
                    />
                  </div>
                  <button
                    onClick={handleGenerateDesign}
                    disabled={!spaceImage || !libraryImage || isGenerating}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                      spaceImage && libraryImage && !isGenerating
                        ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    )}
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    开始展陈设计
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">设计关键词</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="例如：靠窗的榻榻米，原木色调，点缀几株绿植..."
                      className="w-full h-32 p-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-400 focus:ring-0 transition-all resize-none text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-500">输出分辨率</label>
                    <div className="flex gap-2">
                      {([
                        { label: '2K (标准)', value: '2048x2048' },
                        { label: '4K (极清)', value: '4096x4096' }
                      ] as const).map((item) => (
                        <button
                          key={item.value}
                          onClick={() => setImageSize(item.value)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                            imageSize === item.value 
                              ? "bg-stone-900 text-white border-stone-900" 
                              : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateFromScratch}
                    disabled={!prompt || isGenerating}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                      prompt && !isGenerating
                        ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    )}
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    生成空间构想
                  </button>
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-center gap-2"
                >
                  <Info className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}
            </section>

            <section className="p-6 rounded-3xl bg-white border border-stone-100 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-stone-400" />
                设计原则
              </h3>
              <ul className="space-y-3">
                {(cfg?.designPrinciples ?? s.designPrinciples).map((text, i) => (
                  <li key={i} className="flex gap-3 text-xs text-stone-500 leading-relaxed">
                    <span className="text-stone-300 font-serif italic">0{i+1}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="aspect-[16/10] rounded-3xl bg-stone-200/50 flex flex-col items-center justify-center gap-4 p-12 text-center"
                >
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-stone-400 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-stone-900 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-stone-600">{cfg?.loadingText ?? s.loadingText}</p>
                    <p className="text-sm text-stone-400 mt-2">{cfg?.loadingSubText ?? s.loadingSubText}</p>
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8"
                >
                  <div className="relative group rounded-3xl overflow-hidden bg-white shadow-2xl shadow-stone-200">
                    {isBrushMode ? (
                      <BrushCanvas 
                        imageUrl={result.imageUrl} 
                        onSaveMask={(mask) => setMaskBase64(mask)}
                        onCancel={() => { setIsBrushMode(false); setMaskBase64(null); }}
                      />
                    ) : (
                      <>
                        <img src={result.imageUrl} alt="Design Result" className="w-full h-auto" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button 
                            onClick={() => setIsBrushMode(true)}
                            className="px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-stone-900 shadow-sm hover:bg-white transition-all flex items-center gap-2"
                          >
                            <RefreshCw className="w-3 h-3" /> 局部重绘
                          </button>
                          <div className="px-3 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
                            Final Render
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {maskBase64 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 rounded-3xl bg-emerald-50 border border-emerald-100 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600">重绘指令 / Re-edit Prompt</h3>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="space-y-4">
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="描述您想在涂抹区域进行的修改..."
                          className="w-full h-24 p-4 rounded-2xl bg-white border border-emerald-200 focus:border-emerald-400 focus:ring-0 transition-all resize-none text-sm"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => setMaskBase64(null)}
                            className="flex-1 py-3 rounded-xl bg-white text-stone-500 font-bold text-xs border border-emerald-200 hover:bg-emerald-100 transition-all"
                          >
                            重新涂抹
                          </button>
                          <button
                            onClick={handleReEdit}
                            disabled={!editPrompt || isGenerating}
                            className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                          >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            执行局部重绘
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-8 rounded-3xl bg-white border border-stone-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400">设计说明 / Explanation</h3>
                        <div className="w-8 h-px bg-stone-200" />
                      </div>
                      <div className="text-stone-700 leading-relaxed font-serif text-lg italic">
                        {result.explanation}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="aspect-[16/10] rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mb-6">
                    <Palette className="w-10 h-10 text-stone-200" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-stone-400">{cfg?.emptyTitle ?? s.emptyTitle}</h3>
                  <p className="text-sm text-stone-400 mt-2 max-w-xs">{cfg?.emptyDesc ?? s.emptyDesc}</p>
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
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-stone-600" /> API 配置
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* IP 地址信息 */}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">后端地址：</span>
                    <span className="font-mono text-stone-700">{backUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">前端地址：</span>
                    <span className="font-mono text-stone-700">{frontUrl}</span>
                  </div>
                </div>

                {/* 模型选择 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">模型提供商</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, provider: 'hunyuan' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                        config.provider === 'hunyuan'
                          ? "bg-stone-900 text-white border-stone-900 shadow-lg"
                          : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                      )}
                    >腾讯混元 Hunyuan</button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, provider: 'google' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                        config.provider === 'google'
                          ? "bg-stone-900 text-white border-stone-900 shadow-lg"
                          : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                      )}
                    >Google Gemini</button>
                  </div>
                </div>

                {config.provider === 'hunyuan' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">接口地址</label>
                      <input 
                        type="text" 
                        value={config.baseUrl} 
                        onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm transition-all font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretId</label>
                        <input 
                          type="text" 
                          value={config.secretId} 
                          onChange={(e) => setConfig({...config, secretId: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">SecretKey</label>
                        <input 
                          type="password" 
                          value={config.secretKey} 
                          onChange={(e) => setConfig({...config, secretKey: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm transition-all font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">模型名称</label>
                      <input 
                        type="text" 
                        value={config.model} 
                        onChange={(e) => setConfig({...config, model: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm transition-all font-mono"
                      />
                      <p className="text-[10px] text-stone-400 italic">腾讯混元 Hunyuan-Image-3.0-Instruct</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Google API Key</label>
                    <input 
                      type="password" 
                      value={config.googleApiKey} 
                      onChange={(e) => setConfig({...config, googleApiKey: e.target.value})}
                      placeholder="AIza..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-400 outline-none text-sm transition-all font-mono"
                    />
                    <p className="text-[10px] text-stone-400 italic">通过 {backUrl}/api/google 代理，支持 gemini-3-pro-image-preview</p>
                  </div>
                )}

                <div className="pt-4">
                  <button 
                    onClick={() => saveConfig(config)}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2"
                  >
                    保存配置
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 border-t border-stone-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xs text-stone-400 font-medium">
            {cfg?.footer?.copyright ?? s.footer.copyright}
          </div>
          <div className="flex gap-8">
            {(cfg?.footer?.links ?? s.footer.links).map((link, i) => (
              <a key={i} href={link.href} className="text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-stone-900 transition-colors">{link.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
