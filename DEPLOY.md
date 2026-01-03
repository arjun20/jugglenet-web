# Deployment Guide for JuggleNet Web App

## Quick Start - Deploy to Free Platform

### Option 1: GitHub Pages (Easiest & Free)

1. **Create GitHub Repository**
   ```bash
   cd web-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/jugglenet-web.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under **Source**, select **main** branch and **/ (root)** folder
   - Click **Save**
   - Your app will be live at: `https://YOUR_USERNAME.github.io/jugglenet-web/`

### Option 2: Vercel (Recommended for Free Tier)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd web-app
   vercel
   ```
   - Follow the prompts
   - Your app will be deployed instantly!

3. **Custom Domain (Optional)**
   - Add your domain in Vercel dashboard
   - Free SSL included!

### Option 3: Netlify (Drag & Drop)

1. **Build the site** (if needed)
   - No build needed for static files!

2. **Deploy**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `web-app` folder
   - Done! Your site is live.

3. **Continuous Deployment**
   - Connect GitHub repository
   - Auto-deploy on every push!

### Option 4: Cloudflare Pages (Free & Fast)

1. **Create Account**
   - Go to [pages.cloudflare.com](https://pages.cloudflare.com)

2. **Connect Repository**
   - Click "Create a project"
   - Connect your GitHub account
   - Select repository

3. **Configure**
   - Build command: (leave empty)
   - Build output directory: `web-app` (or root if files are there)
   - Click "Save and Deploy"

## Before Deploying - Convert YOLO Model

### Step 1: Convert Model to TensorFlow.js

```bash
# Navigate to project root
cd /Users/arjun/Downloads/JuggleNet-main

# Convert model
python3 -c "from ultralytics import YOLO; model = YOLO('models/finetuned.pt'); model.export(format='tfjs', imgsz=640)"
```

### Step 2: Move Model Files

```bash
# Create directory
mkdir -p web-app/models/finetuned_web

# Move exported files
mv models/finetuned_web/* web-app/models/finetuned_web/
```

### Step 3: Update app.js

The `loadYOLOModel()` function should automatically load the model. Make sure the path is correct:

```javascript
const modelUrl = './models/finetuned_web/model.json';
```

## Create App Icons

### Generate Icons

You can use any of these tools:
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

Required sizes:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

Place them in the `web-app` folder.

## Testing Locally

### Simple HTTP Server (No HTTPS)

```bash
cd web-app
python3 -m http.server 8000
```

**Note**: Camera won't work without HTTPS!

### With HTTPS (Required for Camera)

#### Using ngrok:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Start local server
python3 -m http.server 8000

# In another terminal, create HTTPS tunnel
ngrok http 8000
```

Access via the ngrok HTTPS URL shown.

#### Using serve (with HTTPS):

```bash
npx serve -s . -l 3000
# Then use ngrok for HTTPS
```

## iOS Installation Instructions

1. **Open in Safari**
   - Go to your deployed URL on iPhone/iPad
   - Make sure you're using Safari (not Chrome)

2. **Add to Home Screen**
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Customize name if desired
   - Tap "Add"

3. **Launch as App**
   - Tap the icon on your home screen
   - It will open fullscreen like a native app!

## Troubleshooting

### Camera Not Working

- **Requires HTTPS**: All hosting platforms above provide this automatically
- **Permissions**: Allow camera access when prompted
- **iOS Safari**: Make sure you're using Safari, not Chrome

### Model Not Loading

- Check browser console for errors
- Verify model files are uploaded correctly
- Check file paths in `app.js`

### Performance Issues

- Reduce video resolution in `app.js`:
  ```javascript
  width: 320,  // Lower resolution
  height: 240
  ```
- Use simpler MediaPipe model:
  ```javascript
  modelComplexity: 0  // Instead of 1
  ```

## Cost Comparison

| Platform | Free Tier | Limitations |
|----------|-----------|-------------|
| GitHub Pages | ✅ Free | 1GB storage, 100GB bandwidth/month |
| Vercel | ✅ Free | 100GB bandwidth/month |
| Netlify | ✅ Free | 100GB bandwidth/month |
| Cloudflare Pages | ✅ Free | Unlimited bandwidth! |

**All platforms provide free SSL/HTTPS certificates!**

## Next Steps

1. ✅ Convert YOLO model to TensorFlow.js
2. ✅ Create app icons
3. ✅ Choose hosting platform
4. ✅ Deploy
5. ✅ Test on iOS device
6. ✅ Share with users!

Enjoy your free, iOS-compatible JuggleNet web app! 🎉

