from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="CloudOpsAI Simple Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "CloudOpsAI Backend is running!"}

@app.get("/health")
async def health():
    return {"status": "healthy", "port": 9010}

@app.get("/api/test")
async def test():
    return {"message": "API is working", "endpoint": "/api/test"}

if __name__ == "__main__":
    print("Starting CloudOpsAI Backend on port 9010...")
    uvicorn.run(app, host="127.0.0.1", port=9010)
