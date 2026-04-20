import os

SERVICE_NAME = os.getenv("SERVICE_NAME", "video-generator")
PORT = int(os.getenv("PORT", "8030"))
