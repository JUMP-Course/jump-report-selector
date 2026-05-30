# JUMP 课堂管理前端

## 安装依赖

```bash
cd frontend
npm install
```

## 启动开发服务器

```bash
npm run dev
```

默认访问：

```text
http://localhost:5173
```

## 配置后端 API 地址

开发环境默认请求：

```text
当前页面 hostname + :8000/api
```

例如从 `http://localhost:5173` 打开页面时请求 `http://localhost:8000/api`，从 `http://127.0.0.1:5173` 打开页面时请求 `http://127.0.0.1:8000/api`。

如需修改，可创建 `frontend/.env.local`：

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

生产构建默认使用 `/api`，由 Nginx 代理到后端服务。

## 打包生产版本

```bash
npm run build
```

构建产物位于：

```text
frontend/dist
```
