import pytest
from unittest.mock import MagicMock, patch
from src.pipeline_engine import PipelineEngine
from src.infrastructure.models import PipelineStep

def test_pipeline_engine_initialization(db_session, sample_pipeline):
    engine = PipelineEngine(pipeline_id=sample_pipeline.id)
    # We need to inject the mock session since PipelineEngine gets it from a generator
    engine.db = db_session 
    assert engine.pipeline_id == sample_pipeline.id

def test_pipeline_run_not_found(db_session, sample_pipeline):
    engine = PipelineEngine(pipeline_id=sample_pipeline.id)
    engine.db = db_session
    # Run ID 999 does not exist
    result = engine.run(run_id=999)
    assert result is None

@patch('src.pipeline_engine.ExtractionStep.execute')
def test_pipeline_step_delegation(mock_extraction_execute, db_session, sample_pipeline, sample_run):
    # Add steps
    step1 = PipelineStep(pipeline_id=sample_pipeline.id, name="Step 1", step_type="extraction", order=1, config_json={"query": "SELECT 1"})
    db_session.add(step1)
    db_session.commit()

    engine = PipelineEngine(pipeline_id=sample_pipeline.id)
    engine.db = db_session
    # Prevent engine from closing the shared test session
    engine.db.close = MagicMock()
    
    engine.run(run_id=sample_run.id)
    
    # Verify delegation
    assert mock_extraction_execute.call_count == 1
    # Verify status
    # We can use the session still because we mocked close()
    db_session.expire_all() # Refresh all objects
    sample_run_refreshed = db_session.query(type(sample_run)).get(sample_run.id)
    assert sample_run_refreshed.status == "completed"

