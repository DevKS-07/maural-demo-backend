#!/bin/bash
# =============================================================================
# Ollama GPU Server Setup — AWS EC2 (g5.xlarge / Ubuntu 22.04 Deep Learning AMI)
#
# Usage:
#   1. Launch a g5.xlarge EC2 instance with "Deep Learning AMI GPU PyTorch" (Ubuntu 22.04)
#   2. SSH into the instance
#   3. Upload this script and run:  chmod +x setup.sh && sudo ./setup.sh
#
# What this script does:
#   - Installs Ollama
#   - Configures it as a systemd service with GPU support
#   - Pulls the required models (qwen3.5:9b + nomic-embed-text)
#   - Sets up Nginx as a reverse proxy with API key authentication
#   - Configures UFW firewall
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
OLLAMA_PORT=11434
PROXY_PORT=11435
CHAT_MODEL="qwen3.5:9b"
EMBED_MODEL="nomic-embed-text"

# Generate a random API key (save this — you'll need it in your .env)
API_KEY=$(openssl rand -hex 32)

echo "============================================="
echo "  Ollama EC2 GPU Server Setup"
echo "============================================="

# ── 1. Verify GPU is available ───────────────────────────────────────────────
echo ""
echo "[1/6] Checking GPU..."
if ! nvidia-smi &>/dev/null; then
  echo "ERROR: nvidia-smi not found. Make sure you're using a GPU instance"
  echo "       with the Deep Learning AMI (comes with NVIDIA drivers pre-installed)."
  exit 1
fi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo "  GPU detected."

# ── 2. Install Ollama ────────────────────────────────────────────────────────
echo ""
echo "[2/6] Installing Ollama..."
if command -v ollama &>/dev/null; then
  echo "  Ollama already installed: $(ollama --version)"
else
  curl -fsSL https://ollama.com/install.sh | sh
  echo "  Ollama installed: $(ollama --version)"
fi

# ── 3. Configure Ollama systemd service ──────────────────────────────────────
echo ""
echo "[3/6] Configuring Ollama service..."

# Create systemd override for GPU and memory settings
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
# Bind to localhost only — Nginx handles external access
Environment="OLLAMA_HOST=127.0.0.1:11434"
# Keep models loaded in VRAM (don't unload between requests)
Environment="OLLAMA_KEEP_ALIVE=-1"
# Allow parallel requests (for the multi-agent pipeline)
Environment="OLLAMA_NUM_PARALLEL=3"
# Max loaded models (chat + embed can stay loaded simultaneously)
Environment="OLLAMA_MAX_LOADED_MODELS=2"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

# Wait for Ollama to be ready
echo "  Waiting for Ollama to start..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:${OLLAMA_PORT}/api/tags &>/dev/null; then
    echo "  Ollama is running."
    break
  fi
  sleep 1
done

# ── 4. Pull models ──────────────────────────────────────────────────────────
echo ""
echo "[4/6] Pulling models (this may take a few minutes)..."
echo "  Pulling ${CHAT_MODEL}..."
ollama pull "${CHAT_MODEL}"
echo "  Pulling ${EMBED_MODEL}..."
ollama pull "${EMBED_MODEL}"
echo "  Models ready."

# Warm up: pre-load models into VRAM so first request isn't slow
echo "  Pre-loading models into VRAM..."
curl -s http://127.0.0.1:${OLLAMA_PORT}/api/generate -d "{\"model\":\"${CHAT_MODEL}\",\"prompt\":\"hi\",\"stream\":false}" > /dev/null
curl -s http://127.0.0.1:${OLLAMA_PORT}/api/embeddings -d "{\"model\":\"${EMBED_MODEL}\",\"prompt\":\"warmup\"}" > /dev/null
echo "  Models loaded into VRAM."

# ── 5. Set up Nginx reverse proxy with API key auth ─────────────────────────
echo ""
echo "[5/6] Setting up Nginx reverse proxy..."
apt-get update -qq && apt-get install -y -qq nginx > /dev/null

cat > /etc/nginx/sites-available/ollama << NGINX_EOF
# Ollama reverse proxy with API key authentication
server {
    listen ${PROXY_PORT};

    # Reject requests without a valid API key
    set \$auth_ok 0;
    if (\$http_x_ollama_api_key = "${API_KEY}") {
        set \$auth_ok 1;
    }

    # Health check endpoint (no auth required)
    location = /health {
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }

    location / {
        if (\$auth_ok = 0) {
            return 401 '{"error":"unauthorized"}';
        }

        proxy_pass http://127.0.0.1:${OLLAMA_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;

        # LLM responses can be large and slow — increase timeouts
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 30s;

        # Support streaming responses
        proxy_buffering off;
        proxy_cache off;

        # Max request body (for large document embeddings)
        client_max_body_size 50M;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/ollama /etc/nginx/sites-enabled/ollama
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "  Nginx proxy running on port ${PROXY_PORT}."

# ── 6. Configure firewall ───────────────────────────────────────────────────
echo ""
echo "[6/6] Configuring firewall..."
ufw allow 22/tcp    > /dev/null 2>&1   # SSH
ufw allow ${PROXY_PORT}/tcp > /dev/null 2>&1   # Ollama proxy
ufw --force enable  > /dev/null 2>&1
echo "  Firewall: SSH (22) and Ollama proxy (${PROXY_PORT}) open."

# ── Done ─────────────────────────────────────────────────────────────────────
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<YOUR_EC2_PUBLIC_IP>")

echo ""
echo "============================================="
echo "  Setup Complete!"
echo "============================================="
echo ""
echo "  Instance IP:  ${INSTANCE_IP}"
echo "  Ollama proxy: http://${INSTANCE_IP}:${PROXY_PORT}"
echo "  Chat model:   ${CHAT_MODEL}"
echo "  Embed model:  ${EMBED_MODEL}"
echo ""
echo "  ┌─────────────────────────────────────────────────────────────┐"
echo "  │  YOUR API KEY (save this — it won't be shown again):       │"
echo "  │                                                             │"
echo "  │  ${API_KEY}  │"
echo "  │                                                             │"
echo "  └─────────────────────────────────────────────────────────────┘"
echo ""
echo "  Add these to your .env:"
echo ""
echo "    OLLAMA_BASE_URL=http://${INSTANCE_IP}:${PROXY_PORT}"
echo "    OLLAMA_API_KEY=${API_KEY}"
echo "    OLLAMA_CHAT_MODEL=${CHAT_MODEL}"
echo "    OLLAMA_EMBED_MODEL=${EMBED_MODEL}"
echo ""
echo "  Test it:"
echo "    curl -H 'X-Ollama-Api-Key: ${API_KEY}' http://${INSTANCE_IP}:${PROXY_PORT}/api/tags"
echo ""
echo "  AWS Security Group: Make sure port ${PROXY_PORT} is open to your API server's IP only."
echo ""
