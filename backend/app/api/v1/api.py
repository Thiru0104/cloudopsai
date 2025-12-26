from fastapi import APIRouter
from app.api.v1.endpoints import (
    nsgs,
    agents,
    dashboard,
    subscriptions,
    resource_groups,
    locations,
    system,
    email,
    settings,
    login,
    users,
    route_tables,
    reports,
    backup,
    validation,
    storage
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(login.router, prefix="/login", tags=["Login"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"])
api_router.include_router(resource_groups.router, prefix="/resource-groups", tags=["Resource Groups"])
api_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
api_router.include_router(route_tables.router, prefix="/route-tables", tags=["Route Tables"])
api_router.include_router(nsgs.router, prefix="/nsgs", tags=["Network Security Groups"])
api_router.include_router(agents.router, prefix="/agents", tags=["AI Agents"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(backup.router, prefix="/backup", tags=["Backup"])
api_router.include_router(validation.router, tags=["Validation"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
api_router.include_router(email.router, prefix="/email", tags=["Email"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(storage.router, tags=["Storage"])
