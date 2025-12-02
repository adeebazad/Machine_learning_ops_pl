from .celery_app import celery_app
from .models.train import train
from .utils.logger import setup_logger

logger = setup_logger(__name__)

@celery_app.task(bind=True)
def train_model_task(self, config_path):
    try:
        logger.info(f"Starting Celery training task with config: {config_path}")
        run_id = train(config_path)
        logger.info(f"Celery training task completed. Run ID: {run_id}")
        return {"status": "success", "run_id": run_id}
    except Exception as e:
        logger.error(f"Celery training task failed: {e}")
        # Re-raise to mark task as failed
        raise e
