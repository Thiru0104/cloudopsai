import redis.asyncio as redis
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Redis client
redis_client: Optional[redis.Redis] = None


async def init_redis():
    """Initialize Redis connection"""
    global redis_client
    try:
        redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )
        
        # Test connection
        await redis_client.ping()
        logger.info("Redis connection established successfully")
        
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        raise


async def get_redis() -> redis.Redis:
    """Get Redis client instance"""
    if redis_client is None:
        await init_redis()
    return redis_client


async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed")


# Cache utilities
async def cache_get(key: str) -> Optional[str]:
    """Get value from cache"""
    try:
        client = await get_redis()
        return await client.get(key)
    except Exception as e:
        logger.error(f"Cache get error: {e}")
        return None


async def cache_set(key: str, value: str, expire: int = 3600) -> bool:
    """Set value in cache with expiration"""
    try:
        client = await get_redis()
        await client.setex(key, expire, value)
        return True
    except Exception as e:
        logger.error(f"Cache set error: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Delete value from cache"""
    try:
        client = await get_redis()
        await client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Cache delete error: {e}")
        return False


# Pub/Sub utilities
async def publish_message(channel: str, message: str) -> bool:
    """Publish message to Redis channel"""
    try:
        client = await get_redis()
        await client.publish(channel, message)
        return True
    except Exception as e:
        logger.error(f"Publish error: {e}")
        return False


async def subscribe_to_channel(channel: str):
    """Subscribe to Redis channel"""
    try:
        client = await get_redis()
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        return pubsub
    except Exception as e:
        logger.error(f"Subscribe error: {e}")
        return None
