from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.crud import get_student_or_404
from app.database import get_db
from app.schemas import QuestionCreate, QuestionRead, QuestionUpdate


router = APIRouter(prefix="/api/questions", tags=["questions"], dependencies=[Depends(require_auth)])


def serialize_question(question: models.Question) -> dict:
    return {
        "id": question.id,
        "lesson": question.lesson,
        "date": question.date,
        "questioner_id": question.questioner_id,
        "questioner_name": question.questioner.name,
        "questioner_pinyin": question.questioner.pinyin,
        "reporter_id": question.reporter_id,
        "reporter_name": question.reporter.name if question.reporter else None,
        "reporter_pinyin": question.reporter.pinyin if question.reporter else None,
        "question_type": question.question_type,
        "question_source": question.question_source,
        "draw_history_id": question.draw_history_id,
        "valid": question.valid,
        "note": question.note,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


@router.get("", response_model=list[QuestionRead])
def list_questions(
    lesson: Optional[int] = None,
    questioner_id: Optional[int] = None,
    reporter_id: Optional[int] = None,
    question_type: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(models.Question).options(
        joinedload(models.Question.questioner),
        joinedload(models.Question.reporter),
    )
    if lesson is not None:
        statement = statement.where(models.Question.lesson == lesson)
    if questioner_id is not None:
        statement = statement.where(models.Question.questioner_id == questioner_id)
    if reporter_id is not None:
        statement = statement.where(models.Question.reporter_id == reporter_id)
    if question_type:
        statement = statement.where(models.Question.question_type == question_type)
    statement = statement.order_by(models.Question.date.desc(), models.Question.id.desc())
    return [serialize_question(question) for question in db.scalars(statement).all()]


@router.post("", response_model=QuestionRead)
def create_question(payload: QuestionCreate, db: Session = Depends(get_db)) -> dict:
    get_student_or_404(db, payload.questioner_id)
    if payload.reporter_id is not None:
        get_student_or_404(db, payload.reporter_id)
    if payload.draw_history_id is not None and db.get(models.DrawHistory, payload.draw_history_id) is None:
        raise HTTPException(status_code=404, detail="未找到关联的抽取历史")
    question = models.Question(**payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    question = db.scalar(
        select(models.Question)
        .where(models.Question.id == question.id)
        .options(joinedload(models.Question.questioner), joinedload(models.Question.reporter))
    )
    if question is None:
        raise HTTPException(status_code=500, detail="新增提问记录后读取失败")
    return serialize_question(question)


@router.put("/{question_id}", response_model=QuestionRead)
def update_question(question_id: int, payload: QuestionUpdate, db: Session = Depends(get_db)) -> dict:
    question = db.get(models.Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="未找到该提问记录")
    updates = payload.model_dump(exclude_unset=True)
    if "questioner_id" in updates:
        get_student_or_404(db, updates["questioner_id"])
    if updates.get("reporter_id") is not None:
        get_student_or_404(db, updates["reporter_id"])
    if updates.get("draw_history_id") is not None and db.get(models.DrawHistory, updates["draw_history_id"]) is None:
        raise HTTPException(status_code=404, detail="未找到关联的抽取历史")
    for key, value in updates.items():
        setattr(question, key, value)
    db.commit()
    question = db.scalar(
        select(models.Question)
        .where(models.Question.id == question_id)
        .options(joinedload(models.Question.questioner), joinedload(models.Question.reporter))
    )
    if question is None:
        raise HTTPException(status_code=500, detail="更新提问记录后读取失败")
    return serialize_question(question)


@router.delete("/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    question = db.get(models.Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="未找到该提问记录")
    db.delete(question)
    db.commit()
    return {"message": "提问记录已删除"}
