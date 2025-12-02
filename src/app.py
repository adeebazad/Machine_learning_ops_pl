import streamlit as st
import yaml
import os
import sys
import pandas as pd
import subprocess
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.data.data_loader import DataLoader

import streamlit as st
import yaml
import subprocess
import sys
import os
import requests
import pandas as pd
from datetime import datetime
import glob

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.utils.job_manager import JobManager

# Page Config
st.set_page_config(page_title="MLOps Pipeline UI", layout="wide")

st.title("🚀 End-to-End MLOps Pipeline")

# Sidebar for Navigation
# Sidebar for Navigation
page = st.sidebar.selectbox("Navigation", ["Dashboard", "Configuration", "Code Editor", "Training", "Inference", "Scheduler"])

# Config Management
st.sidebar.markdown("---")
st.sidebar.subheader("⚙️ Config Manager")

# List all config files
config_files = glob.glob("config/*.yaml")
selected_config = st.sidebar.selectbox("Active Config", config_files, index=0 if config_files else None)
CONFIG_PATH = selected_config if selected_config else "config/config.yaml"

if st.sidebar.button("New Config"):
    new_config_name = st.sidebar.text_input("New Config Name (e.g., config_v2.yaml)")
    if new_config_name:
        if not new_config_name.endswith(".yaml"):
            new_config_name += ".yaml"
        new_path = os.path.join("config", new_config_name)
        if os.path.exists(new_path):
            st.sidebar.error("File already exists!")
        else:
            # Copy current config
            with open(CONFIG_PATH, 'r') as f:
                content = f.read()
            with open(new_path, 'w') as f:
                f.write(content)
            st.sidebar.success(f"Created {new_config_name}!")
            st.rerun()

def load_config(path):
    with open(path, 'r') as file:
        return yaml.safe_load(file)

def save_config(path, config):
    with open(path, 'w') as file:
        yaml.dump(config, file, default_flow_style=False)

if CONFIG_PATH and os.path.exists(CONFIG_PATH):
    config = load_config(CONFIG_PATH)
else:
    st.error("No configuration file found!")
    st.stop()

# --- Dashboard ---
if page == "Dashboard":
    st.header("📊 Dashboard")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Active Config", os.path.basename(CONFIG_PATH))
    with col2:
        st.metric("Database Type", config['database']['type'])
    with col3:
        try:
            response = requests.get(config['mlflow']['tracking_uri'])
            status = "Online 🟢" if response.status_code == 200 else "Offline 🔴"
        except:
            status = "Offline 🔴"
        st.metric("MLflow Server", status)

    st.subheader("Quick Actions")
    if st.button("Open MLflow UI"):
        st.markdown(f"[Click here to open MLflow]({config['mlflow']['tracking_uri']})")

