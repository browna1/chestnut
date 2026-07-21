const API = window.__CHESTNUT_CONFIG__?.apiBase || 'http://localhost:4000/api';
const API_ORIGIN = new URL(API).origin;

const state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  role: localStorage.getItem('role') || 'guest'
};

const viewerState = document.getElementById('viewerState');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const goFeedBtn = document.getElementById('goFeedBtn');
const goTravelBtn = document.getElementById('goTravelBtn');

const feedPage = document.getElementById('feedPage');
const travelPage = document.getElementById('travelPage');

const publishSection = document.getElementById('publishSection');
const publishBtn = document.getElementById('publishBtn');
const refreshBtn = document.getElementById('refreshBtn');
const feed = document.getElementById('feed');

const travelPublishSection = document.getElementById('travelPublishSection');
const travelRefreshBtn = document.getElementById('travelRefreshBtn');
const publishTravelBtn = document.getElementById('publishTravelBtn');
const travelMap = document.getElementById('travelMap');
const travelList = document.getElementById('travelList');

const loginDialog = document.getElementById('loginDialog');
const confirmLoginBtn = document.getElementById('confirmLoginBtn');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');

let currentPage = 'feed';

syncView();
loadPosts();
loadTravels();

loginBtn.addEventListener('click', () => loginDialog.showModal());
cancelLoginBtn.addEventListener('click', () => loginDialog.close());
logoutBtn.addEventListener('click', logout);
confirmLoginBtn.addEventListener('click', login);
publishBtn.addEventListener('click', publishPost);
refreshBtn.addEventListener('click', loadPosts);
goFeedBtn.addEventListener('click', () => switchPage('feed'));
goTravelBtn.addEventListener('click', () => switchPage('travel'));
travelRefreshBtn.addEventListener('click', loadTravels);
publishTravelBtn.addEventListener('click', publishTravel);

function syncView() {
  const isAuth = Boolean(state.token);
  const canPublish = ['uploader', 'admin'].includes(state.role);
  viewerState.textContent = isAuth
    ? `当前：${state.username}（${state.role}）`
    : '当前：游客';
  loginBtn.hidden = isAuth;
  logoutBtn.hidden = !isAuth;
  publishSection.hidden = !canPublish;
  travelPublishSection.hidden = !canPublish;
}

function switchPage(name) {
  currentPage = name;
  feedPage.hidden = name !== 'feed';
  travelPage.hidden = name !== 'travel';
}

async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  if (!username || !password) return alert('请输入账号和密码');

  const data = await request('/auth/login', {
    method: 'POST',
    body: { username, password }
  });

  if (!data) return;
  state.token = data.token;
  state.username = data.username;
  state.role = data.role;
  localStorage.setItem('token', state.token);
  localStorage.setItem('username', state.username);
  localStorage.setItem('role', state.role);
  loginDialog.close();
  syncView();
  if (currentPage === 'feed') {
    loadPosts();
  } else {
    loadTravels();
  }
}

function logout() {
  state.token = '';
  state.username = '';
  state.role = 'guest';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  syncView();
  loadPosts();
}

async function publishPost() {
  const title = document.getElementById('titleInput').value.trim();
  const content = document.getElementById('contentInput').value.trim();
  const location = document.getElementById('locationInput').value.trim();
  const topic = document.getElementById('topicInput').value.trim();
  const mediaInput = document.getElementById('mediaInput');

  if (!title) {
    alert('请填写标题');
    return;
  }

  const media = [];
  const files = Array.from(mediaInput.files || []);
  for (const file of files) {
    const base64 = await fileToBase64(file);
    const uploaded = await request('/upload', {
      method: 'POST',
      body: { name: file.name, type: file.type, data: base64 },
      auth: true
    });
    if (!uploaded) return;
    media.push(uploaded);
  }

  const post = await request('/posts', {
    method: 'POST',
    body: { title, content, location, topic, media },
    auth: true
  });

  if (!post) return;
  ['titleInput', 'contentInput', 'locationInput', 'topicInput'].forEach(id => {
    document.getElementById(id).value = '';
  });
  mediaInput.value = '';
  await loadPosts();
}

