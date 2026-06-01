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
- 部署：uv + systemd + Nginx；前端推荐本地预编译后上传
- 鉴权：共享密码登录 + Bearer Token

## 本地开发运行

【本地电脑】复制本地开发环境变量：

```bash
cp .env.example .env
```

这个根目录 `.env` 只用于本地开发。生产服务器使用 `/etc/jump-report-selector.env`，不要直接上传本地 `.env`。

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

## 部署总览

生产部署推荐路线是：

- 后端始终在服务器运行，使用 `uv + systemd`。
- Nginx 始终在服务器运行，托管前端静态文件，并把 `/api/` 代理到后端。
- 前端推荐在本地电脑预编译，只把生成的 `frontend/dist` 上传到服务器。
- SQLite 数据保存在服务器独立目录，更新代码或上传前端时不要覆盖它。

路径分工：

| 位置 | 路径 | 用途 |
| --- | --- | --- |
| 本地电脑 | `frontend/dist` | 本地构建出来的前端静态文件目录。 |
| 服务器 | `/opt/jump-report-selector` | 服务器上的项目代码目录。 |
| 服务器 | `/opt/jump-report-selector/frontend/dist` | Nginx 实际托管的前端静态文件目录。 |
| 服务器 | `/opt/jump-report-selector/backend` | 后端服务运行目录，和 systemd 配置一致。 |
| 服务器 | `/opt/jump-report-selector-data/jump_course.sqlite3` | 生产 SQLite 数据库文件。 |
| 服务器 | `/etc/jump-report-selector.env` | 生产后端环境变量文件，由 systemd 读取。 |

`.env` 文件分工：

- 本地开发：根目录 `.env` 由 `.env.example` 复制而来，只用于本地开发运行。
- 生产服务器：使用 `/etc/jump-report-selector.env`，不要把本地 `.env` 上传到服务器。
- 修改服务器 `/etc/jump-report-selector.env` 后，需要重启后端服务。

不要上传本地 `node_modules`、`.venv`、`.env` 或 `backend/data` 到服务器。`.venv` 不能可靠地跨操作系统或 CPU 架构复制，后端依赖应在服务器上通过 `uv sync --frozen` 安装。

## 一、服务器：准备后端运行环境

以下命令都在云服务器上执行。

【服务器】安装系统依赖：

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -LsSf https://astral.sh/uv/install.sh | sh
```

【服务器】如果 `uv` 安装在 `~/.local/bin/uv`，建议建一个系统路径软链接：

```bash
sudo ln -s ~/.local/bin/uv /usr/local/bin/uv
```

【服务器】创建项目目录：

```bash
sudo mkdir -p /opt/jump-report-selector
sudo chown -R $USER:$USER /opt/jump-report-selector
cd /opt/jump-report-selector
```

然后把项目代码上传到这个目录，或用 Git 拉取你的仓库。上传代码时不要带本地 `node_modules`、`.venv`、`.env`、`backend/data` 和旧的 `frontend/dist`。

【服务器】创建数据目录和 uv 缓存目录：

```bash
sudo mkdir -p /opt/jump-report-selector-data
sudo mkdir -p /opt/jump-report-selector-cache/uv
sudo chown -R $USER:$USER /opt/jump-report-selector-data /opt/jump-report-selector-cache
```

SQLite 会保存在服务器：

```text
/opt/jump-report-selector-data/jump_course.sqlite3
```

【服务器】创建生产环境变量文件：

```bash
sudo vim /etc/jump-report-selector.env
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

可参考 `deploy/jump-report-selector.env.example`。生产环境变量只放在服务器 `/etc/jump-report-selector.env`，不要直接使用本地开发的 `.env`。

## 二、服务器：启动后端

后端无论前端在哪里构建，都在服务器上运行。

【服务器】安装后端依赖并初始化数据库：

```bash
cd /opt/jump-report-selector/backend
uv sync --frozen
set -a
source /etc/jump-report-selector.env
set +a
uv run python scripts/init_db.py
```

【服务器】如果需要示例学生数据：

```bash
uv run python scripts/seed_demo_data.py
```

正式使用时通常不需要导入示例数据。

【服务器】配置 systemd 后端服务：

```bash
sudo cp /opt/jump-report-selector/deploy/jump-report-selector-backend.service /etc/systemd/system/jump-report-selector-backend.service
sudo systemctl daemon-reload
sudo systemctl enable jump-report-selector-backend
sudo systemctl start jump-report-selector-backend
```

【服务器】查看状态和日志：

```bash
sudo systemctl status jump-report-selector-backend
sudo journalctl -u jump-report-selector-backend -f
```

后端只监听服务器本机：

```text
http://127.0.0.1:8000
```

公网访问由 Nginx 代理，不需要开放服务器安全组的 `8000` 端口。

## 三、本地电脑：构建前端

以下命令都在你的本地电脑执行，不是在服务器执行。本地电脑不需要 `/opt` 路径。

【本地电脑】进入项目根目录后构建前端：

```bash
cd frontend
npm ci
npm run build
cd ..
```

