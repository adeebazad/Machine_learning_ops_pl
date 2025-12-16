from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
from src.infrastructure.database import get_db
from src.infrastructure.models import Dashboard, DashboardChart

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

# Pydantic Models
class ChartCreate(BaseModel):
    name: str
    chart_type: str
    config: Dict[str, Any]

class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ChartUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class ChartResponse(BaseModel):
    id: int
    name: str
    chart_type: str
    config: Dict[str, Any]
    class Config:
        orm_mode = True

class DashboardResponse(BaseModel):
    id: int
    uuid: str
    name: str
    description: Optional[str]
    created_at: datetime
    charts: List[ChartResponse] = []
    class Config:
        orm_mode = True

# Endpoints
@router.post("/", response_model=DashboardResponse)
def create_dashboard(dashboard: DashboardCreate, db: Session = Depends(get_db)):
    db_dashboard = Dashboard(
        uuid=str(uuid.uuid4()),
        name=dashboard.name,
        description=dashboard.description
    )
    db.add(db_dashboard)
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard

@router.get("/", response_model=List[DashboardResponse])
def list_dashboards(db: Session = Depends(get_db)):
    return db.query(Dashboard).all()

@router.get("/{id}", response_model=DashboardResponse)
def get_dashboard(id: int, db: Session = Depends(get_db)):
    db_dashboard = db.query(Dashboard).filter(Dashboard.id == id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return db_dashboard

@router.post("/{id}/charts", response_model=ChartResponse)
def add_chart(id: int, chart: ChartCreate, db: Session = Depends(get_db)):
    db_dashboard = db.query(Dashboard).filter(Dashboard.id == id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    db_chart = DashboardChart(
        dashboard_id=id,
        name=chart.name,
        chart_type=chart.chart_type,
        config=chart.config
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    return db_chart

@router.delete("/{id}/charts/{chart_id}")
def delete_chart(id: int, chart_id: int, db: Session = Depends(get_db)):
     db_chart = db.query(DashboardChart).filter(DashboardChart.id == chart_id, DashboardChart.dashboard_id == id).first()
     if not db_chart:
         raise HTTPException(status_code=404, detail="Chart not found")
     db.delete(db_chart)
     db.commit()
     return {"message": "Chart deleted"}

@router.delete("/{id}")
def delete_dashboard(id: int, db: Session = Depends(get_db)):
    db_dashboard = db.query(Dashboard).filter(Dashboard.id == id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(db_dashboard)
    db.commit()
    return {"message": "Dashboard deleted"}

@router.put("/{id}", response_model=DashboardResponse)
def update_dashboard(id: int, dashboard: DashboardUpdate, db: Session = Depends(get_db)):
    db_dashboard = db.query(Dashboard).filter(Dashboard.id == id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if dashboard.name is not None:
        db_dashboard.name = dashboard.name
    if dashboard.description is not None:
        db_dashboard.description = dashboard.description
        
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard

@router.put("/{id}/charts/{chart_id}", response_model=ChartResponse)
def update_chart(id: int, chart_id: int, chart: ChartUpdate, db: Session = Depends(get_db)):
    db_chart = db.query(DashboardChart).filter(DashboardChart.id == chart_id, DashboardChart.dashboard_id == id).first()
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    if chart.name is not None:
        db_chart.name = chart.name
    if chart.config is not None:
        # Merging logic could be complex, but for now we replace. 
        # Alternatively, updates handling could be partial if needed, but Pydantic usually replaces dicts.
        # SQLAlchemy with MutableDict might be needed for deep updates, but assignment usually works.
        db_chart.config = chart.config
        
    db.commit()
    db.refresh(db_chart)
    return db_chart

@router.get("/public/{uuid_str}", response_model=DashboardResponse)
def get_public_dashboard(uuid_str: str, db: Session = Depends(get_db)):
    db_dashboard = db.query(Dashboard).filter(Dashboard.uuid == uuid_str).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return db_dashboard
