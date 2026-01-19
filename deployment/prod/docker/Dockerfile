# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production Image
FROM python:3.11-slim

# Install Nginx and Supervisor
RUN apt-get update && apt-get install -y nginx supervisor curl && \
    rm -rf /var/lib/apt/lists/*

# Setup App Directory
WORKDIR /app

# Install Python Dependencies
COPY deployment/prod/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY backend/app ./app
COPY backend/create_admin.py .

# Copy Frontend Build
COPY --from=frontend-build /app/dist /app/static

# Copy Configs
COPY deployment/prod/docker/nginx.conf /etc/nginx/nginx.conf
COPY deployment/prod/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Environment Variables
ENV PYTHONPATH=/app
ENV PORT=80

# Expose Port
EXPOSE 80

# Run Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
