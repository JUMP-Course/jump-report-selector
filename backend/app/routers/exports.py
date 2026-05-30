from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.database import get_db
from app.draw_logic import compute_student_stats
from app.routers.reports import normalize_report_type


router = APIRouter(prefix="/api/exports", tags=["exports"], dependencies=[Depends(require_auth)])


def csv_response(filename: str, headers: list[str], rows: list[list[object]]) -> StreamingResponse:
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/students.csv")
def export_students(db: Session = Depends(get_db)) -> StreamingResponse:
    students = db.scalars(select(models.Student).order_by(models.Student.pinyin)).all()
    rows = [[s.id, s.name, s.pinyin, "是" if s.active else "否", s.note or "", s.created_at, s.updated_at] for s in students]
    return csv_response("students.csv", ["ID", "姓名", "拼音", "参与抽取", "备注", "创建时间", "更新时间"], rows)


@router.get("/student_stats.csv")
def export_student_stats(db: Session = Depends(get_db)) -> StreamingResponse:
    stats = compute_student_stats(db)
    rows = [
        [
            item["id"],
            item["name"],
            item["pinyin"],
            "是" if item["active"] else "否",
            item["report_count"],
            item["question_count"],
            "是" if item["last_report"] else "否",
            item["base_weight"],
            item["question_factor"],
            item["cooldown_factor"],
            item["weight"],
            item["reason"],
        ]
        for item in stats
    ]
    return csv_response(
        "student_stats.csv",
        ["ID", "姓名", "拼音", "参与抽取", "有效汇报次数", "有效提问次数", "上次是否刚汇报", "基础权重", "提问因子", "冷却因子", "当前权重", "权重说明"],
        rows,
    )


@router.get("/reports.csv")
def export_reports(db: Session = Depends(get_db)) -> StreamingResponse:
    reports = db.scalars(select(models.Report).options(joinedload(models.Report.student)).order_by(models.Report.id)).all()
    rows = [
        [
            r.id,
            r.lesson,
            r.date,
            r.student.name,
            r.student.pinyin,
            normalize_report_type(r.report_type),
            r.draw_history_id or "",
            "是" if r.valid else "否",
            r.note or "",
            r.created_at,
            r.updated_at,
        ]
        for r in reports
    ]
    return csv_response("reports.csv", ["ID", "课次", "日期", "学生", "拼音", "汇报来源", "关联抽取历史ID", "有效", "备注", "创建时间", "更新时间"], rows)


@router.get("/questions.csv")
def export_questions(db: Session = Depends(get_db)) -> StreamingResponse:
    questions = db.scalars(
        select(models.Question)
        .options(joinedload(models.Question.questioner), joinedload(models.Question.reporter))
        .order_by(models.Question.id)
    ).all()
    rows = [
        [
            q.id,
            q.lesson,
            q.date,
            q.questioner.name,
            q.questioner.pinyin,
            q.reporter.name if q.reporter else "",
            q.reporter.pinyin if q.reporter else "",
            q.question_type,
            q.question_source,
            q.draw_history_id or "",
            "是" if q.valid else "否",
            q.note or "",
            q.created_at,
            q.updated_at,
        ]
        for q in questions
    ]
    return csv_response(
        "questions.csv",
        ["ID", "课次", "日期", "提问学生", "提问学生拼音", "被提问学生", "被提问学生拼音", "问题类型", "提问来源", "关联抽取历史ID", "有效", "内容简述", "创建时间", "更新时间"],
        rows,
    )


@router.get("/draw_history.csv")
def export_draw_history(db: Session = Depends(get_db)) -> StreamingResponse:
    history = db.scalars(
        select(models.DrawHistory)
        .options(
            joinedload(models.DrawHistory.student),
            joinedload(models.DrawHistory.linked_report),
            joinedload(models.DrawHistory.linked_question),
        )
        .order_by(models.DrawHistory.id)
    ).all()
    rows = [
        [
            h.id,
            h.lesson,
            h.date,
            h.student.name,
            h.student.pinyin,
            h.action_status,
            h.action_note or "",
            h.linked_report.id if h.linked_report else "",
            h.linked_question.id if h.linked_question else "",
            h.weight,
            h.reason,
            h.draw_batch_id,
            h.created_at,
        ]
        for h in history
    ]
    return csv_response("draw_history.csv", ["ID", "课次", "日期", "学生", "拼音", "动作状态", "动作备注", "关联汇报ID", "关联提问ID", "权重", "原因", "批次ID", "创建时间"], rows)


@router.get("/course_sessions.csv")
def export_course_sessions(db: Session = Depends(get_db)) -> StreamingResponse:
    sessions = db.scalars(select(models.CourseSession).order_by(models.CourseSession.lesson)).all()
    rows = [[s.id, s.lesson, s.date, s.title or "", s.note or "", s.created_at, s.updated_at] for s in sessions]
    return csv_response("course_sessions.csv", ["ID", "课次", "日期", "标题", "备注", "创建时间", "更新时间"], rows)
