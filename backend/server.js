const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = '0.0.0.0';
const PORT = 4000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const TRAVELS_FILE = path.join(DATA_DIR, 'travels.json');

const sessions = new Map();

bootstrap();

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url.startsWith('/uploads/')) {
      serveUpload(req, res);
      return;
    }

    if (req.url === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJson(req);
      handleLogin(res, body);
      return;
    }

    if (req.url === '/api/auth/me' && req.method === 'GET') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      sendJson(res, 200, { username: auth.username, role: auth.role });
      return;
    }

    if (req.url === '/api/posts' && req.method === 'GET') {
      const posts = readPosts();
      sendJson(res, 200, posts.sort((a, b) => b.createdAt - a.createdAt));
      return;
    }

    if (req.url === '/api/posts' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      createPost(res, body, auth);
      return;
    }

    if (req.url === '/api/travels' && req.method === 'GET') {
      const travels = readJson(TRAVELS_FILE, []);
      sendJson(res, 200, travels.sort((a, b) => b.createdAt - a.createdAt));
      return;
    }

    if (req.url === '/api/travels' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      createTravel(res, body, auth);
      return;
    }

    if (req.url.startsWith('/api/travels/') && req.method === 'DELETE') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const travelId = req.url.split('/').pop();
      deleteTravel(res, travelId, auth);
      return;
    }

    if (req.url.startsWith('/api/posts/') && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      const parts = req.url.split('/').filter(Boolean);
      const postId = parts[2];
      const action = parts[3];

      if (action === 'like') {
        toggleLike(res, postId, auth);
        return;
      }
      if (action === 'comments') {
        createComment(res, postId, body, auth);
        return;
      }
    }

    if (req.url.startsWith('/api/posts/') && req.method === 'DELETE') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const postId = req.url.split('/').pop();
      deletePost(res, postId, auth);
      return;
    }

    if (req.url === '/api/upload' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      handleUpload(res, body, auth);
      return;
    }

    sendJson(res, 404, { message: 'Not Found' });
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server Error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chestnut backend running at http://${HOST}:${PORT}`);
});

function bootstrap() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    const users = [
      { username: 'chestnut', password: 'susususu', role: 'uploader' },
      { username: 'admin', password: 'admin123', role: 'admin' }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }

  if (!fs.existsSync(POSTS_FILE)) {
    const seed = [
      {
        id: crypto.randomUUID(),
        title: '和栗子一起晒太阳',
        content: '今天猫猫躺在窗台睡了一个下午，像一颗暖呼呼的小栗子。',
        location: '家里阳台',
        topic: '猫咪日常',
        media: [],
        likes: [],
        comments: [],
        author: 'chestnut',
        createdAt: Date.now()
      }
    ];
    fs.writeFileSync(POSTS_FILE, JSON.stringify(seed, null, 2));
  }

  if (!fs.existsSync(TRAVELS_FILE)) {
    const seed = [
      {
        id: crypto.randomUUID(),
        place: '杭州西湖',
        country: '中国',
        note: '春天的风很温柔，栗子在湖边散步。',
        lat: 30.247,
        lng: 120.15,
        date: '2026-04-18',
        author: 'chestnut',
        createdAt: Date.now()
      }
    ];
    fs.writeFileSync(TRAVELS_FILE, JSON.stringify(seed, null, 2));
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readPosts() {
  const posts = readJson(POSTS_FILE, []);
  return posts.map(item => ({
    ...item,
    likes: Array.isArray(item.likes) ? item.likes : [],
    comments: Array.isArray(item.comments) ? item.comments : []
  }));
}

function savePosts(posts) {
  writeJson(POSTS_FILE, posts);
}

function getToken(req) {
  const raw = req.headers.authorization || '';
  if (!raw.startsWith('Bearer ')) return null;
  return raw.replace('Bearer ', '').trim();
}

function requireAuth(req, res) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) {
    sendJson(res, 401, { message: '请先登录' });
    return null;
  }
  return sessions.get(token);
}

function canPublish(role) {
  return ['uploader', 'admin'].includes(role);
}

function handleLogin(res, body) {
  const { username, password } = body;
  const users = readJson(USERS_FILE, []);
  const found = users.find(u => u.username === username && u.password === password);
  if (!found) {
    sendJson(res, 401, { message: '账号或密码错误' });
    return;
  }

  const token = crypto.randomUUID();
  sessions.set(token, { username: found.username, role: found.role });
  sendJson(res, 200, {
    token,
    username: found.username,
    role: found.role,
    canPublish: canPublish(found.role)
  });
}

