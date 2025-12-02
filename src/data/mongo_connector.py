import pandas as pd
from pymongo import MongoClient
from .db_connector import DatabaseConnector
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class MongoConnector(DatabaseConnector):
    def __init__(self, config: dict):
        self.config = config
        self.client = None
        self.db = None

    def connect(self):
        try:
            # Construct connection string
            # mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]
            if self.config.get('user') and self.config.get('password'):
                uri = f"mongodb://{self.config['user']}:{self.config['password']}@{self.config['host']}:{self.config['port']}/"
            else:
                uri = f"mongodb://{self.config['host']}:{self.config['port']}/"
            
            self.client = MongoClient(uri)
            self.db = self.client[self.config['database']]
            logger.info("Successfully connected to MongoDB.")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def fetch_data(self, collection_name: str, query: dict = None) -> pd.DataFrame:
        """
        For MongoDB, the 'query' argument in fetch_data is interpreted as the collection name
        or we need to change the signature. To keep it consistent with SQL, we can pass a JSON string
        or just use the collection name if the query is simple.
        
        Let's assume 'query' param here is actually the collection name for simplicity, 
        or a specific dict if we want to filter.
        """
        if not self.client:
            self.connect()
        try:
            # If query is a string, assume it's a collection name
            if isinstance(collection_name, str):
                collection = self.db[collection_name]
                cursor = collection.find(query if query else {})
            else:
                # Fallback
                raise ValueError("Collection name must be a string")

            df = pd.DataFrame(list(cursor))
            if '_id' in df.columns:
                df = df.drop(columns=['_id']) # Drop Mongo ID for ML compatibility usually
            
            logger.info(f"Fetched {len(df)} rows from MongoDB collection '{collection_name}'.")
            return df
        except Exception as e:
            logger.error(f"Error fetching data from MongoDB: {e}")
            raise

    def save_data(self, data: pd.DataFrame, collection_name: str, if_exists: str = 'append'):
        if not self.client:
            self.connect()
        try:
            collection = self.db[collection_name]
            records = data.to_dict("records")
            
            if if_exists == 'replace':
                collection.delete_many({})
            
            if records:
                collection.insert_many(records)
            
            logger.info(f"Saved {len(records)} documents to MongoDB collection '{collection_name}'.")
        except Exception as e:
            logger.error(f"Error saving data to MongoDB: {e}")
            raise

    def close(self):
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed.")
