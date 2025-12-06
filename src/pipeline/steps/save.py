from .base import PipelineStepHandler
from typing import Dict, Any
from src.data.data_loader import DataLoader
import logging

logger = logging.getLogger(__name__)

class SaveStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        if 'data' not in context:
             raise ValueError("No data to save")
             
        db_config = config.get('database')
        table_name = config.get('table_name')
        
        if not db_config or not table_name:
            raise ValueError("Save step requires 'database' config and 'table_name'")
            
        connector = DataLoader.get_connector(db_config['type'], db_config)
        connector.save_data(context['data'], table_name)
        connector.close()
        
        logger.info(f"Saved {len(context['data'])} rows to {table_name}.")
