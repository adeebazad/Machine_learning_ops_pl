# User Guide: Pattern Recognition & Analytics

This guide explains how to configure the MLOps pipeline to achieve different pattern recognition goals on your environmental sensor data.

| Goal | Pattern Type | Recommended Pipeline Config |
| :--- | :--- | :--- |
| **Real-time alerts** | Rule-based | Model: `SimpleRuleClassifier` |
| **Real-time alerts** | Anomaly | Model: `IsolationForest` or `OneClassSVM` |
| **Root cause** | Correlation | *Automatic* (View `correlation_matrix.csv` artifact) |
| **Root cause** | Clustering | Model: `KMeans` or `DBSCAN` (No Target) |
| **Forecasting** | Time-series | Model: `Prophet` (Target: Pollutant, Horizon: `1h,24h`) |
| **Smart city** | Classification | Model: `RandomForestClassifier` (Target: `AQI_Level`) |
| **Reliability** | Anomaly | Model: `LocalOutlierFactor` |

## 1. Real-time Alerts (Rule-Based)
Use this when you have specific thresholds for alerts (e.g., "PM10 > 100").
**Configuration:**
```json
{
  "target_col": "Alert (Optional/Dummy)", 
  "model": {
    "task_type": "classification", 
    "name": "SimpleRuleClassifier",
    "params": {
        "rules": {
            "PM10": {">": 100, "label": 1},
            "CO2": {">": 1000, "label": 1}
        }
    }
  }
}
```

## 2. Root Cause Analysis
### Correlation
Correlations between all numerical features are **automatically calculated** during preprocessing.
- **View Results**: Check the `correlation_matrix.csv` logic in your MLflow run artifacts.

### Clustering (Grouping)
Find hidden groups in data (e.g., "High Traffic vs. Industrial Pollution").
**Configuration:**
```json
{
  "target_col": null,  // IMPORTANT: Leave empty!
  "model": {
    "task_type": "clustering",
    "name": "KMeans",
    "params": {
        "n_clusters": 3,
        "random_state": 42
    }
  }
}
```

## 3. Forecasting
Predict future values based on history.
**Configuration:**
```json
{
  "target_col": "PM2.5",
  "forecasting": {
      "horizons": ["1h", "24h"],
      "timestamp_col": "TimeInstant"
  },
  "model": {
    "task_type": "time_series",
    "name": "Prophet"
  }
}
```

## 4. Reliability (Sensor Integrity)
Detect sensors behaving strangely (spikes, flatlines) using Anomaly Detection.
**Configuration:**
```json
{
  "target_col": null,
  "model": {
    "task_type": "anomaly_detection",
    "name": "IsolationForest",
    "params": {
        "contamination": 0.05
    }
  }
}
```
