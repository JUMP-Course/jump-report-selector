# jump-report-selector

JUMP R 语言课程课堂管理工具，用于维护学生名单、记录课堂汇报和提问历史，并根据历史记录加权随机抽取下一次汇报学生。系统不包含学生端登录、作业上传或复杂权限，重点是轻量、稳定、易部署、抽取逻辑可解释。

核心工作流：

1. 在 Dashboard 维护课程日程。
2. 在学生名单页单个新增或批量导入学生。
3. 在随机抽取页按权重抽出学生。
4. 在抽取历史页设置该学生实际用途：汇报、提问、其他或未处理。
5. 标记为汇报或提问后，系统自动生成对应记录并更新后续权重；改回未处理或其他会撤销自动生成记录。

## 技术栈

- 前端：React + TypeScript + Vite + Ant Design
- 后端：Python + FastAPI
- 数据库：SQLite，使用 SQLAlchemy 2.x，后续可切换 PostgreSQL
- 数据校验：Pydantic
- 部署：uv + systemd + Nginx，也保留 Docker Compose 示例
- 鉴权：共享密码登录 + Bearer Token

## 本地开发运行

复制环境变量：

```bash
cp .env.example .env
```

启动后端：

```bash
cd backend
uv sync
uv run python scripts/init_db.py
uv run python scripts/seed_demo_data.py
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动前端：

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:5173
```

后端 API 文档：

```text
http://localhost:8000/docs
```

## 服务器部署：不使用 Docker

推荐生产部署方式：

- 后端：`uv` 管理依赖，`systemd` 常驻运行 FastAPI。
- 前端：`npm run build` 生成静态文件，Nginx 托管。
- 数据：SQLite 放在独立目录，例如 `/opt/jump-report-selector-data`。

### 1. 安装系统依赖

Ubuntu/Debian：

```bash
sudo apt update
sudo apt install -y nginx git curl nodejs npm
curl -LsSf https://astral.sh/uv/install.sh | sh
```

如果 `uv` 安装在 `~/.local/bin/uv`，建议建一个系统路径软链接：

```bash
sudo ln -s ~/.local/bin/uv /usr/local/bin/uv
```

### 2. 上传或拉取代码

建议代码放在：

```text
/opt/jump-report-selector
```

示例：

```bash
sudo mkdir -p /opt/jump-report-selector
sudo chown -R $USER:$USER /opt/jump-report-selector
cd /opt/jump-report-selector
```

然后上传项目文件，或用 Git 拉取你的仓库。

### 3. 创建独立数据目录

```bash
sudo mkdir -p /opt/jump-report-selector-data
sudo mkdir -p /opt/jump-report-selector-cache/uv
sudo chown -R $USER:$USER /opt/jump-report-selector-data /opt/jump-report-selector-cache
```

这里会保存：

```text
/opt/jump-report-selector-data/jump_course.sqlite3
```

后续更新代码、重新构建前端、重启服务，都不会覆盖这个文件。

### 4. 配置生产环境变量

创建 `/etc/jump-report-selector.env`：

```bash
sudo nano /etc/jump-report-selector.env
```

内容示例：

```env
APP_PASSWORD=换成你的强密码
JWT_SECRET=换成一串很长的随机字符串
DATABASE_URL=sqlite:////opt/jump-report-selector-data/jump_course.sqlite3
CORS_ORIGINS=http://你的服务器IP,https://你的域名
```

如果暂时没有域名，只用服务器 IP 访问，可以写：

```env
CORS_ORIGINS=http://你的服务器IP
```

### 5. 初始化后端

```bash
cd /opt/jump-report-selector/backend
uv sync --frozen
set -a
source /etc/jump-report-selector.env
set +a
uv run python scripts/init_db.py
```

如果需要示例学生数据：

```bash
uv run python scripts/seed_demo_data.py
```

正式使用时通常不需要导入示例数据。

### 6. 配置 systemd 后端服务

复制示例服务文件：

