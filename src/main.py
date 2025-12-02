import argparse
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.models.train import train
from src.monitoring.drift import check_drift
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def main(config_path):
    logger.info("Starting automated retraining pipeline...")
    
    # 1. Check for data drift (Optional gate)
    # In a real scenario, we might only retrain if drift is detected or if new data is available.
    # For this script, we'll just log it.
    drift_detected = check_drift(config_path)
    if drift_detected:
        logger.warning("Data drift detected! Proceeding with retraining.")
    else:
        logger.info("No significant drift detected. Retraining anyway for demo purposes.")

    # 2. Run Training
    try:
        train(config_path)
        logger.info("Retraining pipeline completed successfully.")
    except Exception as e:
        logger.error(f"Retraining pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/config.yaml", help="Path to config file")
    args = parser.parse_args()
    
    main(args.config)
