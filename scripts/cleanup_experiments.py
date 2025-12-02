import os
import shutil
import time

def remove_path(path):
    if os.path.exists(path):
        print(f"Removing {path}...")
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            print(f"Successfully removed {path}")
        except Exception as e:
            print(f"Error removing {path}: {e}")
    else:
        print(f"{path} does not exist.")

def cleanup():
    paths_to_remove = [
        "mlruns",
        "mlartifacts",
        "mlflow.db",
        "mlops_platform.db",
        "jobs.json",
        "api_8001.log"
    ]

    print("Starting cleanup...")
    for path in paths_to_remove:
        remove_path(path)
    print("Cleanup complete.")

if __name__ == "__main__":
    cleanup()
