from __future__ import annotations

from datetime import date as DateType, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


ReportType = Literal["draw", "self", "pre", "live", "backup"]
ReportSource = Literal["draw", "self"]
QuestionSource = Literal["draw", "manual"]
DrawActionStatus = Literal["pending", "report", "question", "other"]
QuestionType = Literal[
    "数据问题",
    "变量问题",
    "代码问题",
    "图表问题",
    "方法问题",
    "结果解释问题",
    "其他",
]


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StudentBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    pinyin: str = Field(min_length=1, max_length=150)
    active: bool = True
    note: Optional[str] = None

    @field_validator("pinyin")
    @classmethod
    def normalize_pinyin(cls, value: str) -> str:
        normalized = value.strip().lower()
        if " " in normalized:
            raise ValueError("拼音唯一标识不能包含空格")
        return normalized


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    pinyin: Optional[str] = Field(default=None, min_length=1, max_length=150)
    active: Optional[bool] = None
    note: Optional[str] = None

    @field_validator("pinyin")
    @classmethod
    def normalize_optional_pinyin(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if " " in normalized:
            raise ValueError("拼音唯一标识不能包含空格")
        return normalized


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class StudentStats(StudentRead):
    report_count: int
    question_count: int
    last_report: bool
    recently_drawn: bool
    eligible_for_next_draw: bool
    base_weight: float
    question_factor: float
    cooldown_factor: float
    weight: float
    reason: str


class StudentImportRequest(BaseModel):
    text: str = Field(min_length=1)


class StudentImportError(BaseModel):
    row: int
    message: str
    raw: str


class StudentImportResponse(BaseModel):
    created_count: int
    skipped_count: int
    error_count: int
    created: list[StudentRead]
    skipped: list[str]
    errors: list[StudentImportError]


class CourseSessionBase(BaseModel):
    lesson: int = Field(ge=1)
    date: DateType
    title: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = None


class CourseSessionCreate(CourseSessionBase):
    pass


class CourseSessionUpdate(BaseModel):
    lesson: Optional[int] = Field(default=None, ge=1)
    date: Optional[DateType] = None
    title: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = None


class CourseSessionRead(CourseSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ReportBase(BaseModel):
    lesson: int = Field(ge=1)
    date: DateType
    student_id: int
    report_type: ReportType
    draw_history_id: Optional[int] = None
    valid: bool = True
    note: Optional[str] = None


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    lesson: Optional[int] = Field(default=None, ge=1)
    date: Optional[DateType] = None
    student_id: Optional[int] = None
    report_type: Optional[ReportType] = None
    draw_history_id: Optional[int] = None
    valid: Optional[bool] = None
    note: Optional[str] = None


class ReportRead(ReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_name: str
    student_pinyin: str
    created_at: datetime
    updated_at: datetime


class QuestionBase(BaseModel):
    lesson: int = Field(ge=1)
    date: DateType
    questioner_id: int
    reporter_id: Optional[int] = None
    question_type: QuestionType
    question_source: QuestionSource = "manual"
    draw_history_id: Optional[int] = None
    valid: bool = True
    note: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    lesson: Optional[int] = Field(default=None, ge=1)
    date: Optional[DateType] = None
    questioner_id: Optional[int] = None
    reporter_id: Optional[int] = None
    question_type: Optional[QuestionType] = None
    question_source: Optional[QuestionSource] = None
    draw_history_id: Optional[int] = None
    valid: Optional[bool] = None
    note: Optional[str] = None


class QuestionRead(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    questioner_name: str
    questioner_pinyin: str
    reporter_name: Optional[str] = None
    reporter_pinyin: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DrawPreviewRequest(BaseModel):
    lesson: int = Field(ge=1)
    date: DateType
    count: int = Field(default=1, ge=0)
    excluded_student_ids: list[int] = Field(default_factory=list)


class DrawResult(BaseModel):
    order: int
    student_id: int
    name: str
    pinyin: str
    report_count: int
    question_count: int
    last_report: bool
    weight: float
    reason: str


class DrawPreviewResponse(BaseModel):
    batch_id: str
    results: list[DrawResult]
    warnings: list[str]


class DrawSaveRequest(BaseModel):
    batch_id: str
    lesson: int = Field(ge=1)
    date: DateType
    results: list[DrawResult]


class DrawSaveResponse(BaseModel):
    message: str
    saved_count: int


class DrawHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson: int
    date: DateType
    student_id: int
    student_name: str
    student_pinyin: str
    action_status: DrawActionStatus
    action_note: Optional[str] = None
    linked_report_id: Optional[int] = None
    linked_question_id: Optional[int] = None
    weight: float
    reason: str
    draw_batch_id: str
    created_at: datetime


class DrawActionUpdate(BaseModel):
    action_status: DrawActionStatus
    question_type: Optional[QuestionType] = "其他"
    reporter_id: Optional[int] = None
    valid: bool = True
    note: Optional[str] = None


class DashboardResponse(BaseModel):
    total_students: int
    active_students: int
    reported_students: int
    unreported_students: int
    total_valid_questions: int
    never_questioned_students: int
    unreported_list: list[StudentRead]
    never_questioned_list: list[StudentRead]
    recent_draws: list[DrawHistoryRead]
    course_sessions: list[CourseSessionRead]
    today_session: Optional[CourseSessionRead] = None
    warnings: list[str]
