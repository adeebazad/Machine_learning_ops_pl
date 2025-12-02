from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter(prefix="/files", tags=["files"])

class FileContent(BaseModel):
    path: str
    content: str

@router.get("/read")
def read_file(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    with open(path, 'r') as f:
        return {"content": f.read()}

@router.post("/save")
def save_file(file_data: FileContent):
    try:
        # Security check: only allow editing files in src/features
        if "src/features" not in file_data.path and "src\\features" not in file_data.path:
             raise HTTPException(status_code=403, detail="Access denied. Can only edit files in src/features.")

        # Backup
        if os.path.exists(file_data.path):
            with open(file_data.path + ".bak", 'w') as f:
                with open(file_data.path, 'r') as original:
                    f.write(original.read())
        
        with open(file_data.path, 'w') as f:
            f.write(file_data.content)
        return {"message": "File saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run")
def run_script(file_data: FileContent):
    try:
        # Security check
        if "src/features" not in file_data.path and "src\\features" not in file_data.path:
             raise HTTPException(status_code=403, detail="Access denied. Can only run files in src/features.")

        import subprocess
        
        # Run the script
        result = subprocess.run(
            ["python", file_data.path],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
def list_files():
    try:
        target_dir = "src/features"
        if not os.path.exists(target_dir):
            return {"files": []}
        
        files = []
        for f in os.listdir(target_dir):
            if os.path.isfile(os.path.join(target_dir, f)) and f.endswith(".py"):
                files.append(os.path.join(target_dir, f).replace("\\", "/"))
        
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