构建完成后，本地电脑会生成：

```text
frontend/dist
```

这个目录是要上传到服务器的前端静态文件。不要上传 `node_modules`。

## 四、本地电脑 -> 服务器：上传前端产物

目标是把本地电脑的 `frontend/dist` 放到服务器的 `/opt/jump-report-selector/frontend/dist`。

方式一：用 `rsync` 直接同步。

【本地电脑 -> 服务器】

```bash
rsync -av --delete frontend/dist/ 用户名@你的服务器IP:/opt/jump-report-selector/frontend/dist/
```

方式二：用 `tar` 和 `scp` 上传压缩包。

【本地电脑】

```bash
tar -czf frontend-dist.tar.gz -C frontend dist
scp frontend-dist.tar.gz 用户名@你的服务器IP:/tmp/frontend-dist.tar.gz
```

【服务器】解压到 Nginx 托管目录：

```bash
mkdir -p /opt/jump-report-selector/frontend
tar -xzf /tmp/frontend-dist.tar.gz -C /opt/jump-report-selector/frontend
```

解压后服务器上应存在：

```text
/opt/jump-report-selector/frontend/dist/index.html
```

## 五、服务器：配置 Nginx

Nginx 在服务器上运行，负责访问前端和转发 API。

【服务器】创建 Nginx 配置：

```bash
sudo vim /etc/nginx/conf.d/jump-report-selector.conf
```

写入下面内容，并把 `server_name` 改成你的域名或服务器 IP：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    root /opt/jump-report-selector/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

如果暂时没有域名，可以写：

```nginx
server_name _;
```

前端根目录是服务器路径：

```text
/opt/jump-report-selector/frontend/dist
```

该配置也会把：

```text
/api/
```

代理到服务器本机后端：

```text
http://127.0.0.1:8000/api/
```

【服务器】检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

浏览器访问：

```text
http://你的服务器IP
```

阿里云安全组只需要开放 `80`；如果配置 HTTPS，再开放 `443`。不需要开放 `8000`。

## 后续更新

### 只更新前端

【本地电脑】重新构建：

```bash
cd frontend
npm ci
npm run build
cd ..
```

【本地电脑 -> 服务器】上传新的前端静态文件：

```bash
rsync -av --delete frontend/dist/ 用户名@你的服务器IP:/opt/jump-report-selector/frontend/dist/
```

【服务器】重载 Nginx：

```bash
sudo systemctl reload nginx
```

### 更新后端

【服务器】拉取或上传新代码后，同步依赖并重启后端：

```bash
cd /opt/jump-report-selector
git pull
cd backend
uv sync --frozen
sudo systemctl restart jump-report-selector-backend
```

更新后端代码不会改动服务器上的 SQLite 数据：

```text
/opt/jump-report-selector-data/jump_course.sqlite3
```

## 环境变量

| 变量 | 说明 | 本地开发默认值 | 生产服务器建议 |
| --- | --- | --- | --- |
| `APP_PASSWORD` | 登录共享密码 | `jump2026` | 换成你的强密码 |
| `JWT_SECRET` | JWT 签名密钥 | `please-change-this-secret` | 换成一串很长的随机字符串 |
| `DATABASE_URL` | 数据库连接 | `sqlite:///./data/jump_course.sqlite3` | `sqlite:////opt/jump-report-selector-data/jump_course.sqlite3` |
| `CORS_ORIGINS` | 允许访问 API 的前端地址 | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000` | `http://你的服务器IP,https://你的域名` |

本地开发时，根目录 `.env` 用于 `uv run uvicorn ...` 这类本地命令。生产服务器上，systemd 读取 `/etc/jump-report-selector.env`。

【服务器】修改生产环境变量后，需要重启后端：

```bash
sudo systemctl restart jump-report-selector-backend
```

## 数据库备份和恢复

【服务器】备份 SQLite：

```bash
mkdir -p /opt/jump-report-selector-backup
cp /opt/jump-report-selector-data/jump_course.sqlite3 /opt/jump-report-selector-backup/jump_course_$(date +%F).sqlite3
```

【服务器】恢复 SQLite：

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

生产部署时，修改服务器 `/etc/jump-report-selector.env` 中的 `APP_PASSWORD`，然后重启后端：

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

### 删除学生会删除历史记录吗？

如果学生已有汇报、提问或抽取历史，系统会把该学生标记为不参与抽取，而不是删除历史记录。

## 后续切换 PostgreSQL

当前代码已经通过 `DATABASE_URL` 读取数据库连接，并使用 SQLAlchemy 2.x ORM。后续切换 PostgreSQL 时建议：

1. 安装 PostgreSQL 驱动，例如 `uv add "psycopg[binary]"`。
2. 将生产环境的 `DATABASE_URL` 改为：

```text
DATABASE_URL=postgresql+psycopg://user:password@postgres:5432/jump_report_selector
```

1. 在服务器上准备 PostgreSQL 数据库和账号。
2. 引入 Alembic 管理迁移，替代第一版的 `create_all` 初始化。
