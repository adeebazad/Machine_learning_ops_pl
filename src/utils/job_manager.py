import json
import os
import signal
import psutil
import time
from datetime import datetime

JOBS_FILE = "jobs.json"

class JobManager:
    def __init__(self):
        self._load_jobs()

    def _load_jobs(self):
        if os.path.exists(JOBS_FILE):
            try:
                with open(JOBS_FILE, 'r') as f:
                    self.jobs = json.load(f)
            except:
                self.jobs = []
        else:
            self.jobs = []

    def _save_jobs(self):
        with open(JOBS_FILE, 'w') as f:
            json.dump(self.jobs, f, indent=4)

    def add_job(self, pid, config_path, schedule_time):
        job = {
            "id": int(time.time()),
            "pid": pid,
            "config_path": config_path,
            "schedule_time": schedule_time,
            "status": "Running",
            "created_at": str(datetime.now())
        }
        self.jobs.append(job)
        self._save_jobs()
        return job

    def get_jobs(self):
        # Update status of jobs before returning
        for job in self.jobs:
            if job["status"] == "Running":
                if not psutil.pid_exists(job["pid"]):
                    job["status"] = "Stopped"
        self._save_jobs()
        return self.jobs

    def stop_job(self, job_id):
        for job in self.jobs:
            if job["id"] == job_id:
                if job["status"] == "Running":
                    try:
                        process = psutil.Process(job["pid"])
                        process.terminate()
                        job["status"] = "Stopped"
                        self._save_jobs()
                        return True, "Job stopped successfully."
                    except psutil.NoSuchProcess:
                        job["status"] = "Stopped"
                        self._save_jobs()
                        return True, "Process already stopped."
                    except Exception as e:
                        return False, str(e)
        return False, "Job not found."

    def clear_stopped_jobs(self):
        self.jobs = [job for job in self.jobs if job["status"] == "Running"]
        self._save_jobs()
