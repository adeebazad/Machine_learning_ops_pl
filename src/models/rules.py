from sklearn.base import BaseEstimator, ClassifierMixin
import pandas as pd
import numpy as np
from typing import Dict, Any, Union

class SimpleRuleClassifier(BaseEstimator, ClassifierMixin):
    """
    A simple rule-based classifier that predicts classes based on feature thresholds.
    
    Parameters:
    - rules: Dict of rules. Format:
        {
            "FeatureName": {
                "operator": ">", # >, <, >=, <=, ==
                "value": 50.0,
                "label": 1 # Label to assign if rule matches
            }
        }
    - default_label: Label to assign if no rules match (default: 0)
    
        Example:
        rules = {
            "PM10": {">": 100, "label": 1},
            "Temperature": {"<": 0, "label": 1}
        }
        Any row where PM10 > 100 OR Temperature < 0 will be labeled 1.
    """
    def __init__(self, rules: Dict[str, Any] = None, default_label: int = 0):
        self.rules = rules or {}
        self.default_label = default_label

    def fit(self, X, y=None):
        # Rule-based model doesn't "learn" from data, so fit is a no-op
        return self

    def predict(self, X):
        # Convert to DataFrame if needed for column access
        if not isinstance(X, pd.DataFrame):
             # Attempt to convert or raise error? 
             # For simplicity assuming DataFrame as our pipeline uses it.
             # If numpy array, we can't apply column-based rules easily without names.
             raise ValueError("SimpleRuleClassifier requires input X to be a pandas DataFrame with column names.")
        
        # Initialize with default label
        y_pred = np.full(X.shape[0], self.default_label)
        
        # Apply rules
        # Rules form a logical OR for the 'positive' class (custom label)
        # If we want detailed logic, we'd need a complex expression parser.
        # Implemented logic: If ANY rule triggers, assign its label.
        # Priority: last rule wins if overlaps (simplified).
        
        for feature, condition in self.rules.items():
            if feature not in X.columns:
                continue
                
            col_data = X[feature]
            
            # Allow shorthand: {"PM10": {">": 50}} -> assumes label 1
            # Or explicit: {"PM10": {">": 50, "label": 2}}
            
            # Normalize condition structure
            # Case 1: condition is a dict of operators
            if isinstance(condition, dict):
                msg_label = condition.get('label', 1)
                
                for op, val in condition.items():
                    if op == 'label': continue
                    
                    if op == '>':
                        mask = col_data > val
                    elif op == '>=':
                        mask = col_data >= val
                    elif op == '<':
                        mask = col_data < val
                    elif op == '<=':
                         mask = col_data <= val
                    elif op == '==':
                         mask = col_data == val
                    else:
                        continue
                        
                    y_pred[mask] = msg_label
                    
        return y_pred
