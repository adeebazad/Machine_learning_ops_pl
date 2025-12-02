import sys
import os
from sqlalchemy import create_engine, text, inspect

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Database URL (hardcoded for now based on config)
DATABASE_URL = "mysql+mysqlconnector://root:root@localhost:3306/alter_managment"

def check_db():
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Connect and inspect
        with engine.connect() as connection:
            print(f"Connected to {DATABASE_URL}")
            
            # Check predictions table
            try:
                result = connection.execute(text("DESCRIBE predictions"))
                print("\nTable 'predictions' columns:")
                for row in result:
                    print(row)
            except Exception as e:
                print(f"\nError describing 'predictions' table: {e}")
                
            # List all tables
            print("\nAll tables:")
            inspector = inspect(engine)
            for table_name in inspector.get_table_names():
                print(f"- {table_name}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
