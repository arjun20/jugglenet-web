# JuggleNet Web App

A web-based version of JuggleNet that runs entirely in the browser, perfect for iOS devices.

## Features

- ✅ **Works on iOS Safari** - Full support for mobile web
- ✅ **Progressive Web App (PWA)** - Can be installed on home screen
- ✅ **No server required** - All processing happens in the browser
- ✅ **MediaPipe Pose** - Real-time body pose detection
- ✅ **Kalman Filter** - Smooth tracking and prediction
- ✅ **Juggle Counting** - Automatic detection and counting

## Setup Instructions

### ⚡ Quick Start (No Model Conversion Needed!)

The app works **without** converting the YOLO model! It uses pose-based ball estimation instead.

**Just deploy and go!** See `SIMPLE_DEPLOY.md` for the fastest deployment.

### Optional: Convert YOLO Model (For Better Accuracy)

If you want to use the custom YOLO model later:

1. **Convert Model to TensorFlow.js**

```bash
# Install ultralytics
pip install ultralytics

# Convert model
python -c "from ultralytics import YOLO; model = YOLO('models/finetuned.pt'); model.export(format='tfjs')"
```

2. **Move exported model to web-app/models/finetuned_web/**

3. **Update app.js** - The code already includes model loading, just uncomment it

### Create App Icons (Optional)

Create icon files:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

You can use any image editing tool or online icon generator.

## Deployment Options

### Option 1: GitHub Pages (Free)

1. Create a GitHub repository
2. Push the `web-app` folder contents to the repository
3. Go to Settings → Pages
4. Select main branch and /root folder
5. Your app will be live at `https://yourusername.github.io/repo-name`

### Option 2: Vercel (Free)

1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to web-app folder: `cd web-app`
3. Run: `vercel`
4. Follow the prompts
5. Your app will be deployed!

### Option 3: Netlify (Free)

1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `web-app` folder
3. Your app is live!

### Option 4: Cloudflare Pages (Free)

1. Connect your GitHub repository
2. Select the `web-app` folder
3. Deploy!

## iOS Installation

1. Open the deployed web app in Safari on your iOS device
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will appear as a native app!

## Limitations

- **Ball Detection**: Currently uses placeholder. You need to convert and load your YOLO model
- **Performance**: May be slower on older devices
- **Camera**: Requires HTTPS for camera access (all hosting platforms above provide this)

## Browser Support

- ✅ Safari (iOS 11+)
- ✅ Chrome (Android & Desktop)
- ✅ Firefox (Desktop)
- ✅ Edge (Desktop)

## Development

To test locally:

```bash
# Use a simple HTTP server (requires HTTPS for camera)
python -m http.server 8000

# Or use a tool like serve
npx serve -s .
```

**Note**: For camera access, you need HTTPS. Use ngrok or similar for local testing:

```bash
ngrok http 8000
```

Then access via the ngrok HTTPS URL.

