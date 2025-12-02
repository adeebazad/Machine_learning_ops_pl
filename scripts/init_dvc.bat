@echo off
echo Initializing Git...
git init

echo Initializing DVC...
python -m dvc init

echo Configuring DVC remote (local storage for demo)...
mkdir dvc_storage
python -m dvc remote add -d myremote dvc_storage

echo DVC initialized. To track data, run:
echo dvc add data/your_data.csv
echo git add data/your_data.csv.dvc .gitignore
echo git commit -m "Add data"