async function publishTravel() {
  const place = document.getElementById('travelPlaceInput').value.trim();
  const country = document.getElementById('travelCountryInput').value.trim();
  const date = document.getElementById('travelDateInput').value;
  const lat = document.getElementById('travelLatInput').value;
  const lng = document.getElementById('travelLngInput').value;
  const note = document.getElementById('travelNoteInput').value.trim();

  if (!place || !lat || !lng) {
    alert('地点、纬度、经度必填');
    return;
  }

  const travel = await request('/travels', {
    method: 'POST',
    body: { place, country, date, lat: Number(lat), lng: Number(lng), note },
    auth: true
  });

  if (!travel) return;
  ['travelPlaceInput', 'travelCountryInput', 'travelDateInput', 'travelLatInput', 'travelLngInput', 'travelNoteInput']
    .forEach(id => {
      document.getElementById(id).value = '';
    });
  await loadTravels();
}

async function deletePost(postId) {
  if (!confirm('确认删除这条内容吗？')) return;
  const result = await request(`/posts/${postId}`, {
    method: 'DELETE',
    auth: true
  });
  if (result) {
    loadPosts();
  }
}

async function toggleLike(postId) {
  const result = await request(`/posts/${postId}/like`, {
    method: 'POST',
    auth: true
  });
  if (result) {
    loadPosts();
  }
}

async function commentPost(postId, inputEl) {
  const content = inputEl.value.trim();
  if (!content) return;
  const result = await request(`/posts/${postId}/comments`, {
    method: 'POST',
    body: { content },
    auth: true
  });
  if (result) {
    inputEl.value = '';
    loadPosts();
  }
}

async function deleteTravel(travelId) {
  if (!confirm('确认删除这个旅行地点吗？')) return;
  const result = await request(`/travels/${travelId}`, {
    method: 'DELETE',
    auth: true
  });
  if (result) {
    loadTravels();
  }
}

