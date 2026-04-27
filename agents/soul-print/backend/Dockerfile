# Dev image. Build context: REPO ROOT (so packages/agent-common can be COPY'd in).
FROM python:3.11-slim
WORKDIR /app

COPY packages/agent-common /opt/agent-common
RUN pip install --no-cache-dir -e /opt/agent-common

COPY agents/soul-print/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY agents/soul-print/backend ./

EXPOSE 8070
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8070"]
