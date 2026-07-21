const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4000);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const TRAVELS_FILE = path.join(DATA_DIR, 'travels.json');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';

const useRemotePersistence = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const useCloudinaryUpload = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!useCloudinaryUpload && req.url.startsWith('/uploads/')) {
      serveUpload(req, res);
      return;
    }

    if (req.url === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        persistence: useRemotePersistence ? 'supabase' : 'local-file',
        mediaStorage: useCloudinaryUpload ? 'cloudinary' : 'local-file'
      });
      return;
    }

    if (req.url === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJson(req);
      await handleLogin(res, body);
      return;
    }

    if (req.url === '/api/auth/register' && req.method === 'POST') {
      const body = await parseJson(req);
      await handleRegister(res, body);
      return;
    }

    if (req.url === '/api/auth/me' && req.method === 'GET') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      sendJson(res, 200, { username: auth.username, role: auth.role });
      return;
    }

    if (req.url === '/api/posts' && req.method === 'GET') {
      const posts = await readPosts();
      sendJson(res, 200, posts.sort((a, b) => b.createdAt - a.createdAt));
      return;
    }

    if (req.url === '/api/posts' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      await createPost(res, body, auth);
      return;
    }

    if (req.url === '/api/travels' && req.method === 'GET') {
      const travels = await readTravels();
      sendJson(res, 200, travels.sort((a, b) => b.createdAt - a.createdAt));
      return;
    }

    if (req.url === '/api/travels' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      await createTravel(res, body, auth);
      return;
    }

    if (req.url.startsWith('/api/travels/') && req.method === 'DELETE') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const travelId = req.url.split('/').pop();
      await deleteTravel(res, travelId, auth);
      return;
    }

    if (req.url.startsWith('/api/posts/') && req.method === 'POST') {
      const auth = getAuthIfAny(req);
      const body = await parseJson(req);
      const parts = req.url.split('/').filter(Boolean);
      const postId = parts[2];
      const action = parts[3];

      if (action === 'like') {
        await toggleLike(res, postId, auth, body);
        return;
      }
      if (action === 'comments') {
        await createComment(res, postId, body, auth);
        return;
      }
    }

    if (req.url.startsWith('/api/posts/') && req.method === 'DELETE') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const postId = req.url.split('/').pop();
      await deletePost(res, postId, auth);
      return;
    }

    if (req.url === '/api/upload' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = await parseJson(req);
      await handleUpload(res, body, auth);
      return;
    }

    sendJson(res, 404, { message: 'Not Found' });
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server Error' });
  }
});

start();

async function start() {
  await bootstrap();
  server.listen(PORT, HOST, () => {
    console.log(`Chestnut backend running at http://${HOST}:${PORT}`);
    console.log(`Persistence=${useRemotePersistence ? 'Supabase' : 'Local File'}, Media=${useCloudinaryUpload ? 'Cloudinary' : 'Local File'}`);
  });
}

