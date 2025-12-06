from abc import ABC, abstractmethod
from typing import Dict, Any

class PipelineStepHandler(ABC):
    @abstractmethod
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> None:
        """
        Execute the pipeline step.
        :param context: Shared dictionary for passing data between steps.
        :param config: Configuration for this specific step.
        """
        pass
