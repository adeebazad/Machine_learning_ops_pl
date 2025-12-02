from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import psutil
import asyncio
import os

router = APIRouter(prefix="/system", tags=["system"])

@router.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory().percent
            await websocket.send_json({"cpu": cpu, "ram": ram})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected")

@router.get("/stats")
def get_stats():
    return {
        "cpu": psutil.cpu_percent(interval=None),
        "ram": psutil.virtual_memory().percent
    }

@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()
    log_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs', 'app.log')
    
    try:
        # Send existing logs first (last 50 lines)
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                lines = f.readlines()[-50:]
                for line in lines:
                    await websocket.send_text(line.strip())
        
        # Tail the file
        with open(log_file, 'r') as f:
            f.seek(0, 2) # Go to end
            while True:
                line = f.readline()
                if line:
                    await websocket.send_text(line.strip())
                else:
                    await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("Log client disconnected")
    except Exception as e:
        print(f"Log stream error: {e}")
        await websocket.close()
