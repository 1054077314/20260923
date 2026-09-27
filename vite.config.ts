import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // 数据文件（58 快照 / 路线缓存 / 地理缓存）由后端持续写入，绝不能触发整页 reload
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : { ignored: ['**/data-*.json', '**/server/**', '**/.baseline/**'] },
    },
  };
});
