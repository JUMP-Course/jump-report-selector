# JUMP 课堂管理后端

## 安装 uv

后端使用 `uv` 管理依赖和虚拟环境。若尚未安装：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 安装依赖

```bash
cd backend
uv sync
```

## 初始化数据库

```bash
uv run python scripts/init_db.py
```

插入示例学生：

```bash
uv run python scripts/seed_demo_data.py
```

## 启动 FastAPI

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档地址：

```text
http://localhost:8000/docs
```

## 关键环境变量

- `APP_PASSWORD`：共享登录密码。
- `JWT_SECRET`：JWT 签名密钥，生产环境必须修改。
- `DATABASE_URL`：数据库连接，默认 `sqlite:///./data/jump_course.sqlite3`。
- `CORS_ORIGINS`：允许访问 API 的前端地址，多个地址用英文逗号分隔。默认放行 `localhost` 和 `127.0.0.1` 的前端开发/生产端口。

修改环境变量后需要重启后端服务。

## 兼容 requirements.txt

`requirements.txt` 仅作为兼容参考保留。日常开发、部署和 Docker 构建都以 `pyproject.toml` 和 `uv.lock` 为准。
