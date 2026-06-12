import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routes import auth, users, posts, stories, profile
from app.routes import notifications

Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(
    title="Instagram Clone API",
    version="1.0.0",
    description="FastAPI + PostgreSQL backend for K-Verse",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(stories.router)
app.include_router(profile.router)
app.include_router(notifications.router)

# Serve uploaded files at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