# --- Configuration ---
elif page == "Configuration":
    st.header("⚙️ Configuration Editor")
    st.info(f"Editing: {CONFIG_PATH}")
    
    # Load current config
    current_config = load_config(CONFIG_PATH)
    
    # 1. Database Configuration
    st.subheader("1. Database Connection")
    col1, col2 = st.columns(2)
    with col1:
        db_type = st.selectbox("Database Type", ["mysql", "postgres", "cratedb", "mongodb"], 
                               index=["mysql", "postgres", "cratedb", "mongodb"].index(current_config['database']['type']))
        db_host = st.text_input("Host", current_config['database']['host'])
        db_port = st.number_input("Port", value=current_config['database']['port'])
    with col2:
        db_user = st.text_input("User", current_config['database']['user'])
        db_password = st.text_input("Password", current_config['database']['password'], type="password")
        db_name = st.text_input("Database Name", current_config['database']['database'])

    # Test Connection & Fetch Tables
    if st.button("Test Connection & Fetch Tables"):
        try:
            # Create temp config for connection
            temp_db_config = {
                'type': db_type, 'host': db_host, 'port': db_port, 
                'user': db_user, 'password': db_password, 'database': db_name
            }
            connector = DataLoader.get_connector(db_type, temp_db_config)
            tables = connector.get_tables()
            connector.close()
            st.session_state['tables'] = tables
            st.success(f"Connected! Found {len(tables)} tables.")
        except Exception as e:
            st.error(f"Connection failed: {e}")
            st.session_state['tables'] = []

    # 2. Data Selection
    st.subheader("2. Data Selection")
    tables = st.session_state.get('tables', [])
    
    # If tables not fetched yet, try to use existing config values as defaults or text inputs
    default_train_table = current_config['database'].get('training_table', '')
    default_pred_table = current_config['database'].get('prediction_table', '')
    
    if tables:
        training_table = st.selectbox("Training Table", tables, 
                                      index=tables.index(default_train_table) if default_train_table in tables else 0)
        prediction_table = st.selectbox("Prediction Table", tables, 
                                        index=tables.index(default_pred_table) if default_pred_table in tables else 0)
    else:
        training_table = st.text_input("Training Table", default_train_table)
        prediction_table = st.text_input("Prediction Table", default_pred_table)

    # Fetch Columns for Target Selection
    target_columns = []
    if training_table and tables: # Only fetch if we have tables (implies connection works)
        try:
            # Re-connect to fetch columns (a bit inefficient but stateless)
            # In a real app, we might cache the connector or columns
            temp_db_config = {
                'type': db_type, 'host': db_host, 'port': db_port, 
                'user': db_user, 'password': db_password, 'database': db_name
            }
            connector = DataLoader.get_connector(db_type, temp_db_config)
            target_columns = connector.get_columns(training_table)
            connector.close()
        except Exception as e:
            st.warning(f"Could not fetch columns: {e}")

    default_target = current_config['model'].get('target_col', '')
    if target_columns:
        target_col = st.selectbox("Target Column", target_columns, 
                                  index=target_columns.index(default_target) if default_target in target_columns else 0)
    else:
        target_col = st.text_input("Target Column", default_target)

    # 3. Model Selection
    st.subheader("3. Model Selection")
    from src.models.model_factory import ModelFactory
    available_models = ModelFactory.get_available_models()
    
    default_task = current_config['model'].get('task_type', 'classification')
    task_type = st.selectbox("Task Type", ["classification", "regression"], 
                             index=["classification", "regression"].index(default_task))
    
    model_options = list(available_models[task_type].keys())
    default_model = current_config['model'].get('name', model_options[0])
    model_name = st.selectbox("Model", model_options, 
                              index=model_options.index(default_model) if default_model in model_options else 0)

    # Params
    st.markdown("#### Hyperparameters")
    col1, col2 = st.columns(2)
    current_params = current_config['model'].get('params', {})
    with col1:
        n_estimators = st.number_input("n_estimators", value=current_params.get('n_estimators', 100))
    with col2:
        # Some models don't have max_depth, but for RF/DT they do. 
        # For simplicity we keep it, or could make it dynamic based on model.
        max_depth = st.number_input("max_depth", value=current_params.get('max_depth', 10))

    # Save
    if st.button("Save Configuration"):
        new_config = current_config.copy()
        new_config['database'].update({
            'type': db_type, 'host': db_host, 'port': db_port, 
            'user': db_user, 'password': db_password, 'database': db_name,
            'training_table': training_table, 'prediction_table': prediction_table
        })
        new_config['model'].update({
            'name': model_name, 'task_type': task_type, 'target_col': target_col,
            'params': {'n_estimators': n_estimators, 'max_depth': max_depth}
        })
        
        try:
            save_config(CONFIG_PATH, new_config)
            st.success("Configuration saved successfully!")
            st.rerun()
        except Exception as e:
            st.error(f"Error saving config: {e}")

# --- Code Editor ---
elif page == "Code Editor":
    st.header("📝 Code Editor")
    st.info("Edit the preprocessing logic to handle custom data transformations.")
    
    file_path = "src/features/preprocess.py"
    
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            current_code = f.read()
        
        # Code Editor
        new_code = st.text_area("src/features/preprocess.py", value=current_code, height=600)
        
        if st.button("Save Script"):
            try:
                # Create backup
                backup_path = file_path + ".bak"
                with open(backup_path, "w") as f:
                    f.write(current_code)
                
                # Write new code
                with open(file_path, "w") as f:
                    f.write(new_code)
                
                st.success(f"File saved successfully! Backup created at {backup_path}")
            except Exception as e:
                st.error(f"Failed to save file: {e}")
    else:
        st.error(f"File not found: {file_path}")

