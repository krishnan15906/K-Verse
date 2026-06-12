from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app import models, schemas
from app.database import get_db
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    email = str(body.email).strip().lower()

    # check uniqueness
    conflict = db.query(models.User).filter(
        or_(
            func.lower(models.User.email) == email,
            func.lower(models.User.username) == username,
        )
    ).first()
    if conflict:
        field = "email" if conflict.email.lower() == email else "username"
        raise HTTPException(status_code=400, detail=f"{field} already taken")

    user = models.User(
        username=username,
        full_name=body.full_name.strip(),
        email=email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id)}


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    identifier = body.identifier.strip().lower()
    user = db.query(models.User).filter(
        or_(
            func.lower(models.User.email) == identifier,
            func.lower(models.User.username) == identifier,
        )
    ).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return {"access_token": create_access_token(user.id)}
