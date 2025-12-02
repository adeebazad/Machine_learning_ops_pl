import psutil
import os
import sys
import time
import subprocess

def kill_port_8000():
    print("Checking for process on port 8000...")
    killed = False
    for conn in psutil.net_connections():
        if conn.laddr.port == 8000:
            try:
                proc = psutil.Process(conn.pid)
                print(f"Found process {proc.name()} (PID: {proc.pid}) on port 8000. Killing...")
                proc.kill()
                killed = True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    
    if killed:
        print("Process on port 8000 killed. Waiting for port to free...")
        for _ in range(10):
            free = True
            for conn in psutil.net_connections():
                if conn.laddr.port == 8000:
                    free = False
                    break
            if free:
                print("Port 8000 is free.")
                return
            time.sleep(1)
        print("WARNING: Port 8000 still in use after 10 seconds.")
    else:
        print("No process found on port 8000.")

def start_api():
    print("Starting API...")
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    
    # Start in background and redirect output
    with open("api_debug.log", "w") as log_file:
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"],
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT
        )
    print("API started (logging to api_debug.log).")

if __name__ == "__main__":
    kill_port_8000()
    start_api()
