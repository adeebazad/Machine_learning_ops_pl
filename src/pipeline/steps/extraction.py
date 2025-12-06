from .base import PipelineStepHandler
from typing import Dict, Any
from src.data.data_loader import DataLoader
import logging

logger = logging.getLogger(__name__)

class ExtractionStep(PipelineStepHandler):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        db_config = config.get('database')
        query = config.get('query')
        if not db_config or not query:
            raise ValueError("Extraction step requires 'database' config and 'query'")
        
        connector = DataLoader.get_connector(db_config['type'], db_config)
        df = connector.fetch_data(query)
        connector.close()
        
        context['data'] = df
        logger.info(f"Extracted {len(df)} rows.")
