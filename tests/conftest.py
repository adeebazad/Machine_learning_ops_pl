import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.infrastructure.database import Base
from src.infrastructure.models import Pipeline, PipelineStep, PipelineRun
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def sample_pipeline(db_session):
    pipeline = Pipeline(name="Test Pipeline", description="A test pipeline")
    db_session.add(pipeline)
    db_session.commit()
    return pipeline

@pytest.fixture
def sample_run(db_session, sample_pipeline):
    run = PipelineRun(pipeline_id=sample_pipeline.id, status="pending")
    db_session.add(run)
    db_session.commit()
    return run
