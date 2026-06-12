from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.utils import relative_time

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/{username}/posts", response_model=list[schemas.PostOut])
def get_user_posts(username: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    posts = db.query(models.Post).filter(models.Post.author_id == user.id).order_by(models.Post.created_at.desc()).all()
    result = []
    for p in posts:
        liked = any(l.user_id == current_user.id for l in p.likes)
        saved = any(s.user_id == current_user.id for s in p.saves)
        comments = [schemas.CommentOut(id=c.id, user=c.author.username, avatar=c.author.avatar_url, text=c.text, time=relative_time(c.created_at)) for c in p.comments]
        carousel_urls = [img.image_url for img in p.carousel_images]
        if not carousel_urls:
            carousel_urls = [p.image_url]
        result.append(schemas.PostOut(id=p.id, image_url=p.image_url, caption=p.caption, location=p.location, likes=len(p.likes), liked=liked, saved=saved, time=relative_time(p.created_at), author=p.author.username, author_avatar=p.author.avatar_url, comments=comments, carousel_urls=carousel_urls))
    return result


@router.get("/{username}/saved", response_model=list[schemas.PostOut])
def get_saved_posts(username: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.username != username:
        raise HTTPException(status_code=403, detail="Cannot view another user's saved posts")
    saves = db.query(models.PostSave).filter(models.PostSave.user_id == current_user.id).order_by(models.PostSave.created_at.desc()).all()
    result = []
    for sv in saves:
        p = sv.post
        liked = any(l.user_id == current_user.id for l in p.likes)
        comments = [schemas.CommentOut(id=c.id, user=c.author.username, avatar=c.author.avatar_url, text=c.text, time=relative_time(c.created_at)) for c in p.comments]
        carousel_urls = [img.image_url for img in p.carousel_images]
        if not carousel_urls:
            carousel_urls = [p.image_url]
        result.append(schemas.PostOut(id=p.id, image_url=p.image_url, caption=p.caption, location=p.location, likes=len(p.likes), liked=liked, saved=True, time=relative_time(p.created_at), author=p.author.username, author_avatar=p.author.avatar_url, comments=comments, carousel_urls=carousel_urls))
    return result

