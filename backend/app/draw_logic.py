from __future__ import annotations

import random
import uuid
from collections import defaultdict
from datetime import date
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models


def _base_weight(report_count: int) -> float:
    if report_count == 0:
        return 10.0
    if report_count == 1:
        return 2.0
    return 0.5


def _reason(report_count: int, question_count: int, last_report: bool, recently_drawn: bool) -> str:
    parts: list[str] = []
    if report_count == 0:
        parts.append("尚未汇报，基础权重较高")
    elif report_count == 1:
        parts.append("已有效汇报1次，基础权重降低")
    else:
        parts.append(f"已有效汇报{report_count}次，基础权重较低")

    if question_count > 0:
        parts.append(f"有效提问{question_count}次，权重适当降低")
    else:
        parts.append("尚未有效提问")

    if last_report:
        parts.append("上一节课刚汇报，冷却降低权重")

    if recently_drawn:
        parts.append("上一批刚抽中过，下一次自动排除")

    return "；".join(parts)


def get_latest_draw_batch_student_ids(db: Session) -> set[int]:
    latest_batch_id = db.scalar(
        select(models.DrawHistory.draw_batch_id)
        .order_by(models.DrawHistory.created_at.desc(), models.DrawHistory.id.desc())
        .limit(1)
    )
    if latest_batch_id is None:
        return set()
    return set(
        db.scalars(select(models.DrawHistory.student_id).where(models.DrawHistory.draw_batch_id == latest_batch_id)).all()
    )


def get_lesson_absent_student_ids(db: Session, lesson: int) -> set[int]:
    return set(
        db.scalars(select(models.StudentAbsence.student_id).where(models.StudentAbsence.lesson == lesson)).all()
    )


def compute_student_stats(db: Session, target_lesson: Optional[int] = None) -> list[dict[str, Any]]:
    """Return explainable draw statistics for every student."""
    students = db.scalars(select(models.Student).order_by(models.Student.pinyin)).all()
    valid_reports = db.scalars(select(models.Report).where(models.Report.valid.is_(True))).all()
    valid_questions = db.scalars(select(models.Question).where(models.Question.valid.is_(True))).all()
    recently_drawn_student_ids = get_latest_draw_batch_student_ids(db)

    report_count_by_student: dict[int, int] = defaultdict(int)
    question_count_by_student: dict[int, int] = defaultdict(int)
    latest_valid_report_lesson = 0
    report_lessons_by_student: dict[int, set[int]] = defaultdict(set)

    for report in valid_reports:
        report_count_by_student[report.student_id] += 1
        report_lessons_by_student[report.student_id].add(report.lesson)
        latest_valid_report_lesson = max(latest_valid_report_lesson, report.lesson)

    for question in valid_questions:
        question_count_by_student[question.questioner_id] += 1

    cooldown_reference_lesson = target_lesson - 1 if target_lesson is not None else latest_valid_report_lesson
    stats: list[dict[str, Any]] = []

    for student in students:
        report_count = report_count_by_student[student.id]
        question_count = question_count_by_student[student.id]
        base_weight = _base_weight(report_count)
        question_factor = max(0.4, 1 - 0.08 * question_count)
        last_report = cooldown_reference_lesson > 0 and cooldown_reference_lesson in report_lessons_by_student[student.id]
        cooldown_factor = 0.2 if last_report else 1.0
        recently_drawn = student.id in recently_drawn_student_ids
        eligible_for_next_draw = student.active and not recently_drawn
        weight = 0.0 if recently_drawn else max(base_weight * question_factor * cooldown_factor, 0.01)

        stats.append(
            {
                "id": student.id,
                "name": student.name,
                "pinyin": student.pinyin,
                "active": student.active,
                "note": student.note,
                "created_at": student.created_at,
                "updated_at": student.updated_at,
                "report_count": report_count,
                "question_count": question_count,
                "last_report": last_report,
                "recently_drawn": recently_drawn,
                "eligible_for_next_draw": eligible_for_next_draw,
                "base_weight": round(base_weight, 4),
                "question_factor": round(question_factor, 4),
                "cooldown_factor": round(cooldown_factor, 4),
                "weight": round(weight, 4),
                "reason": _reason(report_count, question_count, last_report, recently_drawn),
            }
        )

    return stats


