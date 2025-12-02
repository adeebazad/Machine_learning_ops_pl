import pandas as pd
from sqlalchemy import create_engine
from .db_connector import DatabaseConnector
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class PostgresConnector(DatabaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.engine = None

    def connect(self):
        try:
            # Construct connection string: postgresql+psycopg2://user:password@host:port/dbname
            conn_str = f"postgresql+psycopg2://{self.config['user']}:{self.config['password']}@{self.config['host']}:{self.config['port']}/{self.config['database']}"
            self.engine = create_engine(conn_str)
            logger.info("Successfully connected to PostgreSQL database.")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise

    def fetch_data(self, query: str) -> pd.DataFrame:
        if not self.engine:
            self.connect()
        try:
            df = pd.read_sql(query, self.engine)
            logger.info(f"Fetched {len(df)} rows from PostgreSQL.")
            return df
        except Exception as e:
            logger.error(f"Error fetching data from PostgreSQL: {e}")
            raise

    def save_data(self, data: pd.DataFrame, table_name: str, if_exists: str = 'append'):
        if not self.engine:
            self.connect()
        try:
            data.to_sql(name=table_name, con=self.engine, if_exists=if_exists, index=False)
            logger.info(f"Saved {len(data)} rows to PostgreSQL table '{table_name}'.")
        except Exception as e:
            logger.error(f"Error saving data to PostgreSQL: {e}")
            raise

    def close(self):
        if self.engine:
            self.engine.dispose()
            logger.info("PostgreSQL connection closed.")

    def get_tables(self) -> list:
        if not self.engine:
            self.connect()
        try:
            from sqlalchemy import inspect
            inspector = inspect(self.engine)
            return inspector.get_table_names()
        except Exception as e:
            logger.error(f"Error fetching tables from PostgreSQL: {e}")
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
            logger.error(f"Error fetching columns from PostgreSQL table '{table_name}': {e}")
            return []

    def get_row_count(self, table_name: str) -> int:
        if not self.engine:
            self.connect()
        try:
            from sqlalchemy import text
            with self.engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                return result.scalar()
        except Exception as e:
            logger.error(f"Error fetching row count from PostgreSQL table '{table_name}': {e}")
            return 0
