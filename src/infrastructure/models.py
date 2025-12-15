from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    configs = relationship("TrainingConfig", back_populates="experiment")
    jobs = relationship("TrainingJob", back_populates="experiment")

class TrainingConfig(Base):
    __tablename__ = "training_configs"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    name = Column(String, nullable=False)
    config_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="configs")
    jobs = relationship("TrainingJob", back_populates="config")

class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    config_id = Column(Integer, ForeignKey("training_configs.id"), nullable=False)
    status = Column(String, default="pending")
    mlflow_run_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    experiment = relationship("Experiment", back_populates="jobs")
    config = relationship("TrainingConfig", back_populates="jobs")

class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Scheduling
    schedule_enabled = Column(Integer, default=0) # SQLite uses Integer for Boolean
    schedule_time = Column(String, nullable=True) # HH:MM
    schedule_interval = Column(Integer, nullable=True) # Hours
    last_run = Column(DateTime, nullable=True)

    steps = relationship("PipelineStep", back_populates="pipeline", cascade="all, delete-orphan")
    runs = relationship("PipelineRun", back_populates="pipeline", cascade="all, delete-orphan")

class PipelineStep(Base):
    __tablename__ = "pipeline_steps"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    name = Column(String, nullable=False)
    step_type = Column(String, nullable=False) # extraction, preprocessing, training, prediction, save
    order = Column(Integer, nullable=False)
    config_json = Column(JSON, nullable=False) # Specific config for this step

    pipeline = relationship("Pipeline", back_populates="steps")

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    status = Column(String, default="pending") # pending, running, completed, failed
    logs = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    pipeline = relationship("Pipeline", back_populates="runs")

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    charts = relationship("DashboardChart", back_populates="dashboard", cascade="all, delete-orphan")

class DashboardChart(Base):
    __tablename__ = "dashboard_charts"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    name = Column(String, nullable=False)
    chart_type = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    
    dashboard = relationship("Dashboard", back_populates="charts")

