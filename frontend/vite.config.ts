import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://openbroker.boutiquesoftware.com',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        cookiePathRewrite: {
          '*': '/'
        },
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying request:', req.method, req.url);
            // Forward cookies from the request
            if (req.headers.cookie) {
              console.log('Forwarding cookies:', req.headers.cookie);
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Proxy response:', proxyRes.statusCode, req.url);
            // Log Set-Cookie headers
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('Cookies being set by server:', Array.isArray(setCookie) ? setCookie : [setCookie]);
            } else {
              console.warn('No Set-Cookie header in response');
            }
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