```bash
sudo cp /opt/jump-report-selector/deploy/jump-report-selector-backend.service /etc/systemd/system/jump-report-selector-backend.service
sudo systemctl daemon-reload
sudo systemctl enable jump-report-selector-backend
sudo systemctl start jump-report-selector-backend
```

查看状态和日志：

```bash
sudo systemctl status jump-report-selector-backend
sudo journalctl -u jump-report-selector-backend -f
```

后端只监听本机：

```text
http://127.0.0.1:8000
```

公网访问由 Nginx 代理，不需要开放服务器安全组的 `8000` 端口。

### 7. 构建前端

```bash
cd /opt/jump-report-selector/frontend
npm install
npm run build
```

构建产物位于：

```text
/opt/jump-report-selector/frontend/dist
```

### 8. 配置 Nginx

复制非 Docker Nginx 示例：

```bash
sudo cp /opt/jump-report-selector/deploy/nginx.no-docker.conf /etc/nginx/conf.d/jump-report-selector.conf
```

编辑域名或服务器 IP：

```bash
sudo nano /etc/nginx/conf.d/jump-report-selector.conf
```

把：

```nginx
server_name your-domain.example.com;
```

改成你的域名或服务器 IP，例如：

```nginx
server_name _;
```

检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

浏览器访问：

```text
http://你的服务器IP
```

阿里云安全组只需要开放 `80`，如果配置 HTTPS 再开放 `443`。

### 9. 后续更新代码

更新代码不会改动 `/opt/jump-report-selector-data` 里的 SQLite 数据。

```bash
cd /opt/jump-report-selector
git pull

cd backend
uv sync --frozen
sudo systemctl restart jump-report-selector-backend

cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

## Docker Compose 部署（可选）

```bash
cp .env.example .env
docker compose up -d --build
```

访问：

```text
http://localhost:3000
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

SQLite 数据库通过下面的 volume 持久化：

```yaml
volumes:
  - ${DATA_DIR:-./backend/data}:/app/data
```

本地开发默认使用 `./backend/data`。服务器部署建议在 `.env` 中设置 `DATA_DIR=/opt/jump-report-selector-data`，这样代码目录和 SQLite 数据目录分离，后续 `git pull` 或重新构建镜像不会覆盖学生名单和历史记录。

## 阿里云服务器要点（非 Docker）

