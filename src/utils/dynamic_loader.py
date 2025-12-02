import importlib.util
import os
import sys

def load_class_from_file(file_path: str, class_name: str):
    """
    Dynamically loads a class from a Python file.

    Args:
        file_path (str): Path to the .py file.
        class_name (str): Name of the class to load.

    Returns:
        type: The loaded class.
    
    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the class is not found in the file.
        ImportError: If the module cannot be loaded.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Get module name from file name
    module_name = os.path.splitext(os.path.basename(file_path))[0]
    
    try:
        # Force reload if already loaded to pick up changes
        if module_name in sys.modules:
            del sys.modules[module_name]

        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None or spec.loader is None:
             raise ImportError(f"Could not load spec for module: {module_name}")
             
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        
        if not hasattr(module, class_name):
            raise ValueError(f"Class '{class_name}' not found in {file_path}")
            
        return getattr(module, class_name)
        
    except Exception as e:
        raise ImportError(f"Failed to load class '{class_name}' from '{file_path}': {e}")
