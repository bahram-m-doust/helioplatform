# Dev image. Build context: REPO ROOT (so packages/agent-common can be COPY'd in).
FROM python:3.11-slim
WORKDIR /app

COPY packages/agent-common /opt/agent-common
RUN pip install --no-cache-dir -e /opt/agent-common

COPY agents/campaign-maker/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY agents/campaign-maker/backend ./

EXPOSE 8050
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8050"]