- 安全组开放 `80`；如果配置 HTTPS，再开放 `443`。
- 不需要开放 `8000`，后端只监听 `127.0.0.1:8000`，由 Nginx 代理 `/api/`。
- 代码建议放在 `/opt/jump-report-selector`。
- 数据库建议放在 `/opt/jump-report-selector-data/jump_course.sqlite3`。
- 环境变量建议放在 `/etc/jump-report-selector.env`，可参考 `deploy/jump-report-selector.env.example`。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_PASSWORD` | 登录共享密码 | `jump2026` |
| `JWT_SECRET` | JWT 签名密钥 | `please-change-this-secret` |
| `DATABASE_URL` | 数据库连接；非 Docker 生产建议用绝对路径 | `sqlite:///./data/jump_course.sqlite3` |
| `CORS_ORIGINS` | 允许访问 API 的前端地址 | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000` |
| `DATA_DIR` | 仅 Docker Compose 使用的宿主机数据目录 | `./backend/data` |

修改 `.env` 中的 `APP_PASSWORD`、`JWT_SECRET`、`DATABASE_URL` 或 `CORS_ORIGINS` 后，需要重启后端服务才会生效。

## 数据库备份和恢复

备份 SQLite：

```bash
mkdir -p /opt/jump-report-selector-backup
cp /opt/jump-report-selector-data/jump_course.sqlite3 /opt/jump-report-selector-backup/jump_course_$(date +%F).sqlite3
```

恢复 SQLite：

```bash
sudo systemctl stop jump-report-selector-backend
cp /opt/jump-report-selector-backup/jump_course_YYYY-MM-DD.sqlite3 /opt/jump-report-selector-data/jump_course.sqlite3
sudo systemctl start jump-report-selector-backend
```

## 抽取规则解释

进入抽取池的学生必须处于 active 状态，且不在本次手动排除名单中。同一次抽取不放回，同一个学生不会重复出现。

基础权重：

- 有效汇报次数为 0：`10`
- 有效汇报次数为 1：`2`
- 有效汇报次数大于等于 2：`0.5`

提问调节：

```python
question_factor = max(0.4, 1 - 0.08 * question_count)
```

冷却机制：

```python
cooldown_factor = 0.2  # 上一节课刚有效汇报过
cooldown_factor = 1    # 否则
```

最终权重：

```python
weight = max(base_weight * question_factor * cooldown_factor, 0.01)
```

从第 10 次课开始，如果仍有学生尚未有效汇报，系统会在 Dashboard 和随机抽取页面提示；第 11 次课开始额外提示建议优先抽取尚未汇报学生。

新版抽取页面只设置“抽取人数”，不再把抽取结果预先分成课前预抽、现场快抽和备选。抽取本身只代表“抽中了这个学生”；抽中后具体做了什么，需要在“抽取历史”里设置：

- `未处理`：不生成汇报或提问记录，不影响权重。
- `做了汇报`：自动生成一条汇报记录，来源为 `draw`。
- `做了提问`：自动生成一条提问记录，来源为 `draw`。
- `其他`：记录备注，但不生成汇报或提问记录。

如果把抽取历史从“做了汇报/提问”改回“未处理/其他”，系统会删除对应自动生成记录，后续权重也会随之恢复。

## 批量导入学生

学生名单页支持批量导入 CSV/TSV 文本。推荐格式：

```csv
name,pinyin,active,note
张三,zhangsan,true,
李四,lisi,true,班长
```

也支持无表头两列：

```csv
张三,zhangsan
李四,lisi
```

`pinyin` 是唯一标识，重复时会跳过并在导入结果里提示。

## 课程日程

Dashboard 中可以维护课程日程，包括课次、日期、标题和备注。系统只做精确匹配：如果今天日期正好等于某次课程日期，新增汇报、提问和抽取时会自动填入该课次和日期；如果今天没有匹配课程，仍需手动填写。

## 常见问题

### 登录密码在哪里改？

非 Docker 部署时，修改 `/etc/jump-report-selector.env` 中的 `APP_PASSWORD`，然后重启后端：

```bash
sudo systemctl restart jump-report-selector-backend
```

本地开发时如果只启动了后端，停止旧进程后重新运行：

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 登录时报 failed to fetch 怎么办？

先确认后端已经启动，并能访问：

```text
http://localhost:8000/api/health
```

开发环境前端会根据当前页面 hostname 自动访问 `:8000` 后端，例如从 `http://127.0.0.1:5173` 打开页面时会请求 `http://127.0.0.1:8000/api`。如果你自定义了前端地址，请把对应 origin 加到 `.env` 的 `CORS_ORIGINS`，然后重启后端。

### 中文 CSV 在 Excel 中乱码怎么办？

导出文件已使用 UTF-8 with BOM。若仍异常，请在 Excel 中通过“数据 -> 自文本/CSV”导入，并选择 UTF-8。

### 容器重建后数据会丢吗？

不会。SQLite 文件保存在宿主机 `backend/data/jump_course.sqlite3`，并挂载到后端容器 `/app/data`。

### 删除学生会删除历史记录吗？

如果学生已有汇报、提问或抽取历史，系统会把该学生标记为不参与抽取，而不是删除历史记录。

## 后续切换 PostgreSQL

当前代码已经通过 `DATABASE_URL` 读取数据库连接，并使用 SQLAlchemy 2.x ORM。后续切换 PostgreSQL 时建议：

1. 安装 PostgreSQL 驱动，例如 `uv add "psycopg[binary]"`。
2. 将 `.env` 中的连接改为：

```text
DATABASE_URL=postgresql+psycopg://user:password@postgres:5432/jump_report_selector
```

3. 在 `docker-compose.yml` 增加 PostgreSQL 服务。
4. 引入 Alembic 管理迁移，替代第一版的 `create_all` 初始化。
