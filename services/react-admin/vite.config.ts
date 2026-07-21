import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { z } from 'zod'
import path from 'path'

const EnvSchema = z.object({
  VITE_HOST: z.string().default('0.0.0.0'),
  VITE_PORT: z.coerce.number().default(5173),
  VITE_DJANGO_URL: z.string().url().default('http://localhost:8000'),
  VITE_FASTIFY_URL: z.string().url().default('http://localhost:3000'),
})

export default defineConfig(({ mode }) => {
  const rawEnv = loadEnv(mode, process.cwd(), '')
  const _env = EnvSchema.safeParse(rawEnv)
  
  if (!_env.success) {
    console.error("Invalid environment variables:\n", z.treeifyError(_env.error))
    throw new Error("Invalid Vite Environment Configuration")
  }
  
  const env = _env.data

  const proxy: Record<string, any> = {};
  
  ['/api/audits', '/api/anomalies'].forEach(route => {
    proxy[route] = { target: env.VITE_DJANGO_URL, changeOrigin: true }
  });
  
  ['/api/bookings', '/api/invoices'].forEach(route => {
    proxy[route] = { target: env.VITE_FASTIFY_URL, changeOrigin: true }
  });

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: env.VITE_HOST,
      port: env.VITE_PORT,
      proxy
    }
  }
})
