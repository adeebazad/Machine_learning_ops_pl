# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (needed for some DB drivers)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Set environment variables
ENV PYTHONPATH=/app

# Make the scripts executable
RUN chmod +x scripts/init_dvc.bat

# Define environment variable for config
ENV CONFIG_PATH=config/config.yaml

# Run the training script by default, or override with CMD
ENTRYPOINT ["python", "src/main.py"]
