# Deploy Guide (Ubuntu 22.04)

This guide supports both production modes:

1. Native-first (`systemd + nginx + certbot`)  
2. Docker (`docker compose + nginx + certbot`)

Ports used by default:
- Main app: `4000`
- HelioGram frontend: `5050`
- HelioGram backend: `8010`

## 1) Server Bootstrap

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx python3-venv python3-pip nodejs npm
```

Clone:
```bash
cd /opt
sudo git clone https://github.com/bahram-m-doust/platform.git helio-platform
sudo chown -R $USER:$USER /opt/helio-platform
cd /opt/helio-platform
```

Create env:
```bash
cp .env.example .env
cp apps/heliogram/.env.example apps/heliogram/.env
```

## 2) Native Mode (Recommended for restricted Docker networks)

### Main app
```bash
cd /opt/helio-platform
npm install
npm run build
```

### HelioGram backend
```bash
cd /opt/helio-platform/apps/heliogram/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
```

### HelioGram frontend
```bash
cd /opt/helio-platform/apps/heliogram/frontend
npm install
npm run build
```

### systemd units

Copy templates:
```bash
sudo cp /opt/helio-platform/infra/scripts/systemd/heliogram-backend.service /etc/systemd/system/
sudo cp /opt/helio-platform/infra/scripts/systemd/heliogram-frontend.service /etc/systemd/system/
```

Reload and enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now heliogram-backend
sudo systemctl enable --now heliogram-frontend
```

Check:
```bash
systemctl status heliogram-backend --no-pager
systemctl status heliogram-frontend --no-pager
curl http://127.0.0.1:8010/api/health/
```

## 3) Docker Mode (Optional)

```bash
cd /opt/helio-platform
docker compose up -d --build
docker compose ps
docker compose logs -f
```

If Docker Hub is blocked in your network, use Native mode.

## 4) Nginx Reverse Proxy

Base template:
```bash
sudo cp /opt/helio-platform/infra/nginx/nginx.conf /etc/nginx/sites-available/helio-platform.conf
sudo ln -sf /etc/nginx/sites-available/helio-platform.conf /etc/nginx/sites-enabled/helio-platform.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 5) SSL with Certbot

```bash
sudo certbot --nginx -d yourdomain.com -d community.yourdomain.com
```

Renewal test:
```bash
sudo certbot renew --dry-run
```

Certbot auto-renew timer is managed by systemd (`certbot.timer`).

## 6) Smoke Checklist

1. `http://127.0.0.1:8010/api/health/` returns `{"status":"ok"}`.
2. Main app loads on `:4000`.
3. Community loads on `:5050`.
4. Image/Video generate endpoints respond from backend.
5. After reboot, services come back (`systemctl status ...`).
