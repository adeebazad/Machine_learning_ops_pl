from abc import ABC, abstractmethod
import pandas as pd
from typing import Any, Dict, Optional

class DatabaseConnector(ABC):
    """
    Abstract base class for database connectors.
    """

    @abstractmethod
    def connect(self):
        """
        Establish a connection to the database.
        """
        pass

    @abstractmethod
    def fetch_data(self, query: str) -> pd.DataFrame:
        """
        Fetch data from the database and return as a Pandas DataFrame.
        """
        pass

    @abstractmethod
    def save_data(self, data: pd.DataFrame, table_name: str, if_exists: str = 'append'):
        """
        Save a DataFrame to the database.
        """
        pass

    @abstractmethod
    def close(self):
        """
        Close the database connection.
        """
        pass

    @abstractmethod
    def get_tables(self) -> list:
        """
        List all tables in the database.
        """
        pass

    @abstractmethod
    def get_columns(self, table_name: str) -> list:
        """
        List all columns in a specific table.
        """
        pass

    @abstractmethod
    def get_row_count(self, table_name: str) -> int:
        """
        Get the number of rows in a table.
        """
        pass
