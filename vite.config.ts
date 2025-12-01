import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // This defines process.env.API_KEY so it can be used in the client-side code
    // You must set API_KEY in your Vercel Environment Variables
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});