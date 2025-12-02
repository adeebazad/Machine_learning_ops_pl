@echo off
python -m mlflow ui --port 5000 --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlartifacts
