# Vercel Deployment Guide

This guide explains how to deploy the OpenBroker frontend to Vercel.

## Prerequisites

- A Vercel account (sign up at [vercel.com](https://vercel.com))
- Your frontend code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy from Root Directory (Current Structure)

If your frontend files are in the root of your repository:

1. **Connect your repository to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your Git repository

2. **Configure build settings:**
   - Vercel should auto-detect Vite from `vercel.json`
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set environment variables (optional):**
   - Go to Project Settings → Environment Variables
   - Add `VITE_API_URL` if you need to override the default API URL
   - Add `VITE_WS_URL` if you need to override the default WebSocket URL
   - Default values:
     - `VITE_API_URL`: `https://openbroker.boutiquesoftware.com`
     - `VITE_WS_URL`: `wss://openbroker.boutiquesoftware.com/ws`

4. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy your application

### Option 2: Deploy from OpenBroker/frontend Directory

If your frontend is in the `OpenBroker/frontend` subdirectory:

1. **Connect your repository to Vercel**

2. **Configure build settings:**
   - Root Directory: `OpenBroker/frontend`
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Create `vercel.json` in the OpenBroker/frontend directory:**
   ```json
   {
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

4. **Set environment variables** (same as Option 1)

5. **Deploy**

## Environment Variables

The following environment variables can be configured in Vercel:

- `VITE_API_URL`: API base URL (default: `https://openbroker.boutiquesoftware.com`)
- `VITE_WS_URL`: WebSocket URL (default: `wss://openbroker.boutiquesoftware.com/ws`)

To set these:
1. Go to your project in Vercel
2. Navigate to Settings → Environment Variables
3. Add each variable for Production, Preview, and Development environments

## Important Notes

- **SPA Routing**: The `vercel.json` includes rewrites to handle client-side routing. All routes will serve `index.html` to support React Router.

- **CORS**: Make sure your backend API server allows requests from your Vercel domain. You may need to configure CORS headers on the backend.

- **Cookies**: The app uses `withCredentials: true` for API requests, so ensure your backend allows credentials from your Vercel domain.

- **WebSocket**: WebSocket connections are made directly to the backend server. Ensure the WebSocket endpoint is accessible from the browser.

## Troubleshooting

### Build Fails
- Check that all dependencies are listed in `package.json`
- Ensure Node.js version is compatible (Vercel uses Node 18.x by default)

### API Requests Fail
- Verify `VITE_API_URL` is set correctly
- Check CORS settings on the backend
- Ensure cookies are being sent (check browser DevTools → Network tab)

### Routing Doesn't Work
- Verify `vercel.json` includes the rewrites configuration
- Check that the output directory is set to `dist`

### WebSocket Connection Fails
- Verify `VITE_WS_URL` is set correctly
- Check that the WebSocket endpoint is accessible
- Ensure the backend WebSocket server supports CORS

## Custom Domain

To use a custom domain:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions

