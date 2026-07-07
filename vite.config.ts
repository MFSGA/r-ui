import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:3000';
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
  const base = mode === 'production' && repositoryName ? `/${repositoryName}/` : '/';

  return {
    base,
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-rjsf-core',
                test: /[\\/]node_modules[\\/]@rjsf[\\/](core|utils)[\\/]/,
              },
              {
                name: 'vendor-rjsf-mui',
                test: /[\\/]node_modules[\\/]@rjsf[\\/](mui|validator-ajv8)[\\/]/,
              },
              { name: 'vendor-mui', test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/ },
              { name: 'vendor-formats', test: /[\\/]node_modules[\\/](yaml|json5|smol-toml)[\\/]/ },
            ],
          },
        },
      },
    },
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
