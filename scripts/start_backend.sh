#!/bin/bash

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "Command 'uvicorn' not found. Checking python module..."
    if ! python -m uvicorn --version &> /dev/null; then
         echo "Error: Uvicorn is not installed."
         echo "Please activate your venv and run: pip install -r requirements.txt"
         exit 1
    fi
    CMD="python -m uvicorn"
else
    CMD="uvicorn"
fi

echo "Starting Backend API on Port 8001..."
# Run uvicorn pointing to src.api:app
# --reload: auto-restart on code changes
# --port 8001: matching frontend config
$CMD src.api:app --host 0.0.0.0 --port 8001 --reload
