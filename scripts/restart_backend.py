import psutil
import os
import signal
import time
import subprocess
import sys

def kill_api_process():
    print("Searching for running API process...")
    killed = False
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline and 'python' in proc.info['name'] and 'src.api:app' in ' '.join(cmdline):
                print(f"Found API process (PID: {proc.info['pid']}). Killing...")
                proc.kill()
                killed = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    if killed:
        print("API process killed.")
        time.sleep(2) # Wait for port to free up
    else:
        print("No running API process found.")

def start_api_process():
    print("Starting API process...")
    # We use Popen to start it in a new window/background if possible, 
    # but for this script we just want to start it detached.
    # On Windows, start_new_session=True is similar to nohup/setsid
    
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    
    cmd = [sys.executable, "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    
    if os.name == 'nt':
        # On Windows, use creationflags to open in new window is tricky from python without shell=True and 'start'
        # But we can just run it as a subprocess here for now, or use 'start' via shell
        subprocess.Popen("start cmd /k python -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload", shell=True, env=env)
    else:
        subprocess.Popen(cmd, env=env)
    
    print("API process started.")

if __name__ == "__main__":
    kill_api_process()
    start_api_process()
