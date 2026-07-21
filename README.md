# 栗子生活馆（前后端分离）

一个偏小红书/短视频动态流风格的个人网站：
- 记录猫咪、生活、旅行内容
- 栗子色系视觉风格
- 游客默认只读
- 仅两个账号可发布图文/视频

## 账号权限

- 上传账号：`chestnut` / `susususu`
- 管理员账号：`admin` / `admin123`
- 游客：不登录状态，仅可浏览内容

> 若需修改账号，请编辑 `backend/data/users.json`（首次启动后自动生成）。

## 目录结构

```text
chestnut-life/
  backend/
    server.js
    Dockerfile
    data/
    uploads/
  frontend/
    index.html
    config.js
    styles.css
    main.js
  .github/workflows/
    deploy-frontend-pages.yml
  render.yaml
```

## 功能清单

- 登录/退出
- 角色鉴权（游客只读）
- 发布图文/视频
- 动态流瀑布卡片展示
- 删除权限（作者本人或管理员）
- 点赞功能（登录用户可点赞/取消）
- 评论功能（登录用户可评论）
- 旅行地图页（旅行地点坐标展示）
- 旅行地点管理（发布者/管理员可新增，作者或管理员可删除）

## 新增接口

- `GET /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/comments`
- `GET /api/travels`
- `POST /api/travels`
- `DELETE /api/travels/:id`

---

## 先解决你遇到的 `Failed to fetch`

这个错误几乎总是因为「前端请求不到后端」。

### 常见原因
- 后端没启动
- 直接双击 `index.html` 用 `file://` 打开（不推荐）
- `frontend/config.js` 里线上 API 地址没改

### 本地正确启动

1) 启动后端（4000）

```bash
cd backend
npm start
```

2) 启动前端静态服务（5500）

```bash
cd frontend
python3 -m http.server 5500
```

3) 浏览器访问

`http://localhost:5500`

---

## 部署到 GitHub（前端）+ Render（后端）

> 说明：GitHub Pages 只能托管静态前端，不能运行 Node 后端。
> 所以前后端分离部署的标准方式是：
> - 前端：GitHub Pages
> - 后端：Render（或 Railway/Fly.io）

### A. 推送到 GitHub

在项目根目录执行：

```bash
git init
git add .
git commit -m "init chestnut-life"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

### B. 开启 GitHub Pages 自动部署

仓库里已包含工作流：
- `.github/workflows/deploy-frontend-pages.yml`

在 GitHub 仓库设置中：
1. 进入 `Settings -> Pages`
2. `Build and deployment` 选择 `GitHub Actions`
3. 推送到 `main` 后自动发布

### C. 部署后端到 Render

仓库里已包含：
- `backend/Dockerfile`
- `render.yaml`

在 Render：
1. `New -> Blueprint`
2. 连接你的 GitHub 仓库
3. 选择该仓库后创建服务
4. 部署成功后拿到后端地址，例如：
   `https://chestnut-life-api.onrender.com`

### D. 绑定前端到线上 API

编辑：`frontend/config.js`

把：

```js
productionApi: 'https://your-backend-domain.onrender.com/api'
```

改成你的真实地址，例如：

```js
productionApi: 'https://chestnut-life-api.onrender.com/api'
```

然后再次提交并推送：

```bash
git add frontend/config.js
git commit -m "config production api"
git push
```

GitHub Pages 会自动更新。

### E. 代码更新后如何同步到线上

每次前后端改动后，统一执行：

```bash
git add .
git commit -m "update site"
git push
```

- 前端同步：`push` 后 GitHub Actions 会自动重新部署 Pages。
- 后端同步：Render 默认会在仓库更新后自动重新部署（`autoDeploy: true`）。
- 若 Render 没自动更新，可在 Render 服务页面点击 `Manual Deploy -> Deploy latest commit`。

---

## Node 环境说明

如果终端里能看到 `node -v`，但脚本启动提示找不到 `node`，通常是 `nvm` 尚未在当前 shell 会话加载。

可先执行：

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
```
