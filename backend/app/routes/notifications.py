from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import get_current_user
from app.utils import relative_time

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"]
)

@router.get("/")
def get_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )

    serialized = []
    for n in notifications:
        serialized.append({
            "id": n.id,
            "user_id": n.user_id,
            "actor_id": n.actor_id,
            "actor_username": n.actor.username if n.actor else "Someone",
            "actor_avatar": n.actor.avatar_url if n.actor else None,
            "type": n.type,
            "post_id": n.post_id,
            "post_image_url": n.post.image_url if n.post else None,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
            "time": relative_time(n.created_at)
        })

    return serialized

@router.post("/read")
def mark_all_as_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "ok"}