import sys
import os
from sqlalchemy import create_engine, text

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.infrastructure.database import SQLALCHEMY_DATABASE_URL

def add_columns():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Checking for existing columns...")
        
        # Check if using SQLite
        is_sqlite = 'sqlite' in SQLALCHEMY_DATABASE_URL
        
        if is_sqlite:
            # SQLite logic
            columns = conn.execute(text("PRAGMA table_info(pipelines)")).fetchall()
            column_names = [col[1] for col in columns]
            
            if 'schedule_enabled' not in column_names:
                print("Adding 'schedule_enabled' column...")
                conn.execute(text("ALTER TABLE pipelines ADD COLUMN schedule_enabled BOOLEAN DEFAULT 0"))
            else:
                print("Column 'schedule_enabled' already exists.")
                
            if 'schedule_time' not in column_names:
                print("Adding 'schedule_time' column...")
                conn.execute(text("ALTER TABLE pipelines ADD COLUMN schedule_time VARCHAR(10) NULL"))
            else:
                print("Column 'schedule_time' already exists.")

            if 'last_run' not in column_names:
                print("Adding 'last_run' column...")
                conn.execute(text("ALTER TABLE pipelines ADD COLUMN last_run DATETIME NULL"))
            else:
                print("Column 'last_run' already exists.")
                
        else:
            # MySQL/Postgres logic (fallback)
            try:
                result = conn.execute(text("SHOW COLUMNS FROM pipelines LIKE 'schedule_enabled'"))
                if result.fetchone():
                    print("Column 'schedule_enabled' already exists.")
                else:
                    print("Adding 'schedule_enabled' column...")
                    conn.execute(text("ALTER TABLE pipelines ADD COLUMN schedule_enabled BOOLEAN DEFAULT FALSE"))
                    
                result = conn.execute(text("SHOW COLUMNS FROM pipelines LIKE 'schedule_time'"))
                if result.fetchone():
                    print("Column 'schedule_time' already exists.")
                else:
                    print("Adding 'schedule_time' column...")
                    conn.execute(text("ALTER TABLE pipelines ADD COLUMN schedule_time VARCHAR(10) NULL"))

                result = conn.execute(text("SHOW COLUMNS FROM pipelines LIKE 'last_run'"))
                if result.fetchone():
                    print("Column 'last_run' already exists.")
                else:
                    print("Adding 'last_run' column...")
                    conn.execute(text("ALTER TABLE pipelines ADD COLUMN last_run DATETIME NULL"))
            except Exception as e:
                print(f"Non-SQLite migration failed: {e}")

        conn.commit()
        print("Database migration completed successfully.")

if __name__ == "__main__":
    add_columns()
