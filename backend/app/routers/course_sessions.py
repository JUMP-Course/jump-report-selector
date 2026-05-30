from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.auth import require_auth
from app.database import get_db
from app.schemas import CourseSessionCreate, CourseSessionRead, CourseSessionUpdate


router = APIRouter(prefix="/api/course-sessions", tags=["course-sessions"], dependencies=[Depends(require_auth)])


def _get_session_or_404(db: Session, session_id: int) -> models.CourseSession:
    session = db.get(models.CourseSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="未找到该课程日程")
    return session


def _ensure_unique_lesson(db: Session, lesson: int, exclude_id: int | None = None) -> None:
    statement = select(models.CourseSession).where(models.CourseSession.lesson == lesson)
    if exclude_id is not None:
        statement = statement.where(models.CourseSession.id != exclude_id)
    if db.scalar(statement) is not None:
        raise HTTPException(status_code=400, detail="该课次已经存在")


@router.get("", response_model=list[CourseSessionRead])
def list_course_sessions(db: Session = Depends(get_db)) -> list[models.CourseSession]:
    return list(db.scalars(select(models.CourseSession).order_by(models.CourseSession.lesson)).all())


@router.get("/today", response_model=CourseSessionRead | None)
def get_today_session(db: Session = Depends(get_db)) -> models.CourseSession | None:
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    return db.scalar(select(models.CourseSession).where(models.CourseSession.date == today))


@router.post("", response_model=CourseSessionRead)
def create_course_session(payload: CourseSessionCreate, db: Session = Depends(get_db)) -> models.CourseSession:
    _ensure_unique_lesson(db, payload.lesson)
    session = models.CourseSession(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.put("/{session_id}", response_model=CourseSessionRead)
def update_course_session(
    session_id: int,
    payload: CourseSessionUpdate,
    db: Session = Depends(get_db),
) -> models.CourseSession:
    session = _get_session_or_404(db, session_id)
    updates = payload.model_dump(exclude_unset=True)
    if "lesson" in updates:
        _ensure_unique_lesson(db, updates["lesson"], exclude_id=session_id)
    for key, value in updates.items():
        setattr(session, key, value)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_course_session(session_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    session = _get_session_or_404(db, session_id)
    db.delete(session)
    db.commit()
    return {"message": "课程日程已删除"}