def _weighted_pick(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    total_weight = sum(item["weight"] for item in candidates)
    if total_weight <= 0:
        return random.choice(candidates)
    threshold = random.uniform(0, total_weight)
    running = 0.0
    for candidate in candidates:
        running += candidate["weight"]
        if running >= threshold:
            return candidate
    return candidates[-1]


def build_draw_warnings(
    db: Session,
    lesson: int,
    available_count: int,
    target_count: int,
    recently_excluded_count: int = 0,
    absent_excluded_count: int = 0,
) -> list[str]:
    warnings: list[str] = []
    unreported_count = db.scalar(
        select(func.count(models.Student.id))
        .where(models.Student.active.is_(True))
        .where(
            ~models.Student.id.in_(
                select(models.Report.student_id).where(models.Report.valid.is_(True)).distinct()
            )
        )
    )
    unreported_count = int(unreported_count or 0)

    if recently_excluded_count > 0:
        warnings.append(f"上一批抽中过的 {recently_excluded_count} 名学生已自动排除")
    if absent_excluded_count > 0:
        warnings.append(f"本课请假的 {absent_excluded_count} 名学生已自动排除")
    if available_count < target_count:
        warnings.append(f"可抽取学生只有 {available_count} 人，少于目标人数 {target_count} 人，已抽取全部可用学生")
    if lesson >= 10 and unreported_count > 0:
        warnings.append(f"当前仍有 {unreported_count} 名学生尚未有效汇报")
    if lesson >= 11 and unreported_count > 0:
        warnings.append("建议优先抽取尚未汇报学生")
    return warnings


def weighted_draw(
    db: Session,
    lesson: int,
    date: date,
    count: int,
    excluded_student_ids: Optional[list[int]] = None,
) -> dict[str, Any]:
    del date
    manual_excluded = set(excluded_student_ids or [])
    absent_student_ids = get_lesson_absent_student_ids(db, lesson)
    excluded = manual_excluded | absent_student_ids
    target_count = count
    stats = compute_student_stats(db, target_lesson=lesson)
    candidates = [item for item in stats if item["eligible_for_next_draw"] and item["id"] not in excluded]
    recently_excluded_count = sum(
        1
        for item in stats
        if item["active"]
        and item["recently_drawn"]
        and item["id"] not in manual_excluded
        and item["id"] not in absent_student_ids
    )
    absent_excluded_count = sum(1 for item in stats if item["active"] and item["id"] in absent_student_ids)

    selected: list[dict[str, Any]] = []
    remaining = candidates.copy()
    for index in range(min(target_count, len(remaining))):
        picked = _weighted_pick(remaining)
        remaining = [item for item in remaining if item["id"] != picked["id"]]
        selected.append(
            {
                "order": index + 1,
                "student_id": picked["id"],
                "name": picked["name"],
                "pinyin": picked["pinyin"],
                "report_count": picked["report_count"],
                "question_count": picked["question_count"],
                "last_report": picked["last_report"],
                "weight": picked["weight"],
                "reason": picked["reason"],
            }
        )

    return {
        "batch_id": str(uuid.uuid4()),
        "results": selected,
        "warnings": build_draw_warnings(
            db,
            lesson,
            len(candidates),
            target_count,
            recently_excluded_count,
            absent_excluded_count,
        ),
    }


def save_draw_results(
    db: Session,
    batch_id: str,
    lesson: int,
    date: date,
    results: list[dict[str, Any] | Any],
) -> dict[str, Any]:
    existing = db.scalar(select(models.DrawHistory.id).where(models.DrawHistory.draw_batch_id == batch_id).limit(1))
    if existing is not None:
        raise HTTPException(status_code=400, detail="该批次抽取结果已经保存，请勿重复保存")

    payloads = [result if isinstance(result, dict) else result.model_dump() for result in results]
    absent_student_ids = get_lesson_absent_student_ids(db, lesson)
    stale_student_ids = sorted({payload["student_id"] for payload in payloads} & absent_student_ids)
    if stale_student_ids:
        names = list(
            db.scalars(
                select(models.Student.name)
                .where(models.Student.id.in_(stale_student_ids))
                .order_by(models.Student.pinyin)
            ).all()
        )
        blocked_students = "、".join(names or [str(student_id) for student_id in stale_student_ids])
        raise HTTPException(status_code=400, detail=f"请假学生不能保存到抽取历史：{blocked_students}")

    rows: list[models.DrawHistory] = []
    for payload in payloads:
        row = models.DrawHistory(
            lesson=lesson,
            date=date,
            student_id=payload["student_id"],
            draw_type="draw",
            action_status="pending",
            weight=payload["weight"],
            reason=payload["reason"],
            draw_batch_id=batch_id,
        )
        rows.append(row)
        db.add(row)

    db.commit()
    return {"message": "抽取结果已保存", "saved_count": len(rows)}
