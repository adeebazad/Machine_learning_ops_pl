from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yaml
import os
import glob
from typing import List, Dict, Any

router = APIRouter(prefix="/config", tags=["config"])

CONFIG_DIR = "config"

class ConfigContent(BaseModel):
    content: Dict[str, Any]

class NewConfig(BaseModel):
    name: str
    content: Dict[str, Any]

@router.get("/list")
def list_configs():
    """List all available config files."""
    files = glob.glob(os.path.join(CONFIG_DIR, "*.yaml"))
    return {"files": [os.path.basename(f) for f in files]}

@router.get("/{filename}")
def get_config(filename: str):
    """Get content of a specific config file."""
    path = os.path.join(CONFIG_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Config file not found")
    
    with open(path, 'r') as f:
        try:
            return yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise HTTPException(status_code=500, detail=f"Invalid YAML: {e}")

@router.post("/{filename}")
def save_config(filename: str, config: ConfigContent):
    """Save content to a config file."""
    path = os.path.join(CONFIG_DIR, filename)
    
    try:
        with open(path, 'w') as f:
            yaml.dump(config.content, f, default_flow_style=False)
        return {"message": "Config saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create/new")
def create_config(new_config: NewConfig):
    """Create a new config file."""
    filename = new_config.name
    if not filename.endswith(".yaml"):
        filename += ".yaml"
        
    path = os.path.join(CONFIG_DIR, filename)
    if os.path.exists(path):
        raise HTTPException(status_code=400, detail="File already exists")
    
    try:
        with open(path, 'w') as f:
            yaml.dump(new_config.content, f, default_flow_style=False)
        return {"message": f"Config {filename} created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
