import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, engine


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成")


if __name__ == "__main__":
    main()
