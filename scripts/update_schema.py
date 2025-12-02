import sys
import os
from sqlalchemy import text

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.data.data_loader import DataLoader
from src.utils.logger import setup_logger
import yaml

logger = setup_logger(__name__)

def load_config(config_path):
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)

def update_schema(config_path):
    config = load_config(config_path)
    connector = DataLoader.get_connector(config['database']['type'], config['database'])
    connector.connect()
    
    table_name = config['database']['prediction_table']
    column_name = "prediction_time"
    
    try:
        # Check if column exists
        with connector.engine.connect() as conn:
            # Simple way to check is to try selecting it, or just try adding it and catch error
            # Let's try adding it directly. If it exists, it will fail, which is fine.
            alter_query = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} DATETIME")
            conn.execute(alter_query)
            logger.info(f"Successfully added column '{column_name}' to table '{table_name}'.")
    except Exception as e:
        if "Duplicate column name" in str(e):
            logger.info(f"Column '{column_name}' already exists in table '{table_name}'.")
        else:
            logger.error(f"Failed to update schema: {e}")
    finally:
        connector.close()

if __name__ == "__main__":
    update_schema("config/config.yaml")
