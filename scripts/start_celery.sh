#!/bin/bash

# Provide instructions if Redis is not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "WARNING: Redis server does not seem to be running."
    echo "You can likely start it with: sudo service redis-server start"
    echo "Or separate command: redis-server"
    echo ""
fi

echo "Starting Celery Worker..."
echo "Ensure you are in the project root directory and your venv is active."

# Set environment variable to point to local redis if needed (default is already localhost in celery_app.py but this is safe)
export CELERY_BROKER_URL='redis://localhost:6379/0'
export CELERY_RESULT_BACKEND='redis://localhost:6379/0'

# Command to run celery worker
# -A src.celery_app: points to the celery instance in src/celery_app.py
# worker: run as worker
# --loglevel=info: show logs
# Check if celery is installed
if ! command -v celery &> /dev/null; then
    echo "Command 'celery' not found. Trying 'python -m celery'..."
    if ! python -m celery --version &> /dev/null; then
        echo "Error: Celery is not installed or not found."
        echo "Please make sure your virtual environment is active and you have installed dependencies:"
        echo "  source venv/bin/activate (or similar)"
        echo "  pip install -r requirements.txt"
        exit 1
    else
        CMD="python -m celery"
    fi
else
    CMD="celery"
fi

echo "Running Celery with: $CMD"
$CMD -A src.celery_app worker --loglevel=info
