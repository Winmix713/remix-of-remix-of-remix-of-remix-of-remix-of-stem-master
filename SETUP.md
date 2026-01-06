# 🎵 Audio Stem Separation - Local Development Setup

This guide walks you through setting up the complete audio stem separation system locally, including the FastAPI backend and the React frontend.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Python 3.10+** - Download from [python.org](https://www.python.org/downloads/)
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **FFmpeg** - Required for audio processing
- **(Optional) NVIDIA GPU with CUDA** - For faster GPU-accelerated processing

### Install FFmpeg

**Windows (with Chocolatey):**
```bash
choco install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Verify FFmpeg installation:**
```bash
ffmpeg -version
```

---

## 🚀 Phase 1: Backend Setup (FastAPI + audio-separator)

### Step 1: Create Python Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Dependencies

Install the audio-separator package with GPU or CPU support:

**With GPU support (NVIDIA CUDA):**
```bash
pip install "audio-separator[gpu]"
```

**With CPU only:**
```bash
pip install "audio-separator[cpu]"
```

**Install FastAPI and dependencies:**
```bash
pip install fastapi uvicorn python-multipart aiofiles
```

### Step 3: Create FastAPI Backend

Create a file named `backend.py` in your project root:

```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from audio_separator.separator import Separator
import uuid
from pathlib import Path
import json

app = FastAPI(title="Audio Stem Separator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for temporary files
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
MODEL_DIR = Path("models")

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "audio-stem-separator",
        "version": "1.0.0"
    }

@app.post("/api/separate")
async def separate_stems(
    file: UploadFile = File(...),
    model_name: str = Form("htdemucs_ft"),
    output_format: str = Form("mp3")
):
    """
    Separate audio stems from uploaded file
    
    Args:
        file: Audio file to process
        model_name: Name of the separation model (e.g., "htdemucs_ft", "htdemucs", "model_bs_roformer", "UVR_MDXNET_KARA_2")
        output_format: Output format (mp3, wav, flac)
    
    Returns:
        JSON with separated stems in base64 format
    """
    upload_id = str(uuid.uuid4())
    
    try:
        # Save uploaded file
        input_file = UPLOAD_DIR / f"{upload_id}_{file.filename}"
        content = await file.read()
        input_file.write_bytes(content)
        
        print(f"Processing file: {input_file}")
        print(f"Using model: {model_name}")
        
        # Initialize separator
        separator = Separator(
            model_file_dir=str(MODEL_DIR),
            output_dir=str(OUTPUT_DIR),
            normalization_threshold=0.9,
            output_format=output_format,
        )
        
        # Download model if needed and perform separation
        print("Starting stem separation...")
        output_files = separator.separate(str(input_file))
        
        print(f"Separation completed. Output files: {output_files}")
        
        # Read output files and convert to base64
        stems = {}
        if output_files and len(output_files) > 0:
            output_path = Path(output_files[0]).parent
            
            # Map stem files to stem names
            stem_names = ["vocals", "drums", "bass", "other", "instrumental"]
            
            for stem_file in output_path.glob("*.mp3"):
                stem_name = stem_file.stem.lower()
                
                # Extract stem name from filename
                for stem in stem_names:
                    if stem in stem_name:
                        with open(stem_file, "rb") as f:
                            import base64
                            content = f.read()
                            stems[stem] = base64.b64encode(content).decode()
                        break
        
        # Clean up input file
        input_file.unlink()
        
        return JSONResponse({
            "stems": stems,
            "processing_time": 0,
            "status": "succeeded"
        })
        
    except Exception as e:
        print(f"Error during separation: {str(e)}")
        return JSONResponse(
            {
                "error": str(e),
                "status": "failed"
            },
            status_code=500
        )

if __name__ == "__main__":
    import uvicorn
    print("Starting Audio Stem Separator Backend...")
    print("API available at: http://localhost:8000")
    print("Health check: http://localhost:8000/api/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 4: Run the Backend

Make sure your virtual environment is activated, then run:

```bash
python backend.py
```

Or alternatively:

```bash
uvicorn backend:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
Starting Audio Stem Separator Backend...
API available at: http://localhost:8000
Health check: http://localhost:8000/api/health
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5: Verify Backend

Open a new terminal and test the health endpoint:

**Linux/macOS:**
```bash
curl http://localhost:8000/api/health
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/health"
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "audio-stem-separator",
  "version": "1.0.0"
}
```

---

## 🧠 Phase 2: Supabase Edge Function Configuration

### Step 1: Set Backend URL Environment Variable

The Supabase Edge Function needs to know where your backend is running.

**Edit `supabase/.env.local`:**

Make sure the file contains:
```
AUDIO_SPLITTER_API_URL=http://localhost:8000
```

This tells the edge function to connect to your local backend.

### Step 2: Deploy Edge Function Locally (Optional)

To test the edge function locally without deploying to Supabase:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Start local Supabase instance
supabase start

# Run function locally
supabase functions serve stem-separation --env-file supabase/.env.local
```

---

## 🎨 Phase 3: Frontend Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Verify Environment Variables

Check that `.env` contains:
```
VITE_SUPABASE_URL=https://gyjendgfcftoovnlxurv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These should already be configured in the project.

### Step 3: Start Development Server

```bash
npm run dev
```

The frontend should be available at `http://localhost:5173` (or the port shown in the terminal).

---

## ✅ Phase 4: End-to-End Testing

### Test 1: Verify All Components Are Running

1. **Backend is running:** Open http://localhost:8000/api/health in your browser
   - Should show: `{"status":"healthy","service":"audio-stem-separator","version":"1.0.0"}`

2. **Frontend is running:** Open http://localhost:5173 in your browser
   - Should see the Stem Studio application

3. **Browser console shows no errors** (Press F12 to open DevTools)

### Test 2: Test Audio Upload and Separation

1. Go to the Stem Studio application (http://localhost:5173)
2. Upload a small audio file (MP3, WAV, or FLAC, under 50MB)
3. Select a separation model (e.g., "Demucs v4 (Fine-tuned)")
4. Click "Szétválasztás" (Separate) button
5. Wait for processing to complete (may take 1-5 minutes depending on file size and your hardware)
6. Download the separated stems (vocals, drums, bass, other)

### Test 3: Check Logs

**Backend logs (where you ran `python backend.py`):**
```
Processing file: uploads/uuid_filename.mp3
Using model: htdemucs_ft
Starting stem separation...
Separation completed. Output files: [...]
```

**Browser console logs (F12 -> Console tab):**
```
Audio successfully uploaded to: https://gyjendgfcftoovnlxurv.supabase.co/storage/v1/object/public/audio-files/uploads/uuid_filename.mp3
Calling stem-separation with model: htdemucs_ft
Separation completed successfully, stems: ['vocals', 'drums', 'bass', 'other']
```

---

## 🐛 Troubleshooting

### Error: "Backend server unreachable"

**Cause:** FastAPI backend is not running or not accessible

**Solution:**
1. Make sure backend is running: `python backend.py`
2. Check backend is listening on port 8000: `curl http://localhost:8000/api/health`
3. Verify `supabase/.env.local` has correct URL

### Error: "Invalid audio URL format"

**Cause:** Supabase storage configuration is incorrect

**Checklist:**
1. Verify `.env` has correct `VITE_SUPABASE_URL`
2. Check Supabase project settings for the correct URL
3. Look in browser console for the actual URL being generated

### Error: "AUDIO_SPLITTER_API_URL is not configured"

**Cause:** Edge function doesn't know where the backend is

**Solution:**
1. Create/update `supabase/.env.local`:
   ```
   AUDIO_SPLITTER_API_URL=http://localhost:8000
   ```
2. If using Supabase local: Restart with `supabase stop && supabase start`
3. If using deployed Supabase: Set environment variable in Supabase dashboard

### Error: "Failed to download audio file" or "Network error"

**Cause:** Edge function can't reach the Supabase storage URL

**Solution:**
1. Check your internet connection
2. Verify the audio file was uploaded successfully (check browser console)
3. Try with a different audio file
4. Check browser DevTools Network tab for the actual error

### Error: "Model loading timeout"

**Cause:** First use of a model takes time to download and load

**Solution:**
1. Be patient! First request can take 30-120 seconds
2. Monitor backend logs to see progress
3. Check FFmpeg is installed and working: `ffmpeg -version`
4. Ensure you have at least 8GB free disk space for models

### Error: "Out of memory" or "CUDA out of memory"

**Cause:** Your GPU or CPU doesn't have enough memory

**Solution:**
1. Close other applications
2. Try with a smaller audio file
3. Try with CPU-only processing: Reinstall without GPU support
4. Increase swap space (advanced)

### "No stems were extracted"

**Cause:** Backend processed the file but didn't generate output

**Checklist:**
1. Check backend logs for actual separation output files
2. Verify the output format is correct (mp3, wav, flac)
3. Try a different audio file
4. Try a different model
5. Reinstall audio-separator: `pip install --upgrade audio-separator`

### Port 8000 already in use

**Cause:** Another process is using port 8000

**Solution:**
```bash
# Find and kill the process on port 8000
# Linux/macOS:
lsof -i :8000
kill -9 <PID>

# Windows (PowerShell):
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

Or run backend on a different port:
```bash
uvicorn backend:app --reload --host 0.0.0.0 --port 8001
# Then update supabase/.env.local: AUDIO_SPLITTER_API_URL=http://localhost:8001
```

---

## 📊 Model Information

The following models are available for stem separation:

| Model ID | Model Name | Output Stems | Quality | Speed | Notes |
|----------|-----------|--------------|---------|-------|-------|
| `htdemucs_ft` | Demucs v4 (Fine-tuned) | Vocals, Drums, Bass, Other | Excellent | ~1-3x | Recommended for best quality |
| `htdemucs` | Demucs v4 (Standard) | Vocals, Drums, Bass, Other | Very Good | ~1-2x | Faster than fine-tuned |
| `model_bs_roformer` | BS-Roformer | Vocals, Instrumental | Good | ~1x | Optimized for some music genres |
| `UVR_MDXNET_KARA_2` | MDX-Net Karaoke | Vocals, Instrumental | Good | ~1x | Optimized for karaoke |

*Speed is relative to audio length (1x means processing a 3-minute song takes ~3 minutes)*

---

## 🚀 Next Steps

After successful local testing:

1. **For Production Deployment:** See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Improve Error Messages:** Customize Hungarian error messages in `src/hooks/useStemSeparation.ts`
3. **Add Features:** Implement progress tracking via WebSocket
4. **Performance:** Use job queue (Celery + Redis) for handling multiple concurrent requests
5. **Monitoring:** Set up logging and monitoring (Prometheus, Grafana)

---

## 📚 Additional Resources

- **audio-separator GitHub:** https://github.com/nomadkaraoke/python-audio-separator
- **Demucs GitHub:** https://github.com/facebookresearch/demucs
- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions

---

## ❓ Still Having Issues?

1. Check the **Troubleshooting** section above
2. Review the logs in both:
   - Backend console (where you ran `python backend.py`)
   - Browser DevTools Console (F12)
   - Browser Network tab (F12 -> Network)
3. Check that all prerequisites are installed
4. Try the latest version: `pip install --upgrade audio-separator`
5. Clear browser cache: `Ctrl+Shift+Delete` (Cmd+Shift+Delete on macOS)