# --- Training ---
elif page == "Training":
    st.header("🏋️ Model Training")
    
    st.write(f"Training model using config: `{CONFIG_PATH}`")
    
    if st.button("Start Training"):
        with st.spinner("Training in progress..."):
            try:
                if 'target_col' not in config['model'] or not config['model']['target_col']:
                    st.warning("Target column not set in Config. Please go to Configuration tab and set it.")
                
                # Prepare environment with UTF-8 encoding
                env = os.environ.copy()
                env['PYTHONIOENCODING'] = 'utf-8'
                
                process = subprocess.Popen(
                    [sys.executable, "src/main.py", "--config", CONFIG_PATH],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding='utf-8',
                    env=env
                )
                stdout, stderr = process.communicate()
                
                if process.returncode == 0:
                    st.success("Training completed successfully!")
                    st.text_area("Logs", stdout, height=300)
                else:
                    st.error("Training failed.")
                    st.text_area("Error Logs", stderr, height=300)
                    st.text_area("Output Logs", stdout, height=300)
            except Exception as e:
                st.error(f"An error occurred: {e}")

# --- Inference ---
elif page == "Inference":
    st.header("🔮 Model Inference")
    
    model_uri = st.text_input("Model URI (e.g., runs:/<run_id>/model)")
    
    if st.button("Run Inference"):
        if not model_uri:
            st.error("Please provide a Model URI.")
        else:
            with st.spinner("Running inference..."):
                try:
                    # Prepare environment with UTF-8 encoding
                    env = os.environ.copy()
                    env['PYTHONIOENCODING'] = 'utf-8'

                    process = subprocess.Popen(
                        [sys.executable, "src/models/predict.py", "--config", CONFIG_PATH, "--model-uri", model_uri],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        encoding='utf-8',
                        env=env
                    )
                    stdout, stderr = process.communicate()
                    
                    if process.returncode == 0:
                        st.success("Inference completed successfully!")
                        st.text_area("Logs", stdout, height=300)
                    else:
                        st.error("Inference failed.")
                        st.text_area("Error Logs", stderr, height=300)
                        st.text_area("Output Logs", stdout, height=300)
                except Exception as e:
                    st.error(f"An error occurred: {e}")

# --- Scheduler ---
elif page == "Scheduler":
    st.header("⏰ Multi-Scheduler Manager")
    
    st.markdown("Manage automated training schedules for different projects/configs.")
    
    job_manager = JobManager()
    
    # Launch New Scheduler
    st.subheader("🚀 Launch New Scheduler")
    col1, col2 = st.columns(2)
    with col1:
        st.write(f"**Config:** {os.path.basename(CONFIG_PATH)}")
    with col2:
        schedule_time = st.time_input("Select Time (Daily)", value=datetime.strptime("14:30", "%H:%M").time())
    
    if st.button("Start Scheduler"):
        time_str = schedule_time.strftime("%H:%M")
        
        try:
            # Prepare environment
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            
            # Start process
            # We use Popen without waiting to keep it running in background
            # On Windows, we use creationflags to detach, but for simplicity/visibility we'll use standard Popen
            # To track PID, we must use Popen directly, not os.system('start ...')
            
            process = subprocess.Popen(
                [sys.executable, "src/scheduler.py", "--config", CONFIG_PATH, "--time", time_str],
                env=env,
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
            )
            
            # Register job
            job_manager.add_job(process.pid, CONFIG_PATH, time_str)
            st.success(f"Scheduler started! PID: {process.pid}")
            
        except Exception as e:
            st.error(f"Failed to start scheduler: {e}")

    # Active Jobs
    st.subheader("Running Schedulers")
    jobs = job_manager.get_jobs()
    
    if jobs:
        job_df = pd.DataFrame(jobs)
        st.dataframe(job_df[['id', 'config_path', 'schedule_time', 'status', 'pid', 'created_at']])
        
        # Stop Job
        st.write("Stop a Scheduler:")
        job_id_to_stop = st.selectbox("Select Job ID to Stop", [job['id'] for job in jobs if job['status'] == 'Running'])
        
        if st.button("Stop Selected Job"):
            success, msg = job_manager.stop_job(job_id_to_stop)
            if success:
                st.success(msg)
                st.rerun()
            else:
                st.error(msg)
                
        if st.button("Clear Stopped Jobs"):
            job_manager.clear_stopped_jobs()
            st.rerun()
    else:
        st.info("No active schedulers.")
