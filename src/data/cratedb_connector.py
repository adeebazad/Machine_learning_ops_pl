import pandas as pd
from sqlalchemy import create_engine, text
from .db_connector import DatabaseConnector
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class CrateDBConnector(DatabaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.engine = None

    def connect(self):
        try:
            # Construct connection string: crate://user:password@host:port
            # Default CrateDB port for HTTP is 4200, but user might map it differently
            user = self.config.get('user', 'crate')
            password = self.config.get('password', '')
            host = self.config.get('host', 'localhost')
            port = self.config.get('port', 4200)
            schema = self.config.get('schema', 'doc')
            
            # Handle empty password
            auth_part = f"{user}"
            if password:
                auth_part += f":{password}"
            
            conn_str = f"crate://{auth_part}@{host}:{port}"
            
            # CrateDB specific arguments can be passed here if needed
            self.engine = create_engine(conn_str, connect_args={'schema': schema})
            logger.info(f"Successfully connected to CrateDB at {host}:{port}")
        except Exception as e:
            logger.error(f"Failed to connect to CrateDB: {e}")
            raise

    def fetch_data(self, query: str) -> pd.DataFrame:
        if not self.engine:
            self.connect()
        try:
            # CrateDB doesn't support transactions in the same way, so we might need to be careful
            # but for reading it should be fine.
            with self.engine.connect() as connection:
                df = pd.read_sql(query, connection)
            logger.info(f"Fetched {len(df)} rows from CrateDB.")
            return df
        except Exception as e:
            logger.error(f"Error fetching data from CrateDB: {e}")
            raise

    def save_data(self, data: pd.DataFrame, table_name: str, if_exists: str = 'append'):
        if not self.engine:
            self.connect()
        try:
            # Sanitize column names
            data_to_save = data.copy()
            data_to_save.columns = [str(col).replace(' ', '_').replace('[', '_').replace(']', '_').replace('%', 'P') for col in data_to_save.columns]
            
            # CrateDB supports standard SQL insert
            data_to_save.to_sql(name=table_name, con=self.engine, if_exists=if_exists, index=False, chunksize=1000)
            logger.info(f"Saved {len(data)} rows to CrateDB table '{table_name}'.")
        except Exception as e:
            logger.error(f"Error saving data to CrateDB: {e}")
            raise

    def close(self):
        if self.engine:
            self.engine.dispose()
            logger.info("CrateDB connection closed.")

    def get_tables(self) -> list:
        if not self.engine:
            self.connect()
        try:
            # Query information_schema for tables
            query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc'"
            with self.engine.connect() as connection:
                result = connection.execute(text(query))
                tables = [row[0] for row in result]
            return tables
        except Exception as e:
            logger.error(f"Error fetching tables from CrateDB: {e}")
            return []

    def get_columns(self, table_name: str) -> list:
        if not self.engine:
            self.connect()
        try:
            query = f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'doc'"
            with self.engine.connect() as connection:
                result = connection.execute(text(query))
                columns = [row[0] for row in result]
            return columns
        except Exception as e:
            logger.error(f"Error fetching columns from CrateDB table '{table_name}': {e}")
            return []

    def get_row_count(self, table_name: str) -> int:
        if not self.engine:
            self.connect()
        try:
            # CrateDB is eventually consistent, count(*) might be slow or approximate depending on version
            # but usually standard SQL works
            with self.engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM doc.{table_name}"))
                return result.scalar()
        except Exception as e:
            logger.error(f"Error fetching row count from CrateDB table '{table_name}': {e}")
            return 0
