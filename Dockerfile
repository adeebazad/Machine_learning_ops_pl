# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libgomp1 \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV CONFIG_PATH=config/config.yaml

# Expose port
EXPOSE 8000

# Run the API
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
