import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function socialShareImagePlugin() {
  const placeholder = '__OG_IMAGE_URL__'
  return {
    name: 'social-share-image',
    transformIndexHtml(html) {
      const base = (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
      const url = base
        ? `${base}/socail_share_image.png`
        : '/socail_share_image.png'
      return html.split(placeholder).join(url)
    }
  }
}

export default defineConfig({
  plugins: [react(), socialShareImagePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 3005,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true }
    }
  }
})
