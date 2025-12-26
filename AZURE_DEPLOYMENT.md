# Azure Deployment Guide (App Service Web App)

This guide deploys the FastAPI backend as an Azure Web App (Linux) using a Docker container, with production-ready settings and minimal image size.

## Prerequisites
- Azure subscription and `az` CLI logged in (`az login`)
- Resource group (example: `rg-nsg-tool-prod`)
- Azure Container Registry (ACR) or Docker Hub for image hosting
- Optional: Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis, Key Vault

## Container Build and Push

1) Create ACR (optional, skip if using Docker Hub):
- `az acr create -n <acr_name> -g rg-nsg-tool-prod --sku Basic`
- `az acr login -n <acr_name>`

2) Build and push image:
- `docker build -t <registry>/<repo>/nsg-tool-backend:prod -f backend/Dockerfile .`
- `docker push <registry>/<repo>/nsg-tool-backend:prod`

3) Confirm image digest for deployment: `docker inspect <image>`

## Provision App Service (Linux) with Container

- `az appservice plan create -g rg-nsg-tool-prod -n asp-nsg-tool-prod --is-linux --sku B1`
- `az webapp create -g rg-nsg-tool-prod -p asp-nsg-tool-prod -n web-nsg-tool-prod --deployment-container-image-name <registry>/<repo>/nsg-tool-backend:prod`

If using ACR, grant pull permissions:
- `az webapp config container set -g rg-nsg-tool-prod -n web-nsg-tool-prod --docker-custom-image-name <acr_name>.azurecr.io/<repo>/nsg-tool-backend:prod --docker-registry-server-url https://<acr_name>.azurecr.io`
- `az webapp identity assign -g rg-nsg-tool-prod -n web-nsg-tool-prod`
- `az acr update -n <acr_name> --admin-enabled true`
- `az webapp config container set -g rg-nsg-tool-prod -n web-nsg-tool-prod --docker-registry-server-user <acr_admin_user> --docker-registry-server-password <acr_admin_pwd>`

## App Settings (Environment Variables)

Configure in App Service > Configuration:
- `WEBSITES_PORT=8000` (already set in container)
- `APP_ENV=production`
- `SECRET_KEY=<generate>`
- `DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:<port>/<db>` (if using Postgres)
- `REDIS_URL=redis://<host>:<port>` (optional)
- `CORS_ORIGINS=https://<your-frontend-domain>`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` (if applicable)
- Any other settings from `backend/app/core/config.py`

For secrets, prefer Azure Key Vault + Managed Identity:
- Assign system identity to the Web App and grant `get` access to secrets in Key Vault.
- Use a startup script or code to resolve secrets from Key Vault.

## Health Checks and Scaling

- Health path: `/health` (configured in Dockerfile)
- Enable Always On
- Start with `B1` or `P1v3` SKU; scale out by instance count
- Tune `WEB_CONCURRENCY` (gunicorn workers) to match CPU/memory

## Observability

- Enable Application Insights
- Set logging level via `LOG_LEVEL=info`
- Stream logs: `az webapp log tail -n web-nsg-tool-prod -g rg-nsg-tool-prod`

## Networking and Security

- Restrict access via Access Restrictions or Private Endpoints
- Use HTTPS only, enforce TLS 1.2+
- If using databases, configure VNet integration

## Frontend Deployment Options

- Azure Static Web Apps: host `frontend` build (`npm run build`) and configure API proxy to the Web App backend
- Azure Storage Static Website + CDN: serve `frontend/dist` with `index.html` rewrite
- Alternatively, deploy Nginx to serve static `frontend/dist` and reverse-proxy `/api` to FastAPI, but Static Web Apps is simpler

## CI/CD Suggestions

- GitHub Actions or Azure DevOps to build/push Docker image on `main` merges
- Use `az webapp config container set` to update image tag (or deploy by image digest for reproducibility)

## Quick Non-Container Alternative (Oryx Build)

- `az webapp up --runtime PYTHON:3.11 -n web-nsg-tool-prod -g rg-nsg-tool-prod -l <region> --sku B1`
- The platform builds from `backend/requirements.txt` and runs `gunicorn app.main:app` automatically
- Note: container approach gives more control and repeatability

## Post-Deployment Validation

- Hit `https://<webapp-name>.azurewebsites.net/health`
- Test API endpoints: `/api/v1/email/config`, `/api/v1/settings/notifications`
- Confirm CORS and email tests from the Settings page

## Housekeeping

- `.dockerignore` prunes dev artifacts from the image context
- Keep requirements pinned; avoid dev-only packages in production
- Backup `backend/app/storage/*.json` externally if you rely on them; prefer a database for durability