async function bootstrap() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  if (!useRemotePersistence) {
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

    return;
  }

  const users = await readUsers();
  if (!users.length) {
    await insertRow('users', { username: 'chestnut', password: 'susususu', role: 'uploader' });
    await insertRow('users', { username: 'admin', password: 'admin123', role: 'admin' });
  }

  const posts = await readPosts();
  if (!posts.length) {
    await insertRow('posts', {
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
    });
  }

  const travels = await readTravels();
  if (!travels.length) {
    await insertRow('travels', {
      id: crypto.randomUUID(),
      place: '杭州西湖',
      country: '中国',
      note: '春天的风很温柔，栗子在湖边散步。',
      lat: 30.247,
      lng: 120.15,
      date: '2026-04-18',
      author: 'chestnut',
      createdAt: Date.now()
    });
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
      if (data.length > 30 * 1024 * 1024) {
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

function getAuthIfAny(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) return null;
  return sessions.get(token);
}

function canPublish(role) {
  return ['uploader', 'admin'].includes(role);
}

async function handleLogin(res, body) {
  const { username, password } = body;
  const users = await readUsers();
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

async function handleRegister(res, body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    sendJson(res, 400, { message: '用户名需为3-20位字母/数字/下划线' });
    return;
  }

  if (!isStrongPassword(password)) {
    sendJson(res, 400, { message: '密码需至少7位，且包含字母和数字' });
    return;
  }

  const users = await readUsers();
  if (users.some(item => item.username === username)) {
    sendJson(res, 409, { message: '用户名已存在' });
    return;
  }

  if (!useRemotePersistence) {
    const nextUsers = [...users, { username, password, role: 'viewer' }];
    writeJson(USERS_FILE, nextUsers);
  } else {
    await insertRow('users', { username, password, role: 'viewer' });
  }
  sendJson(res, 201, { message: '注册成功，请登录' });
}

async function handleUpload(res, body, auth) {
  if (!canPublish(auth.role)) {
    sendJson(res, 403, { message: '无上传权限' });
    return;
  }

  const { name, type, data } = body;
  if (!name || !type || !data) {
    sendJson(res, 400, { message: '缺少上传参数' });
    return;
  }

  if (useCloudinaryUpload) {
    const uploaded = await uploadToCloudinary(data, name);
    sendJson(res, 200, { url: uploaded.secure_url, type: normalizeMediaType(type, name) });
    return;
  }

  const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  const base64 = data.includes(',') ? data.split(',')[1] : data;
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  sendJson(res, 200, { url: `/uploads/${safeName}`, type: normalizeMediaType(type, name) });
}

async function createPost(res, body, auth) {
  if (!canPublish(auth.role)) {
    sendJson(res, 403, { message: '游客仅可浏览，无法发布' });
    return;
  }

  const { title, content, location, topic, media } = body;
  if (!title) {
    sendJson(res, 400, { message: '标题不能为空' });
    return;
  }

  const post = {
    id: crypto.randomUUID(),
    title,
    content: content || '',
    location: location || '',
    topic: topic || '',
    media: normalizeMediaList(media),
    likes: [],
    comments: [],
    author: auth.username,
    createdAt: Date.now()
  };

  await createPostRecord(post);
  sendJson(res, 201, post);
}

async function deletePost(res, postId, auth) {
  const posts = await readPosts();
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

  await deletePostRecord(postId);
  sendJson(res, 200, { message: '删除成功' });
}

async function toggleLike(res, postId, auth, body) {
  const post = await findPostById(postId);
  if (!post) {
    sendJson(res, 404, { message: '内容不存在' });
    return;
  }

  const actorName = resolveActorName(auth, body);

  const likes = Array.isArray(post.likes) ? post.likes : [];
  const hasLiked = likes.includes(actorName);
  post.likes = hasLiked ? likes.filter(name => name !== actorName) : [...likes, actorName];

  await updatePostRecord(post.id, { likes: post.likes });
  sendJson(res, 200, { likes: post.likes, liked: post.likes.includes(actorName), actorName });
}

async function createComment(res, postId, body, auth) {
  const { content } = body;
  if (!content || !String(content).trim()) {
    sendJson(res, 400, { message: '评论不能为空' });
    return;
  }

  const post = await findPostById(postId);
  if (!post) {
    sendJson(res, 404, { message: '内容不存在' });
    return;
  }

  const comment = {
    id: crypto.randomUUID(),
    author: resolveActorName(auth, body),
    content: String(content).trim(),
    createdAt: Date.now()
  };

  const comments = Array.isArray(post.comments) ? post.comments : [];
  comments.push(comment);
  await updatePostRecord(post.id, { comments });
  sendJson(res, 201, comment);
}

async function createTravel(res, body, auth) {
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

  await createTravelRecord(item);
  sendJson(res, 201, item);
}

async function deleteTravel(res, travelId, auth) {
  const travels = await readTravels();
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

  await deleteTravelRecord(travelId);
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
    '.mov': 'video/quicktime',
    '.webm': 'video/webm'
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filepath).pipe(res);
}

function normalizeMediaList(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map(item => {
      if (typeof item === 'string') {
        return {
          url: item.startsWith('http://') || item.startsWith('https://') || item.startsWith('/uploads/')
            ? item
            : `/uploads/${item}`,
          type: inferMediaType(item)
        };
      }
      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || '').trim();
      if (!url) return null;
      return {
        url,
        type: item.type || inferMediaType(url)
      };
    })
    .filter(Boolean);
}

