from __future__ import annotations

from datetime import date

from app.schemas import CourseSessionUpdate, QuestionUpdate, ReportUpdate


def test_update_schemas_accept_date_strings() -> None:
    assert QuestionUpdate.model_validate({"date": "2026-06-03", "reporter_id": 1}).date == date(2026, 6, 3)
    assert ReportUpdate.model_validate({"date": "2026-06-03"}).date == date(2026, 6, 3)
    assert CourseSessionUpdate.model_validate({"date": "2026-06-03"}).date == date(2026, 6, 3)


def test_update_date_json_schemas_allow_string_dates() -> None:
    for schema_model in (QuestionUpdate, ReportUpdate, CourseSessionUpdate):
        date_schema = schema_model.model_json_schema()["properties"]["date"]

        assert date_schema != {"default": None, "title": "Date", "type": "null"}
        assert {"format": "date", "type": "string"} in date_schema["anyOf"]
        assert {"type": "null"} in date_schema["anyOf"]
