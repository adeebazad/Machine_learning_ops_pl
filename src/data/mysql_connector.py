import pandas as pd
from sqlalchemy import create_engine
from .db_connector import DatabaseConnector
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class MySQLConnector(DatabaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.engine = None

    def connect(self):
        try:
            # Construct connection string: mysql+mysqlconnector://user:password@host:port/dbname
            conn_str = f"mysql+mysqlconnector://{self.config['user']}:{self.config['password']}@{self.config['host']}:{self.config['port']}/{self.config['database']}"
            self.engine = create_engine(conn_str)
            logger.info("Successfully connected to MySQL database.")
        except Exception as e:
            logger.error(f"Failed to connect to MySQL: {e}")
            raise

    def fetch_data(self, query: str) -> pd.DataFrame:
        if not self.engine:
            self.connect()
        try:
            df = pd.read_sql(query, self.engine)
            logger.info(f"Fetched {len(df)} rows from MySQL.")
            return df
        except Exception as e:
            logger.error(f"Error fetching data from MySQL: {e}")
            raise

    def save_data(self, data: pd.DataFrame, table_name: str, if_exists: str = 'append'):
        if not self.engine:
            self.connect()
        try:
            # Sanitize column names: replace spaces with underscores, remove special chars
            data_to_save = data.copy()
            data_to_save.columns = [str(col).replace(' ', '_').replace('[', '_').replace(']', '_').replace('%', 'P') for col in data_to_save.columns]
            
            data_to_save.to_sql(name=table_name, con=self.engine, if_exists=if_exists, index=False)
            logger.info(f"Saved {len(data)} rows to MySQL table '{table_name}'.")
        except Exception as e:
            logger.error(f"Error saving data to MySQL: {e}")
            raise

    def close(self):
        if self.engine:
            self.engine.dispose()
            logger.info("MySQL connection closed.")

    def get_tables(self) -> list:
        if not self.engine:
            self.connect()
        try:
            from sqlalchemy import inspect
            inspector = inspect(self.engine)
            return inspector.get_table_names()
        except Exception as e:
            logger.error(f"Error fetching tables from MySQL: {e}")
            return []

    def get_columns(self, table_name: str) -> list:
        if not self.engine:
            self.connect()
        try:
            from sqlalchemy import inspect
            inspector = inspect(self.engine)
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            return columns
        except Exception as e:
            logger.error(f"Error fetching columns from MySQL table '{table_name}': {e}")
            return []

    def get_row_count(self, table_name: str) -> int:
        if not self.engine:
            self.connect()
        try:
            with self.engine.connect() as conn:
                result = conn.execute(f"SELECT COUNT(*) FROM {table_name}")
                return result.scalar()
        except Exception as e:
            logger.error(f"Error fetching row count from MySQL table '{table_name}': {e}")
            return 0