async function loadPosts() {
  const posts = await request('/posts', { method: 'GET' });
  if (!posts) return;
  feed.innerHTML = '';

  posts.forEach(post => {
    const card = document.createElement('article');
    card.className = 'post';
    const time = new Date(post.createdAt).toLocaleString();
    const canDelete = state.role === 'admin' || state.username === post.author;
    const isLiked = (post.likes || []).includes(state.username);

    card.innerHTML = `
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.author)} · ${time}</p>
      <p>${escapeHtml(post.content)}</p>
      ${post.topic ? `<p class="meta">#${escapeHtml(post.topic)}</p>` : ''}
      ${post.location ? `<p class="meta">📍${escapeHtml(post.location)}</p>` : ''}
      ${renderMedia(post.media)}
      <div class="post-actions">
        <button class="ghost" data-action="like" data-id="${post.id}">${isLiked ? '已点赞' : '点赞'} · ${(post.likes || []).length}</button>
        ${canDelete ? `<button class="ghost" data-action="delete" data-id="${post.id}">删除</button>` : ''}
      </div>
      <div class="comment-list">
        ${renderComments(post.comments)}
      </div>
      ${state.token ? `<div class="comment-form"><input data-comment-input="${post.id}" placeholder="写评论..." /><button data-action="comment" data-id="${post.id}">发送</button></div>` : '<p class="tip">登录后可点赞和评论</p>'}
    `;
    feed.appendChild(card);
  });

  feed.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deletePost(btn.dataset.id));
  });

  feed.querySelectorAll('button[data-action="like"]').forEach(btn => {
    btn.addEventListener('click', () => toggleLike(btn.dataset.id));
  });

  feed.querySelectorAll('button[data-action="comment"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputEl = feed.querySelector(`input[data-comment-input="${btn.dataset.id}"]`);
      if (inputEl) {
        commentPost(btn.dataset.id, inputEl);
      }
    });
  });
}

async function loadTravels() {
  const travels = await request('/travels', { method: 'GET' });
  if (!travels) return;

  travelMap.innerHTML = '';
  travelList.innerHTML = '';

  travels.forEach(item => {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = `${lngToX(item.lng)}%`;
    marker.style.top = `${latToY(item.lat)}%`;

    const label = document.createElement('div');
    label.className = 'marker-label';
    label.style.left = `${lngToX(item.lng)}%`;
    label.style.top = `${latToY(item.lat)}%`;
    label.textContent = item.place;

    travelMap.appendChild(marker);
    travelMap.appendChild(label);

    const canDelete = state.role === 'admin' || state.username === item.author;
    const div = document.createElement('div');
    div.className = 'travel-item';
    div.innerHTML = `
      <p><strong>${escapeHtml(item.place)}</strong> ${item.country ? `· ${escapeHtml(item.country)}` : ''}</p>
      <p class="meta">${escapeHtml(item.author)}${item.date ? ` · ${escapeHtml(item.date)}` : ''}</p>
      <p>${escapeHtml(item.note || '')}</p>
      <p class="meta">纬度 ${item.lat}，经度 ${item.lng}</p>
      ${canDelete ? `<button class="ghost" data-travel-delete="${item.id}">删除地点</button>` : ''}
    `;
    travelList.appendChild(div);
  });

  travelList.querySelectorAll('button[data-travel-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteTravel(btn.dataset.travelDelete));
  });
}

function renderComments(comments = []) {
  if (!comments.length) {
    return '<p class="tip">暂无评论</p>';
  }
  return comments
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(comment => {
      const time = new Date(comment.createdAt).toLocaleString();
      return `<div class="comment-item"><p><strong>${escapeHtml(comment.author)}</strong> <span class="meta">${time}</span></p><p>${escapeHtml(comment.content)}</p></div>`;
    })
    .join('');
}

function renderMedia(items = []) {
  if (!items.length) return '';
  return items
    .map(item => {
      const src = resolveMediaUrl(item);
      const type = getMediaType(item);
      if (type.startsWith('video/')) {
        return `<video class="media" src="${src}" controls></video>`;
      }
      return `<img class="media" src="${src}" alt="post media" />`;
    })
    .join('');
}

function resolveMediaUrl(item) {
  if (!item) return '';
  if (typeof item === 'string') {
    if (item.startsWith('http://') || item.startsWith('https://')) return item;
    if (item.startsWith('/uploads/')) return `${API_ORIGIN}${item}`;
    return `${API_ORIGIN}/uploads/${item}`;
  }

  if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
    return item.url;
  }
  if (item.url && item.url.startsWith('/')) {
    return `${API_ORIGIN}${item.url}`;
  }
  if (item.url) {
    return `${API_ORIGIN}/uploads/${item.url}`;
  }
  return '';
}

function getMediaType(item) {
  if (typeof item === 'object' && item?.type) return item.type;
  const url = typeof item === 'string' ? item : (item?.url || '');
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return 'video/mp4';
  }
  return 'image/jpeg';
}

function latToY(lat) {
  const value = Number(lat);
  return Math.min(100, Math.max(0, ((90 - value) / 180) * 100));
}

function lngToX(lng) {
  const value = Number(lng);
  return Math.min(100, Math.max(0, ((value + 180) / 360) * 100));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function request(path, options) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(`${API}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const data = text ? safeJson(text) : {};
    if (!response.ok) {
      alert(data.message || '请求失败');
      return null;
    }
    return data;
  } catch (error) {
    alert(`网络错误：${error.message}\n\n请确认：\n1) 后端服务是否已启动\n2) API 地址是否配置正确（frontend/config.js）`);
    return null;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
