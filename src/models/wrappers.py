import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional
import joblib
import os

# Try imports, handle missing dependencies gracefully
try:
    from prophet import Prophet
except ImportError:
    Prophet = None

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Dense, LSTM, GRU, Conv2D, Flatten, MaxPooling2D, SimpleRNN
except ImportError:
    tf = None
    Sequential = None

try:
    import statsmodels.api as sm
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX
except ImportError:
    sm = None

class ProphetWrapper:
    def __init__(self, **params):
        if Prophet is None:
            raise ImportError("Prophet is not installed.")
        self.model = Prophet(**params)
        self.params = params

    def fit(self, X, y=None):
        # Prophet expects a DataFrame with 'ds' and 'y' columns
        # We assume X is a DataFrame. If y is provided, we merge.
        if isinstance(X, pd.DataFrame):
            df = X.copy()
        else:
            raise ValueError("Prophet requires X to be a pandas DataFrame")
            
        if y is not None:
            if 'y' not in df.columns:
                df['y'] = y
        
        # Ensure 'ds' column exists. If not, try to find a date column or use index
        if 'ds' not in df.columns:
            date_cols = df.select_dtypes(include=['datetime']).columns
            if len(date_cols) > 0:
                df = df.rename(columns={date_cols[0]: 'ds'})
            elif isinstance(df.index, pd.DatetimeIndex):
                df['ds'] = df.index
                df = df.reset_index(drop=False)
            else:
                 raise ValueError("Prophet requires a 'ds' column or DatetimeIndex")

        self.model.fit(df)
        return self

    def predict(self, X):
        # Prophet predict expects a DataFrame with 'ds'
        if isinstance(X, int):
             # If X is an integer, assume it's periods to predict
             future = self.model.make_future_dataframe(periods=X)
             forecast = self.model.predict(future)
             return forecast['yhat'].tail(X).values
        
        if isinstance(X, pd.DataFrame):
             if 'ds' not in X.columns:
                 # Try to infer like in fit
                date_cols = X.select_dtypes(include=['datetime']).columns
                if len(date_cols) > 0:
                    X = X.rename(columns={date_cols[0]: 'ds'})
                elif isinstance(X.index, pd.DatetimeIndex):
                    X['ds'] = X.index
                    X = X.reset_index(drop=False)
        
        forecast = self.model.predict(X)
        return forecast['yhat'].values

class DLWrapper:
    """
    Simple wrapper for Keras/TensorFlow models to make them look like sklearn estimators.
    """
    def __init__(self, model_type='mlp', input_shape=None, **params):
        if tf is None:
            raise ImportError("TensorFlow is not installed.")
        
        self.model_type = model_type
        self.input_shape = input_shape
        self.params = params
        self.model = None
        self.history = None

    def _build_model(self, input_dim):
        model = Sequential()
        
        if self.model_type == 'mlp':
            layers = self.params.get('layers', [64, 32])
            activation = self.params.get('activation', 'relu')
            
            model.add(Dense(layers[0], activation=activation, input_shape=(input_dim,)))
            for units in layers[1:]:
                model.add(Dense(units, activation=activation))
            model.add(Dense(1)) # Regression or Binary Classification (sigmoid)
            
        elif self.model_type == 'lstm':
            # Expects 3D input (samples, timesteps, features)
            # We reshape tabular data to (samples, 1, features)
            units = self.params.get('units', 50)
            model.add(LSTM(units, input_shape=(1, input_dim)))
            model.add(Dense(1))
            
        elif self.model_type == 'cnn':
            # Expects 4D input (samples, height, width, channels)
            # We reshape tabular data to (samples, features, 1, 1)
            filters = self.params.get('filters', 32)
            # Adjust kernel size to be (k, 1) since width is 1
            k = self.params.get('kernel_size', 3)
            if isinstance(k, tuple):
                k = k[0]
            kernel_size = (min(k, input_dim), 1)
            
            model.add(Conv2D(filters, kernel_size, activation='relu', input_shape=(input_dim, 1, 1)))
            model.add(Flatten())
            model.add(Dense(64, activation='relu'))
            model.add(Dense(1)) # Changed to 1 for regression/binary generic

        optimizer = self.params.get('optimizer', 'adam')
        loss = self.params.get('loss', 'mse')
        metrics = self.params.get('metrics', ['mae'])
        
        model.compile(optimizer=optimizer, loss=loss, metrics=metrics)
        return model

    def _reshape_input(self, X):
        if self.model_type == 'lstm':
            # Reshape to (samples, 1, features)
            return X.reshape((X.shape[0], 1, X.shape[1]))
        elif self.model_type == 'cnn':
            # Reshape to (samples, features, 1, 1)
            return X.reshape((X.shape[0], X.shape[1], 1, 1))
        return X

    def fit(self, X, y):
        # Auto-detect input shape
        input_dim = X.shape[1] if len(X.shape) > 1 else 1
        
        if self.model is None:
             self.model = self._build_model(input_dim)

        X_processed = X
        if self.model_type in ['lstm', 'cnn']:
            X_processed = self._reshape_input(X)

        epochs = self.params.get('epochs', 10)
        batch_size = self.params.get('batch_size', 32)
        
        self.history = self.model.fit(X_processed, y, epochs=epochs, batch_size=batch_size, verbose=0)
        return self

    def predict(self, X):
        X_processed = X
        if self.model_type in ['lstm', 'cnn']:
            X_processed = self._reshape_input(X)
            
        return self.model.predict(X_processed)

class ArimaWrapper:
    def __init__(self, order=(1, 1, 1), seasonal_order=None, **params):
        if sm is None:
            raise ImportError("statsmodels is not installed.")
        self.order = order
        self.seasonal_order = seasonal_order
        self.params = params
        self.model_res = None

    def fit(self, X, y=None):
        # ARIMA fits on a single series (endog)
        # If X is DataFrame, take first column or 'y'
        endog = X
        if isinstance(X, pd.DataFrame):
            if 'y' in X.columns:
                endog = X['y']
            else:
                endog = X.iloc[:, 0]
        
        if self.seasonal_order:
            model = SARIMAX(endog, order=self.order, seasonal_order=self.seasonal_order, **self.params)
        else:
            model = ARIMA(endog, order=self.order, **self.params)
            
        self.model_res = model.fit()
        return self

    def predict(self, X):
        # X can be steps to forecast
        steps = 1
        if isinstance(X, int):
            steps = X
        elif isinstance(X, pd.DataFrame):
            steps = len(X)
            
        return self.model_res.forecast(steps=steps).values
