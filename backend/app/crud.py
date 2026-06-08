from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def get_student_or_404(db: Session, student_id: int) -> models.Student:
    student = db.get(models.Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="未找到该学生")
    return student


def ensure_unique_pinyin(db: Session, pinyin: str, exclude_student_id: Optional[int] = None) -> None:
    statement = select(models.Student).where(models.Student.pinyin == pinyin)
    if exclude_student_id is not None:
        statement = statement.where(models.Student.id != exclude_student_id)
    if db.scalar(statement) is not None:
        raise HTTPException(status_code=400, detail="该拼音标识已存在")


def student_has_history(db: Session, student_id: int) -> bool:
    report_exists = db.scalar(select(models.Report.id).where(models.Report.student_id == student_id).limit(1))
    question_exists = db.scalar(
        select(models.Question.id).where(models.Question.questioner_id == student_id).limit(1)
    )
    reporter_exists = db.scalar(select(models.Question.id).where(models.Question.reporter_id == student_id).limit(1))
    draw_exists = db.scalar(select(models.DrawHistory.id).where(models.DrawHistory.student_id == student_id).limit(1))
    absence_exists = db.scalar(select(models.StudentAbsence.id).where(models.StudentAbsence.student_id == student_id).limit(1))
    return any([report_exists, question_exists, reporter_exists, draw_exists, absence_exists])
