from __future__ import annotations

from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models


class DeleteCounts(TypedDict):
    histories: int
    reports: int
    questions: int


def _empty_counts() -> DeleteCounts:
    return {"histories": 0, "reports": 0, "questions": 0}


def _add_counts(target: DeleteCounts, source: DeleteCounts) -> None:
    target["histories"] += source["histories"]
    target["reports"] += source["reports"]
    target["questions"] += source["questions"]


def delete_draw_history_row(db: Session, row: models.DrawHistory) -> DeleteCounts:
    counts = _empty_counts()
    if row.linked_report is not None:
        db.delete(row.linked_report)
        counts["reports"] += 1
    if row.linked_question is not None:
        db.delete(row.linked_question)
        counts["questions"] += 1
    db.delete(row)
    counts["histories"] += 1
    return counts


def clear_draw_history(db: Session) -> DeleteCounts:
    rows = db.scalars(
        select(models.DrawHistory).options(
            joinedload(models.DrawHistory.linked_report),
            joinedload(models.DrawHistory.linked_question),
        )
    ).all()
    counts = _empty_counts()
    for row in rows:
        _add_counts(counts, delete_draw_history_row(db, row))
    return counts


def reset_draw_history_for_report_delete(db: Session, report: models.Report) -> bool:
    if report.draw_history_id is None:
        return False
    row = db.get(models.DrawHistory, report.draw_history_id)
    if row is None:
        return False
    row.action_status = "pending"
    row.action_note = None
    row.linked_report = None
    return True


def reset_draw_history_for_question_delete(db: Session, question: models.Question) -> bool:
    if question.draw_history_id is None:
        return False
    row = db.get(models.DrawHistory, question.draw_history_id)
    if row is None:
        return False
    row.action_status = "pending"
    row.action_note = None
    row.linked_question = None
    return True


def delete_report_row(db: Session, report: models.Report) -> bool:
    reset = reset_draw_history_for_report_delete(db, report)
    db.delete(report)
    return reset


def delete_question_row(db: Session, question: models.Question) -> bool:
    reset = reset_draw_history_for_question_delete(db, question)
    db.delete(question)
    return reset


def clear_reports(db: Session) -> tuple[int, int]:
    reports = db.scalars(select(models.Report)).all()
    reset_count = 0
    for report in reports:
        if delete_report_row(db, report):
            reset_count += 1
    return len(reports), reset_count


def clear_questions(db: Session) -> tuple[int, int]:
    questions = db.scalars(select(models.Question)).all()
    reset_count = 0
    for question in questions:
        if delete_question_row(db, question):
            reset_count += 1
    return len(questions), reset_count
