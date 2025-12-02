import sys
import os
from sqlalchemy import create_engine, inspect, text
import yaml

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def load_config(config_path):
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)

def list_tables(config_path):
    config = load_config(config_path)
    db_config = config['database']
    
    # Construct connection string
    # Assuming psycopg2 driver
    conn_str = f"postgresql+psycopg2://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
    
    try:
        engine = create_engine(conn_str)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Tables in database '{db_config['database']}':")
        for table in tables:
            print(f" - {table}")
            
        # Try selecting from 'users'
        if 'users' in tables:
            print("\nAttempting to query 'users' table...")
            with engine.connect() as conn:
                result = conn.execute(text("SELECT * FROM users LIMIT 5"))
                print(f"Successfully queried 'users'. Rows: {result.fetchall()}")
                
            print("\nTesting pandas read_sql...")
            import pandas as pd
            df = pd.read_sql("SELECT * FROM users LIMIT 5", engine)
            print(f"Pandas read_sql success! Shape: {df.shape}")
        else:
            print("\nTable 'users' NOT found in list.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_tables("config/config_v2.yaml")
