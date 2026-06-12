import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.utils import relative_time

router = APIRouter(prefix="/posts", tags=["posts"])

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE_MB = 10


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """Upload an image file and return its public URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF and WebP images are allowed")

    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_SIZE_MB} MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with open(os.path.join(UPLOADS_DIR, filename), "wb") as f:
        f.write(data)

    return {"url": f"http://127.0.0.1:8000/uploads/{filename}"}


def _serialize_post(post: models.Post, current_user: models.User) -> schemas.PostOut:
    liked = any(l.user_id == current_user.id for l in post.likes)
    saved = any(s.user_id == current_user.id for s in post.saves)
    comments = [
        schemas.CommentOut(
            id=c.id,
            user=c.author.username,
            avatar=c.author.avatar_url,
            text=c.text,
            time=relative_time(c.created_at),
        )
        for c in post.comments
    ]
    carousel_urls = [img.image_url for img in post.carousel_images]
    if not carousel_urls:
        carousel_urls = [post.image_url]
    return schemas.PostOut(
        id=post.id,
        image_url=post.image_url,
        caption=post.caption,
        location=post.location,
        likes=len(post.likes),
        liked=liked,
        saved=saved,
        time=relative_time(post.created_at),
        author=post.author.username,
        author_avatar=post.author.avatar_url,
        comments=comments,
        carousel_urls=carousel_urls,
    )


@router.get("/feed", response_model=list[schemas.PostOut])
def get_feed(skip: int = 0, limit: int = 20, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    following_ids = {f.followed_id for f in current_user.following}
    following_ids.add(current_user.id)
    posts = db.query(models.Post).filter(models.Post.author_id.in_(following_ids)).order_by(models.Post.created_at.desc()).offset(skip).limit(limit).all()
    return [_serialize_post(p, current_user) for p in posts]


@router.post("", response_model=schemas.PostOut, status_code=status.HTTP_201_CREATED)
def create_post(body: schemas.PostCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    main_url = body.image_url
    if body.carousel_urls:
        main_url = body.carousel_urls[0]
    post = models.Post(author_id=current_user.id, image_url=main_url, caption=body.caption, location=body.location)
    db.add(post)
    db.commit()
    db.refresh(post)
    if body.carousel_urls:
        for idx, url in enumerate(body.carousel_urls):
            db.add(models.PostImage(post_id=post.id, image_url=url, position=idx))
        db.commit()
        db.refresh(post)
    return _serialize_post(post, current_user)


@router.get("/{post_id}", response_model=schemas.PostOut)
def get_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize_post(post, current_user)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(post)
    db.commit()


@router.post("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db.query(models.PostLike).filter_by(user_id=current_user.id, post_id=post_id).first():
        raise HTTPException(status_code=400, detail="Already liked")
    db.add(models.PostLike(user_id=current_user.id, post_id=post_id))
    if post.author_id != current_user.id:
        db.add(
            models.Notification(
                user_id=post.author_id,
                actor_id=current_user.id,
                type="like",
                post_id=post.id,
            )
        )
    db.commit()


@router.delete("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    like = db.query(models.PostLike).filter_by(user_id=current_user.id, post_id=post_id).first()
    if not like:
        raise HTTPException(status_code=400, detail="Not liked")
    db.delete(like)
    db.commit()


@router.post("/{post_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def save_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db.query(models.PostSave).filter_by(user_id=current_user.id, post_id=post_id).first():
        raise HTTPException(status_code=400, detail="Already saved")
    db.add(models.PostSave(user_id=current_user.id, post_id=post_id))
    db.add(
        models.Notification(
            user_id=post.author_id,
            actor_id=current_user.id,
            type="save",
            post_id=post.id,
        )
    )
    db.commit()


@router.delete("/{post_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    save = db.query(models.PostSave).filter_by(user_id=current_user.id, post_id=post_id).first()
    if not save:
        raise HTTPException(status_code=400, detail="Not saved")
    db.delete(save)
    db.commit()


@router.get("/{post_id}/comments", response_model=list[schemas.CommentOut])
def get_comments(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return [schemas.CommentOut(id=c.id, user=c.author.username, avatar=c.author.avatar_url, text=c.text, time=relative_time(c.created_at)) for c in post.comments]


@router.post("/{post_id}/comments", response_model=schemas.CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(post_id: int, body: schemas.CommentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = models.Comment(post_id=post_id, author_id=current_user.id, text=body.text.strip())
    db.add(comment)
    if post.author_id != current_user.id:
      db.add(
        models.Notification(
            user_id=post.author_id,
            actor_id=current_user.id,
            type="comment",
            post_id=post.id,
        )
    )

    db.commit()
    db.refresh(comment)
    return schemas.CommentOut(id=comment.id, user=current_user.username, avatar=current_user.avatar_url, text=comment.text, time="just now")



@router.delete("/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(post_id: int, comment_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.get(models.Comment, comment_id)
    if not comment or comment.post_id != post_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    db.delete(comment)
    db.commit()
