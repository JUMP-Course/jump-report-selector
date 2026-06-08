from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import require_auth
from app.config import get_settings
from app.database import Base, engine, get_db
from app.migrations import run_lightweight_migrations
from app.routers import absences, auth, course_sessions, draws, exports, questions, reports, students
from app.routers.draws import serialize_draw_history
from app.schemas import DashboardResponse


settings = get_settings()
app = FastAPI(title="JUMP R 语言课程课堂管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations()
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router)
app.include_router(students.router)
app.include_router(absences.router)
app.include_router(reports.router)
app.include_router(questions.router)
app.include_router(draws.router)
app.include_router(exports.router)
app.include_router(course_sessions.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardResponse, dependencies=[Depends(require_auth)])
def dashboard(db: Session = Depends(get_db)) -> dict:
    students_all = list(db.scalars(select(models.Student).order_by(models.Student.pinyin)).all())
    active_students = [student for student in students_all if student.active]

    reported_ids = set(
        db.scalars(select(models.Report.student_id).where(models.Report.valid.is_(True)).distinct()).all()
    )
    questioned_ids = set(
        db.scalars(select(models.Question.questioner_id).where(models.Question.valid.is_(True)).distinct()).all()
    )
    total_valid_questions = int(
        db.scalar(select(func.count(models.Question.id)).where(models.Question.valid.is_(True))) or 0
    )

    unreported_list = [student for student in active_students if student.id not in reported_ids]
    never_questioned_list = [student for student in active_students if student.id not in questioned_ids]

    recent_draw_rows = db.scalars(
        select(models.DrawHistory)
        .options(joinedload(models.DrawHistory.student))
        .order_by(models.DrawHistory.created_at.desc(), models.DrawHistory.id.desc())
        .limit(10)
    ).all()
    sessions = list(db.scalars(select(models.CourseSession).order_by(models.CourseSession.lesson)).all())
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    today_session = next((session for session in sessions if session.date == today), None)

    latest_lesson = int(db.scalar(select(func.max(models.Report.lesson))) or 0)
    warnings: list[str] = []
    if latest_lesson >= 10 and unreported_list:
        warnings.append(f"当前仍有 {len(unreported_list)} 名学生尚未有效汇报")
    if latest_lesson >= 11 and unreported_list:
        warnings.append("建议优先抽取尚未汇报学生")

    return {
        "total_students": len(students_all),
        "active_students": len(active_students),
        "reported_students": len([student for student in active_students if student.id in reported_ids]),
        "unreported_students": len(unreported_list),
        "total_valid_questions": total_valid_questions,
        "never_questioned_students": len(never_questioned_list),
        "unreported_list": unreported_list,
        "never_questioned_list": never_questioned_list,
        "recent_draws": [serialize_draw_history(row) for row in recent_draw_rows],
        "course_sessions": sessions,
        "today_session": today_session,
        "warnings": warnings,
    }
