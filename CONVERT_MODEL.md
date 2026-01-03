# Converting YOLO Model for Web App

To get the same accurate ball detection as the Python version, you need to convert the fine-tuned YOLO model to TensorFlow.js format.

## Prerequisites

```bash
pip install ultralytics tensorflowjs
```

## Convert the Model

From the project root directory:

```bash
python convert_model.py
```

This will:
1. Load the `models/finetuned.pt` model
2. Convert it to TensorFlow.js format
3. Save it to `web-app/models/finetuned_web/`

## Verify Conversion

After conversion, you should see:
```
web-app/models/finetuned_web/
  ├── model.json
  ├── weights.bin (or weights1.bin, weights2.bin, etc.)
  └── ...
```

## Deploy

Once converted, commit and push the `web-app/models/` directory:

```bash
cd web-app
git add models/
git commit -m "Add converted YOLO model for web app"
git push
```

## Performance

- **With YOLO model**: Accurate ball detection matching Python version (~30 FPS on modern devices)
- **Without YOLO model**: Falls back to pose-based estimation (less accurate, ~60 FPS)

The web app will automatically detect and use the YOLO model if it's available in `web-app/models/finetuned_web/`.

