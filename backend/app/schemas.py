"""Pydantic schemas — request bodies and response shapes."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("username")
    @classmethod
    def username_alphanum(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v


class LoginRequest(BaseModel):
    identifier: str   # username or email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    id: int
    username: str
    full_name: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class UserProfile(UserBase):
    bio: Optional[str] = None
    website: Optional[str] = None
    posts_count: int = 0
    followers_count: int = 0
    following_count: int = 0


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentOut(BaseModel):
    id: int
    user: str           # author username
    avatar: Optional[str] = None
    text: str
    time: str           # relative string computed in route

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------
class PostOut(BaseModel):
    id: int
    image_url: str
    caption: Optional[str] = None
    location: Optional[str] = None
    likes: int = 0
    saved: bool = False
    liked: bool = False
    time: str           # relative string
    author: str         # username
    author_avatar: Optional[str] = None
    comments: list[CommentOut] = []
    carousel_urls: list[str] = []

    model_config = {"from_attributes": True}


class PostCreate(BaseModel):
    image_url: str
    caption: Optional[str] = None
    location: Optional[str] = None
    carousel_urls: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Stories
# ---------------------------------------------------------------------------
class StoryOut(BaseModel):
    id: int
    user: str
    avatar: Optional[str] = None
    media_url: str
    liked: bool = False
    views_count: int = 0
    likes_count: int = 0

    model_config = {"from_attributes": True}


class StoryViewerOut(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    liked: bool = False

    model_config = {"from_attributes": True}



# ---------------------------------------------------------------------------
# Follow / suggestions
# ---------------------------------------------------------------------------
class SuggestionOut(BaseModel):
    id: int
    user: str
    avatar: Optional[str] = None
    note: str = "Suggested for you"

    model_config = {"from_attributes": True}
