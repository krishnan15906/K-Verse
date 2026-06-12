from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("", response_model=list[schemas.StoryOut])
def get_stories(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    following_ids = {f.followed_id for f in current_user.following}
    following_ids.add(current_user.id)
    now = datetime.now(timezone.utc)
    stories = db.query(models.Story).filter(models.Story.author_id.in_(following_ids), models.Story.expires_at > now).order_by((models.Story.author_id == current_user.id).desc(), models.Story.created_at.desc()).all()
    seen: set[int] = set()
    result: list[schemas.StoryOut] = []
    for s in stories:
        if s.author_id not in seen:
            seen.add(s.author_id)
            liked = any(l.user_id == current_user.id for l in s.likes)
            result.append(schemas.StoryOut(
                id=s.id,
                user="Your story" if s.author_id == current_user.id else s.author.username,
                avatar=s.author.avatar_url,
                media_url=s.media_url,
                liked=liked,
                views_count=len(s.views),
                likes_count=len(s.likes)
            ))
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def create_story(media_url: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    story = models.Story(author_id=current_user.id, media_url=media_url, expires_at=expires_at)
    db.add(story)
    db.commit()
    db.refresh(story)
    return {"id": story.id, "expires_at": story.expires_at.isoformat()}


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your story")
    db.delete(story)
    db.commit()


@router.post("/{story_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def view_story(story_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    existing = db.query(models.StoryView).filter_by(story_id=story_id, user_id=current_user.id).first()
    if not existing:
        db.add(models.StoryView(story_id=story_id, user_id=current_user.id))
        db.commit()


@router.post("/{story_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_story(story_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    existing = db.query(models.StoryLike).filter_by(story_id=story_id, user_id=current_user.id).first()
    if not existing:
        db.add(models.StoryLike(story_id=story_id, user_id=current_user.id))
        db.commit()


@router.delete("/{story_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_story(story_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    existing = db.query(models.StoryLike).filter_by(story_id=story_id, user_id=current_user.id).first()
    if existing:
        db.delete(existing)
        db.commit()


@router.get("/{story_id}/viewers", response_model=list[schemas.StoryViewerOut])
def get_story_viewers(story_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    story = db.get(models.Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your story")
    viewers = db.query(models.StoryView).filter_by(story_id=story_id).all()
    liked_user_ids = {l.user_id for l in story.likes}
    return [
        schemas.StoryViewerOut(
            username=v.user.username,
            avatar_url=v.user.avatar_url,
            liked=v.user_id in liked_user_ids
        )
        for v in viewers
    ]

