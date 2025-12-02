import sys
import os
from sqlalchemy import create_engine, text

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Database URL
DATABASE_URL = "mysql+mysqlconnector://root:root@localhost:3306/alter_managment"

def drop_table():
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            print(f"Connected to {DATABASE_URL}")
            print("Dropping table 'predictions'...")
            connection.execute(text("DROP TABLE IF EXISTS predictions"))
            print("Table 'predictions' dropped successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    drop_table()
