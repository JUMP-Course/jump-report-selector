from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Student(TimestampMixin, Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    pinyin: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    reports: Mapped[list["Report"]] = relationship(back_populates="student")
    questions_asked: Mapped[list["Question"]] = relationship(
        back_populates="questioner",
        foreign_keys="Question.questioner_id",
    )


class Report(TimestampMixin, Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(20), nullable=False)
    draw_history_id: Mapped[Optional[int]] = mapped_column(ForeignKey("draw_history.id"), nullable=True, index=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    student: Mapped[Student] = relationship(back_populates="reports")
    draw_history: Mapped[Optional["DrawHistory"]] = relationship(back_populates="linked_report")


class Question(TimestampMixin, Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    questioner_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    reporter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"), nullable=True, index=True)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)
    question_source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    draw_history_id: Mapped[Optional[int]] = mapped_column(ForeignKey("draw_history.id"), nullable=True, index=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    questioner: Mapped[Student] = relationship(
        back_populates="questions_asked",
        foreign_keys=[questioner_id],
    )
    reporter: Mapped[Optional[Student]] = relationship(foreign_keys=[reporter_id])
    draw_history: Mapped[Optional["DrawHistory"]] = relationship(back_populates="linked_question")


class DrawHistory(Base):
    __tablename__ = "draw_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    draw_type: Mapped[str] = mapped_column(String(20), nullable=False)
    action_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    action_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    draw_batch_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    student: Mapped[Student] = relationship()
    linked_report: Mapped[Optional[Report]] = relationship(
        back_populates="draw_history",
        cascade="all, delete-orphan",
        uselist=False,
    )
    linked_question: Mapped[Optional[Question]] = relationship(
        back_populates="draw_history",
        cascade="all, delete-orphan",
        uselist=False,
    )


class CourseSession(TimestampMixin, Base):
    __tablename__ = "course_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
