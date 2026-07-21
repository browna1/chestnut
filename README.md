# 栗子生活馆（前后端分离）

一个偏小红书/短视频动态流风格的个人网站：
- 记录猫咪、生活、旅行内容
- 栗子色系视觉风格
- 游客默认只读
- 仅两个账号可发布图文/视频

## 账号权限

- 上传账号：`chestnut` / `susususu`
- 管理员账号：`admin` / `admin123`
- 注册用户：可登录、点赞、评论（默认角色 `viewer`）
- 游客：不登录也可点赞、评论（昵称自动为 `游客####`）

## 目录结构

```text
chestnut-life/
  backend/
    server.js
    Dockerfile
    supabase-schema.sql
  frontend/
    index.html
    config.js
    styles.css
    main.js
```

## 持久化方案（已实现）

后端已支持两种模式：

- **云持久化模式（推荐）**
  - 结构化数据：`Supabase Postgres`
  - 媒体文件：`Cloudinary`
- **本地兜底模式（开发时）**
  - 数据文件：`backend/data/*.json`
  - 媒体文件：`backend/uploads/*`

Render 免费实例休眠/重启不会影响 Supabase 和 Cloudinary 的数据，因此内容可持久化。

---

## 一次性配置步骤（Render 免费版可用）

### 1) 配置 Supabase（超详细步骤）

1. 打开 `https://supabase.com` 并登录。
2. 点击右上角 `New project`。
3. 选择你的 Organization，填写：
   - `Project name`（例如 `chestnut-life`）
   - `Database Password`（自己保存好）
   - `Region`（选离你近的）
4. 点击 `Create new project`，等待项目初始化（约1-3分钟）。
5. 项目创建完成后，左侧菜单点击 `SQL Editor`。
6. 点击 `New query`。
7. 在你本地打开文件 `backend/supabase-schema.sql`，复制全部内容。
8. 把 SQL 粘贴到 Supabase 的编辑器。
9. 点击右下角 `Run`（或 `Ctrl/Cmd + Enter`）执行。
10. 看到执行成功提示后，左侧点击 `Table Editor`，确认已经有三张表：
    - `users`
    - `posts`
    - `travels`
11. 接着左侧点击 `Project Settings -> API`。
12. 复制并保存以下两个值（后面填 Render 用）：
    - `Project URL` → 对应 `SUPABASE_URL`
    - `service_role` key（不是 anon key）→ 对应 `SUPABASE_SERVICE_ROLE_KEY`

> 注意：`service_role` 权限很高，不要放到前端代码，只能放在 Render 后端环境变量。

### 2) 配置 Cloudinary

1. 创建 Cloudinary 账号。
2. 在 `Settings -> Upload` 创建一个 `Unsigned Upload Preset`。
3. 获取：
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_UPLOAD_PRESET`

### 3) 配置 Render 环境变量

在 Render 的后端服务里新增：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET`

保存后 `Manual Deploy -> Deploy latest commit`。

### 4) 验证是否启用云持久化

访问后端健康检查：

- `https://你的-render域名/api/health`

看到类似：

```json
{
  "ok": true,
  "persistence": "supabase",
  "mediaStorage": "cloudinary"
}
```

---

## 代码更新后如何同步线上

```bash
git add .
git commit -m "update"
git push
```

- 前端：GitHub Pages 会自动部署。
- 后端：Render 会自动部署（或手动 Deploy latest commit）。

---

## 常见问题

### 为什么 GitHub 仓库看不到 `backend/data/*.json` 和 `backend/uploads`？

这些文件是运行时生成的本地文件，不会自动提交到 GitHub，也不适合当成线上持久化方案。

### Render 免费实例休眠会丢数据吗？

如果你用本地文件会有风险；改成 Supabase + Cloudinary 后，实例休眠不影响数据持久性。
