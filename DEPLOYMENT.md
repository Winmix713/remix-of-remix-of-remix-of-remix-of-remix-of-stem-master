# 🚀 Production Deployment Guide

This guide covers deploying the audio stem separation system to production, including the FastAPI backend and Supabase Edge Function configuration.

## 📋 Overview

Production deployment consists of:
1. **Backend:** FastAPI server running the audio-separator processing
2. **Frontend:** React app hosted (already deployed via Netlify/Vercel)
3. **Edge Function:** Supabase Edge Function orchestrating the process
4. **Storage:** Supabase storage for audio files
5. **Configuration:** Environment variables linking all components

---

## 🔧 Phase 1: Backend Deployment

### Option A: Deploy to VPS (Recommended for Full Control)

#### Requirements
- Linux server (Ubuntu 20.04+ recommended)
- Python 3.10+
- Minimum 4GB RAM, 20GB disk space
- Optional: NVIDIA GPU with CUDA for faster processing

#### Deployment Steps

**Step 1: SSH into your server**
```bash
ssh username@your-server-ip
```

**Step 2: Install system dependencies**
```bash
sudo apt-get update
sudo apt-get install -y python3.10 python3-pip ffmpeg git
sudo apt-get install -y build-essential python3-dev
```

**Step 3: Clone your project**
```bash
git clone https://github.com/yourusername/your-audio-splitter.git
cd your-audio-splitter
```

**Step 4: Set up Python environment**
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
```

**Step 5: Install dependencies**
```bash
pip install "audio-separator[gpu]"  # or [cpu] if no GPU
pip install fastapi uvicorn gunicorn python-multipart aiofiles
```

**Step 6: Create systemd service file**

Create `/etc/systemd/system/audio-separator.service`:
```ini
[Unit]
Description=Audio Separator FastAPI Backend
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/home/username/your-audio-splitter
Environment="PATH=/home/username/your-audio-splitter/venv/bin"
ExecStart=/home/username/your-audio-splitter/venv/bin/gunicorn backend:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 300

Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Step 7: Enable and start the service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable audio-separator
sudo systemctl start audio-separator
```

**Step 8: Check service status**
```bash
sudo systemctl status audio-separator
# Check logs
sudo journalctl -u audio-separator -f
```

### Option B: Docker Deployment (Recommended for Simplicity)

#### Create Dockerfile

Create `Dockerfile` in project root:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend.py .
COPY models/ ./models/

# Create directories
RUN mkdir -p uploads outputs

# Expose port
EXPOSE 8000

# Run application
CMD ["gunicorn", "backend:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "300"]
```

#### Create requirements.txt

```
fastapi==0.104.1
uvicorn==0.24.0
gunicorn==21.2.0
python-multipart==0.0.6
aiofiles==23.2.1
audio-separator==0.17.0
torch==2.1.1
torchaudio==2.1.1
```

#### Build and push image

```bash
# Build image
docker build -t your-registry/audio-separator:latest .

# Push to registry (Docker Hub, ECR, etc.)
docker push your-registry/audio-separator:latest
```

#### Deploy to Docker host

```bash
# On your server
docker pull your-registry/audio-separator:latest

# Run container
docker run -d \
  --name audio-separator \
  -p 8000:8000 \
  -v /data/audio-files:/app/uploads \
  -v /data/outputs:/app/outputs \
  -v /data/models:/app/models \
  --restart unless-stopped \
  your-registry/audio-separator:latest

# Check logs
docker logs -f audio-separator
```

### Option C: Deploy to Heroku

```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create your-audio-splitter

# Set buildpack
heroku buildpacks:set heroku/python

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### Option D: Deploy to Railway.app

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Create new project
4. Add Python service
5. Set environment variable: `PYTHON_RUNTIME=3.10`
6. Deploy!

---

## 🔐 Phase 2: Configure Supabase Edge Function

### Step 1: Set Backend URL in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Functions** → **stem-separation**
4. Click **Settings**
5. Add environment variable:
   - **Name:** `AUDIO_SPLITTER_API_URL`
   - **Value:** `https://your-backend-domain.com` (your production backend URL)
6. Click **Update**
7. **Important:** Wait 30-60 seconds for the environment variable to propagate

### Step 2: Deploy Edge Function

The edge function should already be deployed. If you made changes:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Deploy
supabase functions deploy stem-separation --project-id your-project-id
```

### Step 3: Verify Edge Function

Test the edge function with a curl request:

```bash
curl -X POST https://your-project-id.supabase.co/functions/v1/stem-separation \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/sample.mp3",
    "modelName": "htdemucs_ft",
    "outputFormat": "mp3"
  }'
```

---

## 🔗 Phase 3: Set Up Reverse Proxy (Nginx)

For better security, error handling, and performance, use Nginx as a reverse proxy.

### Create Nginx configuration

Create `/etc/nginx/sites-available/audio-separator`:

```nginx
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy settings
    client_max_body_size 100M;  # Max file upload size

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

### Enable Nginx configuration

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/audio-separator /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Set up SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d api.yourdomain.com

