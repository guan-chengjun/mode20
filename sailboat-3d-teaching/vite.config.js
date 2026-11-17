import { defineConfig } from 'vite';

// Vite 配置：使用相对路径 base，便于部署到任意静态子目录
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    sourcemap: true
  }
});
