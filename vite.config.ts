import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:3000';
  const devPort = Number(env.VITE_DEV_PORT || 5173);

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: devPort,
      cors: true,
      proxy: {
        '/node/': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      cors: true,
    },
  };
});
