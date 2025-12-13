import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def plot_anomalies_timeseries(df, timestamp_col, value_col, prediction_col='prediction', save_path='anomaly_plot.png'):
    """
    Plots a time series with anomalies highlighted.
    
    Args:
        df: DataFrame containing data.
        timestamp_col: Name of column with dates (will be sorted).
        value_col: Main metric to visualize (e.g., 'aqi').
        prediction_col: Column with anomaly labels (-1 for anomaly, 1 for normal).
    """
    plt.figure(figsize=(12, 6))
    df_sorted = df.sort_values(timestamp_col)
    
    # Plot standard line
    sns.lineplot(data=df_sorted, x=timestamp_col, y=value_col, label='Normal', color='blue', alpha=0.6)
    
    # Highlight anomalies
    anomalies = df_sorted[df_sorted[prediction_col] == -1]
    if not anomalies.empty:
        plt.scatter(anomalies[timestamp_col], anomalies[value_col], color='red', label='Anomaly', s=50, zorder=5)
    
    plt.title(f"Anomaly Detection: {value_col} over Time")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path)
    print(f"Anomaly plot saved to {save_path}")
    plt.close()

def plot_forecast(df, timestamp_col, value_col, prediction_col='prediction', save_path='forecast_plot.png'):
    """
    Plots historical values vs forecasted values.
    """
    plt.figure(figsize=(12, 6))
    
    # Sort
    df_sorted = df.sort_values(timestamp_col)
    
    # Differentiate history vs future/prediction using simple logic or overlapping lines
    # Assumes 'prediction' column is populated for all or subset
    
    # Plot Actuals (if available, e.g. for test set)
    if value_col in df_sorted.columns:
        plt.plot(df_sorted[timestamp_col], df_sorted[value_col], label='Actual', color='black', alpha=0.5)
        
    # Plot Predictions
    plt.plot(df_sorted[timestamp_col], df_sorted[prediction_col], label='Forecast', color='green', linestyle='--')
    
    plt.title(f"Forecasting: {value_col}")
    plt.xlabel("Date")
    plt.ylabel(value_col)
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(save_path)
    print(f"Forecast plot saved to {save_path}")
    plt.close()

def plot_clusters_2d(df, feature_cols, cluster_col='prediction', save_path='cluster_plot.png'):
    """
    Plots clusters in 2D using PCA if >2 features, or direct scatter if 2 features.
    """
    from sklearn.decomposition import PCA
    
    plt.figure(figsize=(10, 8))
    
    plot_df = df.copy()
    
    if len(feature_cols) > 2:
        pca = PCA(n_components=2)
        components = pca.fit_transform(plot_df[feature_cols])
        plot_df['pca_1'] = components[:, 0]
        plot_df['pca_2'] = components[:, 1]
        x_col, y_col = 'pca_1', 'pca_2'
        title_suffix = "(PCA Reduced)"
    elif len(feature_cols) == 2:
        x_col, y_col = feature_cols[0], feature_cols[1]
        title_suffix = ""
    else:
        print("Need at least 2 features to plot clusters.")
        return

    sns.scatterplot(data=plot_df, x=x_col, y=y_col, hue=cluster_col, palette='viridis', style=cluster_col, s=100)
    plt.title(f"Cluster Visualization {title_suffix}")
    plt.tight_layout()
    plt.savefig(save_path)
    print(f"Cluster plot saved to {save_path}")
    plt.close()
