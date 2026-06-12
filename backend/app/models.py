"""
SQLAlchemy ORM models — tables mirror what the UI uses:
  users, follows, posts, post_likes, post_saves, comments, comment_likes, stories
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    # relationships
    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    stories: Mapped[list["Story"]] = relationship("Story", back_populates="author", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="author", cascade="all, delete-orphan")

    # follows: users this user is following
    following: Mapped[list["Follow"]] = relationship(
        "Follow", foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan"
    )
    # follows: users following this user
    followers: Mapped[list["Follow"]] = relationship(
        "Follow", foreign_keys="Follow.followed_id", back_populates="followed", cascade="all, delete-orphan"
    )

    post_likes: Mapped[list["PostLike"]] = relationship("PostLike", back_populates="user", cascade="all, delete-orphan")
    post_saves: Mapped[list["PostSave"]] = relationship("PostSave", back_populates="user", cascade="all, delete-orphan")

    # notification sent and recived
    notifications: Mapped[list["Notification"]] = relationship("Notification",foreign_keys="Notification.user_id",back_populates="user",cascade="all, delete-orphan",)

    sent_notifications: Mapped[list["Notification"]] = relationship("Notification",foreign_keys="Notification.actor_id",back_populates="actor",cascade="all, delete-orphan",)


# ---------------------------------------------------------------------------
# Follows
# ---------------------------------------------------------------------------
class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_id", "followed_id", name="uq_follow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    follower_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    followed_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    follower: Mapped["User"] = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed: Mapped["User"] = relationship("User", foreign_keys=[followed_id], back_populates="followers")


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------
class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    author: Mapped["User"] = relationship("User", back_populates="posts")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes: Mapped[list["PostLike"]] = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    saves: Mapped[list["PostSave"]] = relationship("PostSave", back_populates="post", cascade="all, delete-orphan")
    carousel_images: Mapped[list["PostImage"]] = relationship("PostImage", back_populates="post", cascade="all, delete-orphan", order_by="PostImage.position")


# ---------------------------------------------------------------------------
# Post Images (Carousel)
# ---------------------------------------------------------------------------
class PostImage(Base):
    __tablename__ = "post_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    post: Mapped["Post"] = relationship("Post", back_populates="carousel_images")



# ---------------------------------------------------------------------------
# Post likes  (heart button)
# ---------------------------------------------------------------------------
class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_post_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="post_likes")
    post: Mapped["Post"] = relationship("Post", back_populates="likes")


# ---------------------------------------------------------------------------
# Post saves / bookmarks
# ---------------------------------------------------------------------------
class PostSave(Base):
    __tablename__ = "post_saves"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_post_save"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="post_saves")
    post: Mapped["Post"] = relationship("Post", back_populates="saves")


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    post: Mapped["Post"] = relationship("Post", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")
    likes: Mapped[list["CommentLike"]] = relationship("CommentLike", back_populates="comment", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Comment likes
# ---------------------------------------------------------------------------
class CommentLike(Base):
    __tablename__ = "comment_likes"
    __table_args__ = (UniqueConstraint("user_id", "comment_id", name="uq_comment_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id: Mapped[int] = mapped_column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    user: Mapped["User"] = relationship("User")
    comment: Mapped["Comment"] = relationship("Comment", back_populates="likes")


# ---------------------------------------------------------------------------
# Stories
# ---------------------------------------------------------------------------
class Story(Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    media_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # stories expire after 24 h — frontend can filter on expires_at
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    author: Mapped["User"] = relationship("User", back_populates="stories")
    views: Mapped[list["StoryView"]] = relationship("StoryView", back_populates="story", cascade="all, delete-orphan")
    likes: Mapped[list["StoryLike"]] = relationship("StoryLike", back_populates="story", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Story Views
# ---------------------------------------------------------------------------
class StoryView(Base):
    __tablename__ = "story_views"
    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_view"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    story_id: Mapped[int] = mapped_column(Integer, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    story: Mapped["Story"] = relationship("Story", back_populates="views")
    user: Mapped["User"] = relationship("User")


# ---------------------------------------------------------------------------
# Story Likes
# ---------------------------------------------------------------------------
class StoryLike(Base):
    __tablename__ = "story_likes"
    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    story_id: Mapped[int] = mapped_column(Integer, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    story: Mapped["Story"] = relationship("Story", back_populates="likes")
    user: Mapped["User"] = relationship("User")



# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    actor_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    post_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=True
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False
    )
    post: Mapped["Post | None"] = relationship("Post")
    user: Mapped["User"] = relationship(
    "User",
    foreign_keys="Notification.user_id",
    back_populates="notifications"
)

    actor: Mapped["User"] = relationship(
    "User",
    foreign_keys="Notification.actor_id",
    back_populates="sent_notifications"
)