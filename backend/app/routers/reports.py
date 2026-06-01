from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.crud import get_student_or_404
from app.database import get_db
from app.history_cleanup import clear_reports, delete_report_row
from app.schemas import ReportCreate, ReportRead, ReportUpdate


router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(require_auth)])


def normalize_report_type(report_type: str) -> str:
    return "draw" if report_type in {"pre", "live", "backup"} else report_type


def serialize_report(report: models.Report) -> dict:
    return {
        "id": report.id,
        "lesson": report.lesson,
        "date": report.date,
        "student_id": report.student_id,
        "student_name": report.student.name,
        "student_pinyin": report.student.pinyin,
        "report_type": normalize_report_type(report.report_type),
        "draw_history_id": report.draw_history_id,
        "valid": report.valid,
        "note": report.note,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


@router.get("", response_model=list[ReportRead])
def list_reports(
    lesson: Optional[int] = None,
    student_id: Optional[int] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(models.Report).options(joinedload(models.Report.student))
    if lesson is not None:
        statement = statement.where(models.Report.lesson == lesson)
    if student_id is not None:
        statement = statement.where(models.Report.student_id == student_id)
    if report_type:
        if report_type == "draw":
            statement = statement.where(models.Report.report_type.in_(["draw", "pre", "live", "backup"]))
        else:
            statement = statement.where(models.Report.report_type == report_type)
    statement = statement.order_by(models.Report.date.desc(), models.Report.id.desc())
    return [serialize_report(report) for report in db.scalars(statement).all()]


@router.post("", response_model=ReportRead)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)) -> dict:
    get_student_or_404(db, payload.student_id)
    if payload.draw_history_id is not None and db.get(models.DrawHistory, payload.draw_history_id) is None:
        raise HTTPException(status_code=404, detail="未找到关联的抽取历史")
    report = models.Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    report = db.scalar(
        select(models.Report).where(models.Report.id == report.id).options(joinedload(models.Report.student))
    )
    if report is None:
        raise HTTPException(status_code=500, detail="新增汇报记录后读取失败")
    return serialize_report(report)


@router.put("/{report_id}", response_model=ReportRead)
def update_report(report_id: int, payload: ReportUpdate, db: Session = Depends(get_db)) -> dict:
    report = db.get(models.Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="未找到该汇报记录")
    updates = payload.model_dump(exclude_unset=True)
    if "student_id" in updates:
        get_student_or_404(db, updates["student_id"])
    if updates.get("draw_history_id") is not None and db.get(models.DrawHistory, updates["draw_history_id"]) is None:
        raise HTTPException(status_code=404, detail="未找到关联的抽取历史")
    for key, value in updates.items():
        setattr(report, key, value)
    db.commit()
    report = db.scalar(
        select(models.Report).where(models.Report.id == report_id).options(joinedload(models.Report.student))
    )
    if report is None:
        raise HTTPException(status_code=500, detail="更新汇报记录后读取失败")
    return serialize_report(report)


@router.delete("")
def clear_all_reports(db: Session = Depends(get_db)) -> dict[str, int | str]:
    deleted_count, reset_count = clear_reports(db)
    db.commit()
    return {
        "message": "汇报记录已清空，对应抽取历史已重置为未处理",
        "deleted_reports": deleted_count,
        "reset_draw_histories": reset_count,
    }


@router.delete("/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db)) -> dict[str, int | str]:
    report = db.get(models.Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="未找到该汇报记录")
    reset = delete_report_row(db, report)
    db.commit()
    return {
        "message": "汇报记录已删除，对应抽取历史已重置为未处理" if reset else "汇报记录已删除",
        "reset_draw_histories": 1 if reset else 0,
    }
