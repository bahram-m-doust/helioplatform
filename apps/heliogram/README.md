# HelioGram

Community application inside the monorepo:

- Frontend: `apps/heliogram/frontend`
- Backend: `apps/heliogram/backend`

## Native Run

Backend:
```bash
cd apps/heliogram/backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8010
```

Frontend:
```bash
cd apps/heliogram/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5050 --strictPort
```

## Docker Run

From repo root:
```bash
docker compose up -d --build
```

## URLs

- Frontend: `http://localhost:5050`
- Backend API: `http://localhost:8010/api/`
- Health: `http://localhost:8010/api/health/`
