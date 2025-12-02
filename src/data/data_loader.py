from typing import Dict
from .db_connector import DatabaseConnector
from .mysql_connector import MySQLConnector
from .postgres_connector import PostgresConnector
from .cratedb_connector import CrateDBConnector
from .mongo_connector import MongoConnector

class DataLoader:
    """
    Factory class to get the appropriate database connector.
    """
    
    @staticmethod
    def get_connector(db_type: str, config: Dict) -> DatabaseConnector:
        """
        Returns a database connector instance based on db_type.
        
        Args:
            db_type: One of 'mysql', 'postgres', 'cratedb', 'mongodb'
            config: Dictionary containing connection parameters
        """
        if db_type == 'mysql':
            return MySQLConnector(config)
        elif db_type == 'postgres':
            return PostgresConnector(config)
        elif db_type == 'cratedb':
            return CrateDBConnector(config)
        elif db_type == 'mongodb':
            return MongoConnector(config)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
