# Pearl Service

**PEARL** (Platform for Elastic Agents with contextual Reasoning over Layered modalities) is a specialized microservice for building and deploying AI agents.

## 🏗️ Architecture

Pearl is designed as a modular agent framework.
*   **Core (`src/pearl`)**: The main application logic.
*   **Endpoints (`src/pearl/endpoint`)**: API exposure.
*   **Workers (`src/pearl/worker`)**: Background task processing.

## 🔌 API Endpoints (`src/pearl/endpoint`)

Pearl exposes several key API groups:

*   **`ollama.py`**: Integration with Ollama for LLM inference.
*   **`prompt.py`**: Management of system prompts and agent personas.
*   **`chat_file.py`**: Handling file uploads and processing for RAG (Retrieval Augmented Generation).
*   **`ui.py`**: Endpoints specifically serving the Pearl UI.
*   **`user.py`**: User management and authentication.

## 🤖 Capabilities

### 1. Multi-Modal Agents
Pearl supports agents that can reason over different "modalities" or data layers.

### 2. Contextual Reasoning
The platform maintains context across detailed sessions, allowing for complex, multi-turn interactions.

### 3. Background Processing
Long-running tasks are handled by workers (defined in `src/pearl/worker/sys_tasks.py`), ensuring the API remains responsive.

## 🚀 Running Pearl

Pearl is typically run as part of the Docker composition, but can be started standalone.

```bash
# From the pearl directory
python -m src.pearl.main
```

Configuration is handled via `src/pearl/config.py`.
