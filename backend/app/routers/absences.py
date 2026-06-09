from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.database import get_db
from app.schemas import StudentAbsenceRead, StudentAbsenceReplaceRequest


router = APIRouter(prefix="/api/absences", tags=["absences"], dependencies=[Depends(require_auth)])


def _course_session_by_lesson(db: Session, lessons: set[int]) -> dict[int, models.CourseSession]:
    if not lessons:
        return {}
    sessions = db.scalars(select(models.CourseSession).where(models.CourseSession.lesson.in_(lessons))).all()
    return {session.lesson: session for session in sessions}


def serialize_absence(row: models.StudentAbsence, session: models.CourseSession | None = None) -> dict:
    return {
        "id": row.id,
        "lesson": row.lesson,
        "course_date": session.date if session else None,
        "course_title": session.title if session else None,
        "student_id": row.student_id,
        "student_name": row.student.name,
        "student_pinyin": row.student.pinyin,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _list_lesson_absences(db: Session, lesson: int) -> list[models.StudentAbsence]:
    return list(
        db.scalars(
            select(models.StudentAbsence)
            .join(models.StudentAbsence.student)
            .options(joinedload(models.StudentAbsence.student))
            .where(models.StudentAbsence.lesson == lesson)
            .order_by(models.Student.pinyin)
        ).all()
    )


@router.get("", response_model=list[StudentAbsenceRead])
def list_absences(
    lesson: Optional[int] = Query(default=None, ge=1),
    student_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(models.StudentAbsence)
        .join(models.StudentAbsence.student)
        .options(joinedload(models.StudentAbsence.student))
    )
    if lesson is not None:
        statement = statement.where(models.StudentAbsence.lesson == lesson)
    if student_id is not None:
        statement = statement.where(models.StudentAbsence.student_id == student_id)
    statement = statement.order_by(models.StudentAbsence.lesson, models.Student.pinyin)

    rows = list(db.scalars(statement).all())
    sessions_by_lesson = _course_session_by_lesson(db, {row.lesson for row in rows})
    return [serialize_absence(row, sessions_by_lesson.get(row.lesson)) for row in rows]


@router.get("/lesson/{lesson}", response_model=list[StudentAbsenceRead])
def list_lesson_absences(
    lesson: int = Path(ge=1),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = _list_lesson_absences(db, lesson)
    sessions_by_lesson = _course_session_by_lesson(db, {lesson})
    return [serialize_absence(row, sessions_by_lesson.get(row.lesson)) for row in rows]


@router.delete("/{absence_id}")
def delete_absence(absence_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    row = db.get(models.StudentAbsence, absence_id)
    if row is None:
        raise HTTPException(status_code=404, detail="未找到该请假记录")
    db.delete(row)
    db.commit()
    return {"message": "请假记录已取消"}


@router.put("/lesson/{lesson}", response_model=list[StudentAbsenceRead])
def replace_lesson_absences(
    payload: StudentAbsenceReplaceRequest,
    lesson: int = Path(ge=1),
    db: Session = Depends(get_db),
) -> list[dict]:
    student_ids = list(dict.fromkeys(payload.student_ids))
    desired_ids = set(student_ids)

    if student_ids:
        found_ids = set(db.scalars(select(models.Student.id).where(models.Student.id.in_(student_ids))).all())
        missing_ids = sorted(desired_ids - found_ids)
        if missing_ids:
            raise HTTPException(status_code=404, detail=f"未找到学生：{', '.join(map(str, missing_ids))}")

    existing_rows = db.scalars(select(models.StudentAbsence).where(models.StudentAbsence.lesson == lesson)).all()
    existing_ids = {row.student_id for row in existing_rows}

    for row in existing_rows:
        if row.student_id not in desired_ids:
            db.delete(row)

    for student_id in student_ids:
        if student_id not in existing_ids:
            db.add(models.StudentAbsence(lesson=lesson, student_id=student_id))

    db.commit()
    rows = _list_lesson_absences(db, lesson)
    sessions_by_lesson = _course_session_by_lesson(db, {lesson})
    return [serialize_absence(row, sessions_by_lesson.get(row.lesson)) for row in rows]