function inferMediaType(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return 'video/mp4';
  }
  return 'image/jpeg';
}

function normalizeMediaType(type, name) {
  if (type && String(type).trim()) return String(type).trim();
  return inferMediaType(name);
}

function isStrongPassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=.]{7,32}$/.test(password);
}

function resolveActorName(auth, body) {
  if (auth?.username) return auth.username;
  const guestName = String(body?.guestName || '').trim();
  if (/^游客\d{4}$/.test(guestName)) return guestName;
  return `游客${Math.floor(1000 + Math.random() * 9000)}`;
}

async function uploadToCloudinary(data, name) {
  const form = new FormData();
  form.set('file', data);
  form.set('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  form.set('public_id', `${Date.now()}-${name.replace(/\.[^.]+$/, '')}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: form
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary 上传失败');
  }
  return payload;
}

async function readUsers() {
  if (!useRemotePersistence) {
    return readJson(USERS_FILE, []);
  }
  return selectRows('users', '*');
}

async function readPosts() {
  if (!useRemotePersistence) {
    const posts = readJson(POSTS_FILE, []);
    return posts.map(item => ({
      ...item,
      media: normalizeMediaList(item.media),
      likes: Array.isArray(item.likes) ? item.likes : [],
      comments: Array.isArray(item.comments) ? item.comments : []
    }));
  }

  const posts = await selectRows('posts', '*');
  return posts.map(item => ({
    ...item,
    media: normalizeMediaList(item.media),
    likes: Array.isArray(item.likes) ? item.likes : [],
    comments: Array.isArray(item.comments) ? item.comments : []
  }));
}

async function readTravels() {
  if (!useRemotePersistence) {
    return readJson(TRAVELS_FILE, []);
  }
  return selectRows('travels', '*');
}

async function findPostById(id) {
  const posts = await readPosts();
  return posts.find(item => item.id === id) || null;
}

async function createPostRecord(post) {
  if (!useRemotePersistence) {
    const posts = await readPosts();
    posts.push(post);
    writeJson(POSTS_FILE, posts);
    return;
  }
  await insertRow('posts', post);
}

async function updatePostRecord(postId, patch) {
  if (!useRemotePersistence) {
    const posts = await readPosts();
    const index = posts.findIndex(item => item.id === postId);
    if (index === -1) return;
    posts[index] = { ...posts[index], ...patch };
    writeJson(POSTS_FILE, posts);
    return;
  }
  await updateRow('posts', `id=eq.${encodeURIComponent(postId)}`, patch);
}

async function deletePostRecord(postId) {
  if (!useRemotePersistence) {
    const posts = await readPosts();
    writeJson(POSTS_FILE, posts.filter(item => item.id !== postId));
    return;
  }
  await deleteRow('posts', `id=eq.${encodeURIComponent(postId)}`);
}

async function createTravelRecord(item) {
  if (!useRemotePersistence) {
    const travels = await readTravels();
    travels.push(item);
    writeJson(TRAVELS_FILE, travels);
    return;
  }
  await insertRow('travels', item);
}

async function deleteTravelRecord(travelId) {
  if (!useRemotePersistence) {
    const travels = await readTravels();
    writeJson(TRAVELS_FILE, travels.filter(item => item.id !== travelId));
    return;
  }
  await deleteRow('travels', `id=eq.${encodeURIComponent(travelId)}`);
}

async function selectRows(table, select = '*', query = '') {
  const suffix = query ? `&${query}` : '';
  return supabaseRequest(`/rest/v1/${table}?select=${encodeURIComponent(select)}${suffix}`, { method: 'GET' });
}

async function insertRow(table, payload) {
  const rows = await supabaseRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: [payload]
  });
  return rows[0] || null;
}

async function updateRow(table, filterQuery, payload) {
  const rows = await supabaseRequest(`/rest/v1/${table}?${filterQuery}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: payload
  });
  return rows[0] || null;
}

async function deleteRow(table, filterQuery) {
  await supabaseRequest(`/rest/v1/${table}?${filterQuery}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

async function supabaseRequest(pathname, options) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: options.method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) return [];

  const text = await response.text();
  const payload = text ? safeJson(text) : [];
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Supabase 请求失败(${response.status})`);
  }
  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
