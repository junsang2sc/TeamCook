from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers.analyze import router as analyze_router
from routers.placement import router as placement_router
from routers.replacement import router as replacement_router
from routers.tf import router as tf_router

app = FastAPI(title="TeamFit API", version="0.1.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(placement_router)
app.include_router(replacement_router)
app.include_router(tf_router)


@app.get("/health")
def health():
    return {"status": "ok"}
