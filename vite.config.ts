import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // 读取 .env 中的密钥，通过 define 注入到前端全局
  // 前端代码里用 window.__SECRET_ID__ 等访问
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // 通过字符串替换在构建时直接注入，永不缓存
      'window.__SECRET_ID__': JSON.stringify(env.VITE_SECRET_ID || env.TENCENT_SECRET_ID || ''),
      'window.__SECRET_KEY__': JSON.stringify(env.VITE_SECRET_KEY || env.TENCENT_SECRET_KEY || ''),
      'window.__GOOGLE_API_KEY__': JSON.stringify(env.VITE_GOOGLE_API_KEY || env.GEMINI_API_KEY || ''),
      'window.__BACKEND_PORT__': JSON.stringify(env.VITE_BACKEND_PORT || env.PORT || '3001'),
      'window.__FRONTEND_PORT__': JSON.stringify(env.VITE_FRONTEND_PORT || env.FRONTEND_PORT || '3000'),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: `http://localhost:${env.PORT || 3001}`,
          changeOrigin: true,
        },
      },
    },
  };
});
