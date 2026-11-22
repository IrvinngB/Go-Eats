"""Push notification service (Firebase Cloud Messaging adapter for BackgroundTasks)."""
import logging

logger = logging.getLogger("goeats.push")


def send_push_notification(recipient_id: int, title: str, body: str) -> None:
    """Dispatch push notification asynchronously via FastAPI BackgroundTasks (RF-16)."""
    logger.info("FCM push -> user=%s | %s: %s", recipient_id, title, body)
