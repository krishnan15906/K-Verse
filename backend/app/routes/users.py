import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import get_current_user, hash_password

router = APIRouter(prefix="/users", tags=["users"])

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE_MB = 5


def _build_profile(user: models.User, current_user: models.User) -> schemas.UserProfile:
    return schemas.UserProfile(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        website=user.website,
        posts_count=len(user.posts),
        followers_count=len(user.followers),
        following_count=len(user.following),
    )


# ---------------------------------------------------------------------------
# Static routes MUST come before /{param} routes
# ---------------------------------------------------------------------------

@router.get("/me", response_model=schemas.UserProfile)
def get_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_profile(current_user, current_user)


@router.patch("/me", response_model=schemas.UserProfile)
def update_me(
    body: schemas.UserUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)

    if "username" in data:
        new_username = data.pop("username")
        if new_username:
            if new_username != current_user.username:
                existing = db.query(models.User).filter(models.User.username == new_username).first()
                if existing:
                    raise HTTPException(status_code=400, detail="Username already taken")
                current_user.username = new_username

    if "password" in data:
        plain = data.pop("password")
        if plain:
            current_user.hashed_password = hash_password(plain)

    for field, value in data.items():
        setattr(current_user, field, value if value != "" else None)

    db.commit()
    db.refresh(current_user)
    return _build_profile(current_user, current_user)


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a profile picture from device and save it as the user's avatar."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF and WebP images are allowed")

    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_SIZE_MB} MB)")

    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with open(os.path.join(UPLOADS_DIR, filename), "wb") as f:
        f.write(data)

    url = f"http://127.0.0.1:8000/uploads/{filename}"
    current_user.avatar_url = url
    db.commit()
    db.refresh(current_user)
    return {"url": url, "profile": _build_profile(current_user, current_user)}


@router.get("/search", response_model=list[schemas.SuggestionOut])
def search_users(
    q: str = "",
    limit: int = 10,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = q.strip()
    if not q:
        return []
    results = (
        db.query(models.User)
        .filter(models.User.username.ilike(f"%{q}%"))
        .limit(limit)
        .all()
    )
    return [
        schemas.SuggestionOut(id=u.id, user=u.username, avatar=u.avatar_url, note=u.full_name or "")
        for u in results
    ]


@router.get("/suggestions/list", response_model=list[schemas.SuggestionOut])
def get_suggestions(
    limit: int = 5,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    already_following_ids = {f.followed_id for f in current_user.following}
    already_following_ids.add(current_user.id)

    candidates = (
        db.query(models.User)
        .filter(models.User.id.notin_(already_following_ids))
        .limit(limit)
        .all()
    )

    results = []
    for u in candidates:
        mutual = db.query(models.Follow).filter(
            models.Follow.follower_id.in_(already_following_ids - {current_user.id}),
            models.Follow.followed_id == u.id,
        ).first()
        note = f"Followed by {mutual.follower.username}" if mutual else "Suggested for you"
        results.append(schemas.SuggestionOut(id=u.id, user=u.username, avatar=u.avatar_url, note=note))
    return results


# ---------------------------------------------------------------------------
# Parameterised routes — two-segment paths before one-segment
# ---------------------------------------------------------------------------

@router.get("/{username}/is-following")
def is_following(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    exists = db.query(models.Follow).filter_by(
        follower_id=current_user.id, followed_id=target.id
    ).first()
    return {"following": exists is not None}


@router.post("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_user(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = db.query(models.Follow).filter_by(follower_id=current_user.id, followed_id=target.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already following")

    db.add(models.Follow(follower_id=current_user.id, followed_id=target.id))
    db.add(
    models.Notification(
        user_id=target.id,          # receiver
        actor_id=current_user.id,   # who followed
        type="follow",
        post_id=None,
    )
)
    db.commit()


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    follow = db.query(models.Follow).filter_by(follower_id=current_user.id, followed_id=target.id).first()
    if not follow:
        raise HTTPException(status_code=400, detail="Not following")

    db.delete(follow)
    db.commit()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's account")
    db.delete(current_user)
    db.commit()


@router.get("/{username}", response_model=schemas.UserProfile)
def get_user(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_profile(user, current_user)

@router.get("/{username}/followers", response_model=list[schemas.UserBase])
def get_followers(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return [f.follower for f in user.followers]

@router.get("/{username}/following", response_model=list[schemas.UserBase])
def get_following(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return [f.followed for f in user.following]
