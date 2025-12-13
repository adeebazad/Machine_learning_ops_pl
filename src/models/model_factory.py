from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor, 
    ExtraTreesClassifier, GradientBoostingClassifier
)
from sklearn.linear_model import (
    LogisticRegression, LinearRegression, 
    Ridge, Lasso, ElasticNet
)
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.cluster import (
    KMeans, DBSCAN, OPTICS, MeanShift, 
    AgglomerativeClustering, Birch
)
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import PCA, LatentDirichletAllocation
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor

# Try importing external libraries
try:
    from xgboost import XGBClassifier, XGBRegressor
except ImportError:
    XGBClassifier = XGBRegressor = None

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
except ImportError:
    LGBMClassifier = LGBMRegressor = None

try:
    from catboost import CatBoostClassifier, CatBoostRegressor
except ImportError:
    CatBoostClassifier = CatBoostRegressor = None

# Import Wrappers
from src.models.wrappers import ProphetWrapper, DLWrapper, ArimaWrapper
from src.models.rules import SimpleRuleClassifier

class ModelFactory:
    """
    Factory class to create Scikit-learn models based on task type and model name.
    """
    
    @staticmethod
    def get_available_models():
        models = {
            "classification": {
                "LogisticRegression": LogisticRegression,
                "KNeighborsClassifier": KNeighborsClassifier,
                "DecisionTreeClassifier": DecisionTreeClassifier,
                "RandomForestClassifier": RandomForestClassifier,
                "ExtraTreesClassifier": ExtraTreesClassifier,
                "GradientBoostingClassifier": GradientBoostingClassifier,
                "NaiveBayes": GaussianNB,
                "SVC": SVC,
                "MLPClassifier": MLPClassifier,
                "SimpleRuleClassifier": SimpleRuleClassifier,
            },
            "regression": {
                "LinearRegression": LinearRegression,
                "Ridge": Ridge,
                "Lasso": Lasso,
                "ElasticNet": ElasticNet,
                "DecisionTreeRegressor": DecisionTreeRegressor,
                "RandomForestRegressor": RandomForestRegressor,
                "KNeighborsRegressor": KNeighborsRegressor,
                "SVR": SVR,
                "MLPRegressor": MLPRegressor,
            },
            "clustering": {
                "KMeans": KMeans,
                "DBSCAN": DBSCAN,
                "OPTICS": OPTICS,
                "MeanShift": MeanShift,
                "AgglomerativeClustering": AgglomerativeClustering,
                "GaussianMixture": GaussianMixture,
                "Birch": Birch
            },
            "dimensionality_reduction": {
                "PCA": PCA,
                "LDA": LatentDirichletAllocation
            },
            "anomaly_detection": {
                "IsolationForest": IsolationForest,
                "OneClassSVM": OneClassSVM,
                "LocalOutlierFactor": LocalOutlierFactor
            },
            "time_series": {
                "Prophet": ProphetWrapper,
                "ARIMA": ArimaWrapper,
                "SARIMA": ArimaWrapper # Wrapper handles both
            },
            "deep_learning": {
                "DNN (MLP)": DLWrapper,
                "LSTM": DLWrapper,
                "CNN": DLWrapper
            }
        }

        # Add optional dependencies if available
        if XGBClassifier:
            models["classification"]["XGBClassifier"] = XGBClassifier
            models["regression"]["XGBRegressor"] = XGBRegressor
        
        if LGBMClassifier:
            models["classification"]["LGBMClassifier"] = LGBMClassifier
            models["regression"]["LGBMRegressor"] = LGBMRegressor

        if CatBoostClassifier:
            models["classification"]["CatBoostClassifier"] = CatBoostClassifier
            models["regression"]["CatBoostRegressor"] = CatBoostRegressor

        return models

    @staticmethod
    def get_model(task_type: str, model_name: str, params: dict = None):
        """
        Returns an instantiated model based on task type and model name.
        """
        if params is None:
            params = {}
            
        models = ModelFactory.get_available_models()
        
        # Normalize task type
        task_type = task_type.lower().replace(" ", "_")
        
        # Handle some aliases
        if task_type == "unsupervised":
             # Could be clustering or dim reduction, but let's assume clustering for now if generic
             if model_name in models.get("clustering", {}):
                 task_type = "clustering"
             elif model_name in models.get("dimensionality_reduction", {}):
                 task_type = "dimensionality_reduction"

        if task_type not in models:
            raise ValueError(f"Unsupported task type: {task_type}.")
            
        if model_name not in models[task_type]:
            raise ValueError(f"Unsupported model '{model_name}' for task '{task_type}'. Available: {list(models[task_type].keys())}")
            
        model_class = models[task_type][model_name]
        
        # Special handling for wrappers that might need specific init params
        if model_class == DLWrapper:
            # Pass model_type to wrapper (e.g., 'lstm', 'cnn')
            # Map display name to internal type
            dl_type_map = {"DNN (MLP)": "mlp", "LSTM": "lstm", "CNN": "cnn"}
            params['model_type'] = dl_type_map.get(model_name, 'mlp')
            return model_class(**params)
            
        # Filter params to only include valid arguments for the model constructor
        import inspect
        try:
            sig = inspect.signature(model_class.__init__)
            # Allow **kwargs if present
            has_kwargs = any(p.kind == p.VAR_KEYWORD for p in sig.parameters.values())
            
            if has_kwargs:
                valid_params = params
            else:
                valid_params = {k: v for k, v in params.items() if k in sig.parameters}
                if len(valid_params) < len(params):
                    ignored = set(params.keys()) - set(valid_params.keys())
                    print(f"Warning: Ignored invalid parameters for {model_name}: {ignored}")
        except ValueError:
            # Some wrappers or C-extensions might not support signature inspection
            valid_params = params

        try:
            return model_class(**valid_params)
        except TypeError as e:
            raise ValueError(f"Invalid parameters for {model_name}: {e}")
