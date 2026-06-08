from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.database import get_db
from app.schemas import StudentAbsenceRead, StudentAbsenceReplaceRequest


router = APIRouter(prefix="/api/absences", tags=["absences"], dependencies=[Depends(require_auth)])


def serialize_absence(row: models.StudentAbsence) -> dict:
    return {
        "id": row.id,
        "lesson": row.lesson,
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


@router.get("/lesson/{lesson}", response_model=list[StudentAbsenceRead])
def list_lesson_absences(
    lesson: int = Path(ge=1),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [serialize_absence(row) for row in _list_lesson_absences(db, lesson)]


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
    return [serialize_absence(row) for row in _list_lesson_absences(db, lesson)]
