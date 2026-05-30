from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.database import get_db
from app.draw_logic import save_draw_results, weighted_draw
from app.crud import get_student_or_404
from app.schemas import (
    DrawActionUpdate,
    DrawHistoryRead,
    DrawPreviewRequest,
    DrawPreviewResponse,
    DrawSaveRequest,
    DrawSaveResponse,
)


router = APIRouter(prefix="/api/draws", tags=["draws"], dependencies=[Depends(require_auth)])


def serialize_draw_history(row: models.DrawHistory) -> dict:
    return {
        "id": row.id,
        "lesson": row.lesson,
        "date": row.date,
        "student_id": row.student_id,
        "student_name": row.student.name,
        "student_pinyin": row.student.pinyin,
        "action_status": row.action_status,
        "action_note": row.action_note,
        "linked_report_id": row.linked_report.id if row.linked_report else None,
        "linked_question_id": row.linked_question.id if row.linked_question else None,
        "weight": row.weight,
        "reason": row.reason,
        "draw_batch_id": row.draw_batch_id,
        "created_at": row.created_at,
    }


@router.post("/preview", response_model=DrawPreviewResponse)
def preview_draw(payload: DrawPreviewRequest, db: Session = Depends(get_db)) -> dict:
    return weighted_draw(
        db=db,
        lesson=payload.lesson,
        date=payload.date,
        count=payload.count,
        excluded_student_ids=payload.excluded_student_ids,
    )


@router.post("/save", response_model=DrawSaveResponse)
def save_draw(payload: DrawSaveRequest, db: Session = Depends(get_db)) -> dict:
    return save_draw_results(
        db=db,
        batch_id=payload.batch_id,
        lesson=payload.lesson,
        date=payload.date,
        results=payload.results,
    )


@router.get("/history", response_model=list[DrawHistoryRead])
def list_draw_history(
    lesson: Optional[int] = None,
    student_id: Optional[int] = None,
    action_status: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(models.DrawHistory).options(
        joinedload(models.DrawHistory.student),
        joinedload(models.DrawHistory.linked_report),
        joinedload(models.DrawHistory.linked_question),
    )
    if lesson is not None:
        statement = statement.where(models.DrawHistory.lesson == lesson)
    if student_id is not None:
        statement = statement.where(models.DrawHistory.student_id == student_id)
    if action_status:
        statement = statement.where(models.DrawHistory.action_status == action_status)
    statement = statement.order_by(models.DrawHistory.created_at.desc(), models.DrawHistory.id.desc())
    return [serialize_draw_history(row) for row in db.scalars(statement).all()]


def _get_history_or_404(db: Session, history_id: int) -> models.DrawHistory:
    row = db.scalar(
        select(models.DrawHistory)
        .where(models.DrawHistory.id == history_id)
        .options(
            joinedload(models.DrawHistory.student),
            joinedload(models.DrawHistory.linked_report),
            joinedload(models.DrawHistory.linked_question),
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="未找到该抽取历史")
    return row


def _delete_linked_report(db: Session, row: models.DrawHistory) -> None:
    if row.linked_report is not None:
        db.delete(row.linked_report)
        row.linked_report = None


def _delete_linked_question(db: Session, row: models.DrawHistory) -> None:
    if row.linked_question is not None:
        db.delete(row.linked_question)
        row.linked_question = None


@router.put("/history/{history_id}/action", response_model=DrawHistoryRead)
def update_draw_action(
    history_id: int,
    payload: DrawActionUpdate,
    db: Session = Depends(get_db),
) -> dict:
    row = _get_history_or_404(db, history_id)
    row.action_status = payload.action_status
    row.action_note = payload.note

    if payload.action_status == "report":
        _delete_linked_question(db, row)
        if row.linked_report is None:
            row.linked_report = models.Report(
                lesson=row.lesson,
                date=row.date,
                student_id=row.student_id,
                report_type="draw",
                valid=payload.valid,
                note=payload.note,
            )
        else:
            row.linked_report.lesson = row.lesson
            row.linked_report.date = row.date
            row.linked_report.student_id = row.student_id
            row.linked_report.report_type = "draw"
            row.linked_report.valid = payload.valid
            row.linked_report.note = payload.note

    elif payload.action_status == "question":
        _delete_linked_report(db, row)
        if payload.reporter_id is not None:
            get_student_or_404(db, payload.reporter_id)
        if row.linked_question is None:
            row.linked_question = models.Question(
                lesson=row.lesson,
                date=row.date,
                questioner_id=row.student_id,
                reporter_id=payload.reporter_id,
                question_type=payload.question_type or "其他",
                question_source="draw",
                valid=payload.valid,
                note=payload.note,
            )
        else:
            row.linked_question.lesson = row.lesson
            row.linked_question.date = row.date
            row.linked_question.questioner_id = row.student_id
            row.linked_question.reporter_id = payload.reporter_id
            row.linked_question.question_type = payload.question_type or "其他"
            row.linked_question.question_source = "draw"
            row.linked_question.valid = payload.valid
            row.linked_question.note = payload.note

    else:
        _delete_linked_report(db, row)
        _delete_linked_question(db, row)

    db.commit()
    row = _get_history_or_404(db, history_id)
    return serialize_draw_history(row)