function handleUpload(res, body, auth) {
  if (!canPublish(auth.role)) {
    sendJson(res, 403, { message: '无上传权限' });
    return;
  }

  const { name, type, data } = body;
  if (!name || !type || !data) {
    sendJson(res, 400, { message: '缺少上传参数' });
    return;
  }

  const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  const base64 = data.includes(',') ? data.split(',')[1] : data;
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  sendJson(res, 200, { url: `/uploads/${safeName}`, type });
}

function createPost(res, body, auth) {
  if (!canPublish(auth.role)) {
    sendJson(res, 403, { message: '游客仅可浏览，无法发布' });
    return;
  }

  const { title, content, location, topic, media } = body;
  if (!title || !content) {
    sendJson(res, 400, { message: '标题和正文不能为空' });
    return;
  }

  const posts = readPosts();
  const post = {
    id: crypto.randomUUID(),
    title,
    content,
    location: location || '',
    topic: topic || '',
    media: Array.isArray(media) ? media : [],
    likes: [],
    comments: [],
    author: auth.username,
    createdAt: Date.now()
  };
  posts.push(post);
  savePosts(posts);
  sendJson(res, 201, post);
}

function deletePost(res, postId, auth) {
  const posts = readPosts();
  const target = posts.find(item => item.id === postId);
  if (!target) {
    sendJson(res, 404, { message: '内容不存在' });
    return;
  }

  const canDelete = auth.role === 'admin' || target.author === auth.username;
  if (!canDelete) {
    sendJson(res, 403, { message: '仅作者或管理员可删除' });
    return;
  }

  const rest = posts.filter(item => item.id !== postId);
  savePosts(rest);
  sendJson(res, 200, { message: '删除成功' });
}

function toggleLike(res, postId, auth) {
  const posts = readPosts();
  const post = posts.find(item => item.id === postId);
  if (!post) {
    sendJson(res, 404, { message: '内容不存在' });
    return;
  }

  if (post.likes.includes(auth.username)) {
    post.likes = post.likes.filter(name => name !== auth.username);
  } else {
    post.likes.push(auth.username);
  }

  savePosts(posts);
  sendJson(res, 200, { likes: post.likes, liked: post.likes.includes(auth.username) });
}

function createComment(res, postId, body, auth) {
  const { content } = body;
  if (!content || !String(content).trim()) {
    sendJson(res, 400, { message: '评论不能为空' });
    return;
  }

  const posts = readPosts();
  const post = posts.find(item => item.id === postId);
  if (!post) {
    sendJson(res, 404, { message: '内容不存在' });
    return;
  }

  const comment = {
    id: crypto.randomUUID(),
    author: auth.username,
    content: String(content).trim(),
    createdAt: Date.now()
  };

  post.comments.push(comment);
  savePosts(posts);
  sendJson(res, 201, comment);
}

function createTravel(res, body, auth) {
  if (!canPublish(auth.role)) {
    sendJson(res, 403, { message: '无发布权限' });
    return;
  }

  const { place, country, note, lat, lng, date } = body;
  if (!place || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    sendJson(res, 400, { message: '地点、纬度、经度不能为空' });
    return;
  }

  const item = {
    id: crypto.randomUUID(),
    place: String(place).trim(),
    country: String(country || '').trim(),
    note: String(note || '').trim(),
    lat: Number(lat),
    lng: Number(lng),
    date: String(date || ''),
    author: auth.username,
    createdAt: Date.now()
  };

  const travels = readJson(TRAVELS_FILE, []);
  travels.push(item);
  writeJson(TRAVELS_FILE, travels);
  sendJson(res, 201, item);
}

function deleteTravel(res, travelId, auth) {
  const travels = readJson(TRAVELS_FILE, []);
  const target = travels.find(item => item.id === travelId);
  if (!target) {
    sendJson(res, 404, { message: '地点不存在' });
    return;
  }

  const canDelete = auth.role === 'admin' || target.author === auth.username;
  if (!canDelete) {
    sendJson(res, 403, { message: '仅作者或管理员可删除' });
    return;
  }

  writeJson(TRAVELS_FILE, travels.filter(item => item.id !== travelId));
  sendJson(res, 200, { message: '删除成功' });
}

function serveUpload(req, res) {
  const filepath = path.join(__dirname, req.url);
  if (!filepath.startsWith(UPLOAD_DIR) || !fs.existsSync(filepath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filepath).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime'
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filepath).pipe(res);
}
