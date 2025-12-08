from celery import Celery
import os

# Get broker URL from env or default to localhost (for local dev without docker networking)
# If running in docker, it should be 'redis://redis:6379/0'
# If running locally on Windows with Docker Redis mapped to localhost:6379, use 'redis://localhost:6379/0'
BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
BACKEND_URL = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

celery_app = Celery('mlops_pipeline', broker=BROKER_URL, backend=BACKEND_URL, include=['src.tasks'])

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)
