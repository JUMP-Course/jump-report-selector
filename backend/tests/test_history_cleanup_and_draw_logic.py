from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models
from app.database import Base
from app.draw_logic import compute_student_stats, weighted_draw
from app.history_cleanup import clear_questions, clear_reports, delete_draw_history_row, delete_report_row


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session


def _student(db: Session, name: str, pinyin: str) -> models.Student:
    student = models.Student(name=name, pinyin=pinyin, active=True)
    db.add(student)
    db.flush()
    return student


def _draw_history(db: Session, student: models.Student, batch_id: str) -> models.DrawHistory:
    row = models.DrawHistory(
        lesson=1,
        date=date(2026, 3, 1),
        student_id=student.id,
        draw_type="draw",
        action_status="pending",
        weight=10,
        reason="test",
        draw_batch_id=batch_id,
    )
    db.add(row)
    db.flush()
    return row


def test_latest_saved_draw_batch_is_excluded_from_next_draw(db: Session) -> None:
    students = [_student(db, f"学生{index}", f"s{index}") for index in range(1, 5)]
    _draw_history(db, students[0], "old-batch")
    _draw_history(db, students[1], "latest-batch")
    db.commit()

    result = weighted_draw(db, lesson=2, date=date(2026, 3, 8), count=10)

    selected_ids = {item["student_id"] for item in result["results"]}
    assert students[1].id not in selected_ids
    assert len(result["results"]) == 3
    assert "上一批抽中过的 1 名学生已自动排除" in result["warnings"]
    assert "可抽取学生只有 3 人，少于目标人数 10 人，已抽取全部可用学生" in result["warnings"]

    stats_by_id = {item["id"]: item for item in compute_student_stats(db)}
    assert stats_by_id[students[1].id]["recently_drawn"] is True
    assert stats_by_id[students[1].id]["eligible_for_next_draw"] is False
    assert stats_by_id[students[1].id]["weight"] == 0


def test_delete_draw_history_removes_only_linked_auto_records(db: Session) -> None:
    student = _student(db, "张三", "zhangsan")
    row = _draw_history(db, student, "batch")
    row.linked_report = models.Report(
        lesson=1,
        date=date(2026, 3, 1),
        student_id=student.id,
        report_type="draw",
        valid=True,
    )
    row.linked_question = models.Question(
        lesson=1,
        date=date(2026, 3, 1),
        questioner_id=student.id,
        question_type="其他",
        question_source="draw",
        valid=True,
    )
    manual_report = models.Report(
        lesson=1,
        date=date(2026, 3, 1),
        student_id=student.id,
        report_type="self",
        valid=True,
    )
    manual_question = models.Question(
        lesson=1,
        date=date(2026, 3, 1),
        questioner_id=student.id,
        question_type="数据问题",
        question_source="manual",
        valid=True,
    )
    db.add_all([manual_report, manual_question])
    db.commit()

    row = db.scalar(
        select(models.DrawHistory)
        .where(models.DrawHistory.id == row.id)
        .options(joinedload(models.DrawHistory.linked_report), joinedload(models.DrawHistory.linked_question))
    )
    assert row is not None
    counts = delete_draw_history_row(db, row)
    db.commit()

    assert counts == {"histories": 1, "reports": 1, "questions": 1}
    assert db.scalar(select(func.count(models.DrawHistory.id))) == 0
    assert db.scalars(select(models.Report)).all() == [manual_report]
    assert db.scalars(select(models.Question)).all() == [manual_question]


def test_deleting_linked_report_resets_draw_history_to_pending(db: Session) -> None:
    student = _student(db, "李四", "lisi")
    row = _draw_history(db, student, "batch")
    row.action_status = "report"
    row.action_note = "已汇报"
    row.linked_report = models.Report(
        lesson=1,
        date=date(2026, 3, 1),
        student_id=student.id,
        report_type="draw",
        valid=True,
    )
    db.commit()

    report = db.scalar(select(models.Report))
    assert report is not None
    assert delete_report_row(db, report) is True
    db.commit()

    row = db.scalar(
        select(models.DrawHistory)
        .where(models.DrawHistory.id == row.id)
        .options(joinedload(models.DrawHistory.linked_report))
    )
    assert row is not None
    assert row.action_status == "pending"
    assert row.action_note is None
    assert row.linked_report is None


def test_clearing_reports_and_questions_resets_linked_draw_histories(db: Session) -> None:
    reporter = _student(db, "王五", "wangwu")
    questioner = _student(db, "赵六", "zhaoliu")
    report_draw = _draw_history(db, reporter, "report-batch")
    question_draw = _draw_history(db, questioner, "question-batch")
    report_draw.action_status = "report"
    question_draw.action_status = "question"
    report_draw.linked_report = models.Report(
        lesson=1,
        date=date(2026, 3, 1),
        student_id=reporter.id,
        report_type="draw",
        valid=True,
    )
    question_draw.linked_question = models.Question(
        lesson=1,
        date=date(2026, 3, 1),
        questioner_id=questioner.id,
        question_type="其他",
        question_source="draw",
        valid=True,
    )
    db.commit()

    deleted_reports, reset_reports = clear_reports(db)
    deleted_questions, reset_questions = clear_questions(db)
    db.commit()

    assert (deleted_reports, reset_reports) == (1, 1)
    assert (deleted_questions, reset_questions) == (1, 1)
    rows = db.scalars(select(models.DrawHistory).order_by(models.DrawHistory.id)).all()
    assert [row.action_status for row in rows] == ["pending", "pending"]
    assert db.scalar(select(func.count(models.Report.id))) == 0
    assert db.scalar(select(func.count(models.Question.id))) == 0
