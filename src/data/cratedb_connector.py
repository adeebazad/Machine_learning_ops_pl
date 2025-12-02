import pandas as pd
from crate import client
from .db_connector import DatabaseConnector
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class CrateDBConnector(DatabaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.connection = None
        self.cursor = None

    def connect(self):
        try:
            # CrateDB connection usually takes a list of servers
            servers = [f"{self.config['host']}:{self.config['port']}"]
            self.connection = client.connect(servers=servers, username=self.config.get('user'), password=self.config.get('password'))
            self.cursor = self.connection.cursor()
            logger.info("Successfully connected to CrateDB.")
        except Exception as e:
            logger.error(f"Failed to connect to CrateDB: {e}")
            raise

    def fetch_data(self, query: str) -> pd.DataFrame:
        if not self.connection:
            self.connect()
        try:
            self.cursor.execute(query)
            columns = [c[0] for c in self.cursor.description]
            data = self.cursor.fetchall()
            df = pd.DataFrame(data, columns=columns)
            logger.info(f"Fetched {len(df)} rows from CrateDB.")
            return df
        except Exception as e:
            logger.error(f"Error fetching data from CrateDB: {e}")
            raise

    def save_data(self, data: pd.DataFrame, table_name: str, if_exists: str = 'append'):
        # CrateDB pandas support is limited, usually requires specific insert logic or sqlalchemy
        # For simplicity, we'll try using sqlalchemy if possible, but CrateDB has a specific dialect.
        # Alternatively, we can use the cursor to insert.
        # Here we will assume sqlalchemy-cratedb is installed or use basic insert.
        # For this implementation, let's use the cursor for bulk insert to be safe without extra deps if possible,
        # but sqlalchemy is cleaner. Let's try sqlalchemy with crate dialect.
        
        from sqlalchemy import create_engine
        try:
            conn_str = f"crate://{self.config['host']}:{self.config['port']}"
            engine = create_engine(conn_str)
            data.to_sql(name=table_name, con=engine, if_exists=if_exists, index=False)
            logger.info(f"Saved {len(data)} rows to CrateDB table '{table_name}'.")
        except Exception as e:
            logger.error(f"Error saving data to CrateDB: {e}")
            raise

    def close(self):
        if self.connection:
            self.connection.close()
            logger.info("CrateDB connection closed.")
