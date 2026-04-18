# Deploy Guide (Vercel + VPS)

This setup uses:
- **Vercel** for the main marketing site (`src/`)
- **VPS** for HelioGram (`heliogram/`) because it contains Django + Postgres services

## 1) Deploy Main Site to Vercel

1. Import this repository in Vercel.
2. Use the project root as the app root.
3. Build command:
   ```bash
   npm run build
   ```
4. Output directory:
   ```bash
   dist
   ```
5. Set environment variables in Vercel:
   - `VITE_OPENROUTER_API_KEY`
   - `VITE_OPENROUTER_MODEL` (optional)
   - `VITE_OPENROUTER_FALLBACK_MODELS` (optional)
   - `VITE_COMMUNITY_URL` = your VPS community URL (example: `https://community.yourdomain.com`)

`vercel.json` is included for SPA rewrite behavior.

## 2) Deploy HelioGram to VPS (Ubuntu 22.04)

Note:
- Ubuntu version usually is **22.04 LTS** (if you wrote 22.02, use 22.04 commands below).
- Docker project/service name is `heliogram`.

### 2.1 Server Setup (once)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out / log in again, then verify:

```bash
docker --version
docker compose version
```

### 2.2 Run HelioGram with Docker (recommended)

```bash
git clone <your-repo-url>
cd helio-platform/heliogram
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
```

Default ports:
- Frontend: `5050`
- Backend: `8010`

If needed, change in `.env`:
- `HELIO_FRONTEND_PORT`
- `HELIO_BACKEND_PORT`
- `FRONTEND_URL`

### 2.3 If Docker Hub is blocked in your network

In some networks, image pull returns `403 Forbidden` from `auth.docker.io`.

Use Native mode:

```bash
cd helio-platform/heliogram/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
nohup ./venv/bin/python manage.py runserver 127.0.0.1:8010 > /tmp/heliogram-backend.log 2>&1 &

cd ../client
npm ci
nohup npm run dev -- --host 127.0.0.1 --port 5050 > /tmp/heliogram-frontend.log 2>&1 &
```

Check:

```bash
curl -I http://127.0.0.1:5050
curl -I http://127.0.0.1:8010/admin/
```

## 3) Connect Domain/Subdomain

Recommended:
- Main site: `https://yourdomain.com` (Vercel)
- Community: `https://community.yourdomain.com` (VPS)

Then set Vercel env:
```bash
VITE_COMMUNITY_URL=https://community.yourdomain.com
```

If main site is hosted on VPS (not Vercel), set the same env before build:

```bash
VITE_COMMUNITY_URL=https://community.yourdomain.com
```

## 4) Local Developer Workflow

From project root:

```bash
npm run dev
```

This will try to auto-start HelioGram Docker stack, then start main site dev server.

If Docker is blocked locally, it now tries native HelioGram startup automatically.
