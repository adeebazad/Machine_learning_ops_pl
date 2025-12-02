from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
from src.data.data_loader import DataLoader

router = APIRouter(prefix="/database", tags=["database"])

class DbConfig(BaseModel):
    type: str
    host: str
    port: int
    user: str
    password: str
    database: str

@router.post("/test")
def test_connection(config: DbConfig):
    try:
        connector = DataLoader.get_connector(config.type, config.dict())
        tables = connector.get_tables()
        connector.close()
        return {"status": "success", "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/columns/{table_name}")
def get_columns(table_name: str, config: DbConfig):
    try:
        connector = DataLoader.get_connector(config.type, config.dict())
        columns = connector.get_columns(table_name)
        connector.close()
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/count/{table_name}")
def get_row_count(table_name: str, config: DbConfig):
    try:
        connector = DataLoader.get_connector(config.type, config.dict())
        count = connector.get_row_count(table_name)
        connector.close()
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