# Auto-renewal is set up automatically
```

---

## 📊 Phase 4: Monitoring & Logging

### Application Logging

Update your `backend.py` to include structured logging:

```python
import logging
from logging.handlers import RotatingFileHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            'audio_separator.log',
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
    ]
)

logger = logging.getLogger(__name__)
```

### System Monitoring

Install monitoring tools:

```bash
# Install Prometheus
sudo apt-get install -y prometheus

# Install Grafana
sudo apt-get install -y grafana-server

# Enable and start
sudo systemctl enable prometheus grafana-server
sudo systemctl start prometheus grafana-server
```

### Health Check Monitoring

Set up external monitoring (Uptime Robot, Datadog, etc.) to periodically check:

```bash
curl -s https://api.yourdomain.com/api/health | grep "healthy"
```

---

## ⚙️ Phase 5: Environment Configuration

### Create `.env.production` on backend server

```bash
# Backend configuration
AUDIO_SPLITTER_MAX_FILE_SIZE=104857600  # 100MB
AUDIO_SPLITTER_TIMEOUT=600  # 10 minutes

# Storage configuration
UPLOAD_DIR=/data/uploads
OUTPUT_DIR=/data/outputs
MODEL_DIR=/data/models

# GPU configuration
CUDA_VISIBLE_DEVICES=0  # Set to -1 for CPU only

# Logging
LOG_LEVEL=INFO
```

### Create `.env.production` in frontend directory

```bash
# Already configured in your project
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-key
```

---

## 🔒 Security Considerations

### 1. API Rate Limiting

Add rate limiting to backend:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/separate")
@limiter.limit("5/minute")
async def separate_stems(...):
    ...
```

### 2. Authentication (Optional)

Implement API key authentication:

```python
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

@app.post("/api/separate")
async def separate_stems(..., api_key: str = Depends(api_key_header)):
    if api_key != os.getenv("API_KEY"):
        raise HTTPException(status_code=403, detail="Invalid API key")
    ...
```

### 3. File Validation

```python
import mimetypes

ALLOWED_EXTENSIONS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a'}

@app.post("/api/separate")
async def separate_stems(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
    ...
```

### 4. HTTPS Only

Ensure all traffic is encrypted:
- Use HTTPS certificates (Let's Encrypt)
- Set HSTS headers
- Disable HTTP

### 5. CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Specific domain only
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)
```

---

## 📈 Performance Optimization

### 1. Model Caching

Pre-load models on startup to avoid first-request delay:

```python
from contextlib import asynccontextmanager

models_cache = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load models
    print("Loading models...")
    separator = Separator(model_file_dir=str(MODEL_DIR))
    separator.load_model("htdemucs_ft.yaml")
    models_cache['htdemucs_ft'] = separator
    yield
    # Shutdown: Cleanup
    print("Shutting down...")

app = FastAPI(lifespan=lifespan)
```

### 2. Queue System (for high load)

Use Celery + Redis for processing queue:

```python
from celery import Celery

celery_app = Celery('audio_separator', broker='redis://localhost:6379')

@celery_app.task
def process_audio(input_file, model_name):
    # Long-running processing
    ...
```

### 3. Load Balancing

For multiple backends, use Nginx upstream:

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
    least_conn;  # Load balancing strategy
}
```

---

## 🚨 Troubleshooting Production

### Error: "Backend server unreachable"

1. Check backend service: `systemctl status audio-separator`
2. Check firewall: `sudo ufw status`
3. Check Nginx: `sudo nginx -t`
4. Check logs: `journalctl -u audio-separator -n 50`

### Error: "Timeout"

1. Increase proxy timeout in Nginx (already set to 300s)
2. Increase backend timeout in gunicorn: `--timeout 600`
3. Check if models are being downloaded (takes time on first run)

### Memory issues

1. Monitor memory: `free -h`
2. Limit concurrent workers in gunicorn: `-w 2`
3. Use GPU: `-k uvicorn.workers.UvicornWorker`

### Disk space issues

1. Clean up old uploads: `find uploads -mtime +7 -delete`
2. Clear model cache: `rm -rf ~/.cache/audio-separator/`
3. Monitor disk: `df -h`

---

## 📋 Deployment Checklist

- [ ] Backend deployed and running
- [ ] Backend URL is accessible from internet
- [ ] SSL certificate installed
- [ ] Supabase Edge Function environment variable set
- [ ] Edge Function tested and working
- [ ] Frontend environment variables updated if needed
- [ ] Nginx reverse proxy configured
- [ ] Health checks passing
- [ ] Monitoring and logging set up
- [ ] Security checks complete (HTTPS, CORS, rate limiting)
- [ ] Performance tested with sample file
- [ ] Error handling and rollback plan documented

---

## 📚 Additional Resources

- **Gunicorn Documentation:** https://docs.gunicorn.org/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **Supabase Deployment:** https://supabase.com/docs/guides/functions/deploy
- **Docker Deployment:** https://docs.docker.com/

---

## Next Steps

1. Monitor production for errors and performance
2. Set up automated backups for output files
3. Implement API analytics
4. Plan for scaling if needed
5. Regular security updates and patching

