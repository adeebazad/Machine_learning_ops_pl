from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

class ModelFactory:
    """
    Factory class to create Scikit-learn models based on task type and model name.
    """
    
    @staticmethod
    def get_available_models():
        return {
            "classification": {
                "RandomForestClassifier": RandomForestClassifier,
                "LogisticRegression": LogisticRegression,
                "SVC": SVC,
                "DecisionTreeClassifier": DecisionTreeClassifier
            },
            "regression": {
                "RandomForestRegressor": RandomForestRegressor,
                "LinearRegression": LinearRegression,
                "SVR": SVR,
                "DecisionTreeRegressor": DecisionTreeRegressor
            }
        }

    @staticmethod
    def get_model(task_type: str, model_name: str, params: dict = None):
        """
        Returns an instantiated model based on task type and model name.
        
        Args:
            task_type (str): 'classification' or 'regression'
            model_name (str): Name of the model (e.g., 'RandomForestClassifier')
            params (dict): Dictionary of hyperparameters
            
        Returns:
            model: Scikit-learn estimator
        """
        if params is None:
            params = {}
            
        models = ModelFactory.get_available_models()
        
        task_type = task_type.lower()
        if task_type not in models:
            raise ValueError(f"Unsupported task type: {task_type}. Choose 'classification' or 'regression'.")
            
        if model_name not in models[task_type]:
            raise ValueError(f"Unsupported model '{model_name}' for task '{task_type}'. Available: {list(models[task_type].keys())}")
            
        model_class = models[task_type][model_name]
        
        # Filter params to only include valid arguments for the model constructor
        import inspect
        sig = inspect.signature(model_class.__init__)
        valid_params = {k: v for k, v in params.items() if k in sig.parameters}
        
        if len(valid_params) < len(params):
            ignored = set(params.keys()) - set(valid_params.keys())
            print(f"Warning: Ignored invalid parameters for {model_name}: {ignored}")
            
        try:
            return model_class(**valid_params)
        except TypeError as e:
            raise ValueError(f"Invalid parameters for {model_name}: {e}")
