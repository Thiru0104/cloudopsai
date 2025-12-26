import asyncio
import os
import sys

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.services.azure_service import AzureService

async def main():
    print("Initializing AzureService...")
    try:
        service = AzureService()
        print("Listing subscriptions...")
        subs = await service.list_subscriptions()
        print(f"Found {len(subs)} subscriptions")
        for sub in subs:
            print(f"- {sub['display_name']} ({sub['id']})")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())