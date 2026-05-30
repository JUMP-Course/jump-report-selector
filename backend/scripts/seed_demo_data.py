import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models
from app.database import Base, SessionLocal, engine


DEMO_STUDENTS = [
    ("张三", "zhangsan"),
    ("李四", "lisi"),
    ("王五", "wangwu"),
    ("赵六", "zhaoliu"),
    ("钱七", "qianqi"),
    ("孙八", "sunba"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        inserted = 0
        for name, pinyin in DEMO_STUDENTS:
            exists = db.scalar(select(models.Student).where(models.Student.pinyin == pinyin))
            if exists is None:
                db.add(models.Student(name=name, pinyin=pinyin, active=True))
                inserted += 1
        db.commit()
    print(f"示例学生数据已准备，新增 {inserted} 条")


if __name__ == "__main__":
    main()
