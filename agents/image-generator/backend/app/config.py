import os

SERVICE_NAME = os.getenv("SERVICE_NAME", "image-generator")
PORT = int(os.getenv("PORT", "8010"))
