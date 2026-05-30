from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.auth import require_auth
from app.crud import ensure_unique_pinyin, get_student_or_404, student_has_history
from app.database import get_db
from app.draw_logic import compute_student_stats
from app.schemas import StudentCreate, StudentImportRequest, StudentImportResponse, StudentRead, StudentStats, StudentUpdate


router = APIRouter(prefix="/api/students", tags=["students"], dependencies=[Depends(require_auth)])


@router.get("", response_model=list[StudentRead])
def list_students(db: Session = Depends(get_db)) -> list[models.Student]:
    return list(db.scalars(select(models.Student).order_by(models.Student.pinyin)).all())


@router.get("/stats", response_model=list[StudentStats])
def list_student_stats(db: Session = Depends(get_db)) -> list[dict]:
    return compute_student_stats(db)


@router.post("", response_model=StudentRead)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)) -> models.Student:
    ensure_unique_pinyin(db, payload.pinyin)
    student = models.Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def _parse_active(value: str | None) -> bool:
    if value is None or value.strip() == "":
        return True
    normalized = value.strip().lower()
    return normalized not in {"0", "false", "no", "n", "否", "不参与", "inactive"}


def _normalize_header(value: str) -> str:
    mapping = {
        "姓名": "name",
        "中文姓名": "name",
        "name": "name",
        "拼音": "pinyin",
        "全拼": "pinyin",
        "pinyin": "pinyin",
        "是否参与": "active",
        "参与抽取": "active",
        "active": "active",
        "备注": "note",
        "note": "note",
    }
    return mapping.get(value.strip().lower(), value.strip().lower())


def _read_import_rows(text: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    sample = text.strip()
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    reader = csv.reader(io.StringIO(sample), delimiter=delimiter)
    raw_rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not raw_rows:
        return [], []

    header = [_normalize_header(cell) for cell in raw_rows[0]]
    has_header = "name" in header and "pinyin" in header
    data_rows = raw_rows[1:] if has_header else raw_rows

    rows: list[dict[str, str]] = []
    raw_payloads: list[dict[str, str]] = []
    for raw in data_rows:
        if has_header:
            payload = {header[index]: value.strip() for index, value in enumerate(raw) if index < len(header)}
        else:
            payload = {
                "name": raw[0].strip() if len(raw) > 0 else "",
                "pinyin": raw[1].strip() if len(raw) > 1 else "",
                "active": raw[2].strip() if len(raw) > 2 else "",
                "note": raw[3].strip() if len(raw) > 3 else "",
            }
        rows.append(payload)
        raw_payloads.append({"raw": delimiter.join(raw)})
    return rows, raw_payloads


@router.post("/import", response_model=StudentImportResponse)
def import_students(payload: StudentImportRequest, db: Session = Depends(get_db)) -> dict:
    text = payload.text
    rows, raw_payloads = _read_import_rows(text)
    created: list[models.Student] = []
    skipped: list[str] = []
    errors: list[dict[str, object]] = []

    existing_pinyins = set(db.scalars(select(models.Student.pinyin)).all())
    pending_pinyins: set[str] = set()

    for index, row in enumerate(rows, start=1):
        raw = raw_payloads[index - 1]["raw"]
        name = (row.get("name") or "").strip()
        pinyin = (row.get("pinyin") or "").strip().lower()
        if not name or not pinyin:
            errors.append({"row": index, "message": "缺少姓名或拼音", "raw": raw})
            continue
        if " " in pinyin:
            errors.append({"row": index, "message": "拼音唯一标识不能包含空格", "raw": raw})
            continue
        if pinyin in existing_pinyins or pinyin in pending_pinyins:
            skipped.append(f"{name} ({pinyin})")
            continue
        student = models.Student(
            name=name,
            pinyin=pinyin,
            active=_parse_active(row.get("active")),
            note=(row.get("note") or None),
        )
        db.add(student)
        created.append(student)
        pending_pinyins.add(pinyin)

    db.commit()
    for student in created:
        db.refresh(student)

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


@router.put("/{student_id}", response_model=StudentRead)
def update_student(student_id: int, payload: StudentUpdate, db: Session = Depends(get_db)) -> models.Student:
    student = get_student_or_404(db, student_id)
    updates = payload.model_dump(exclude_unset=True)
    if "pinyin" in updates:
        ensure_unique_pinyin(db, updates["pinyin"], exclude_student_id=student_id)
    for key, value in updates.items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    student = get_student_or_404(db, student_id)
    if student_has_history(db, student_id):
        student.active = False
        db.commit()
        return {"message": "该学生已有历史记录，已改为不参与抽取以保留历史数据"}
    db.delete(student)
    db.commit()
    return {"message": "学生已删除"}
