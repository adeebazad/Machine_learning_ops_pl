import logging
import sys
import os

def setup_logger(name=__name__, log_level=logging.INFO):
    """
    Sets up a logger with the specified name and log level.
    """
    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    # Prevent adding multiple handlers to the same logger
    if not logger.handlers:
        # Create console handler
        c_handler = logging.StreamHandler(sys.stdout)
        c_handler.setLevel(log_level)

        # Create file handler
        log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        f_handler = logging.FileHandler(os.path.join(log_dir, 'app.log'))
        f_handler.setLevel(log_level)

        # Create formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        c_handler.setFormatter(formatter)
        f_handler.setFormatter(formatter)

        # Add handlers to logger
        logger.addHandler(c_handler)
        logger.addHandler(f_handler)

    return logger
