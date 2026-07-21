const API = window.__CHESTNUT_CONFIG__?.apiBase || 'http://localhost:4000/api';
const API_ORIGIN = new URL(API).origin;

const state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  role: localStorage.getItem('role') || 'guest',
  guestName: localStorage.getItem('guest_name') || createGuestName()
};

localStorage.setItem('guest_name', state.guestName);

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
let chinaMapChart = null;
let chinaGeoData = null;

const loginDialog = document.getElementById('loginDialog');
const confirmLoginBtn = document.getElementById('confirmLoginBtn');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');
const registerBtn = document.getElementById('registerBtn');

let currentPage = 'feed';

syncView();
loadPosts();
loadTravels();

loginBtn.addEventListener('click', () => loginDialog.showModal());
cancelLoginBtn.addEventListener('click', () => loginDialog.close());
logoutBtn.addEventListener('click', logout);
confirmLoginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);
publishBtn.addEventListener('click', publishPost);
refreshBtn.addEventListener('click', loadPosts);
goFeedBtn.addEventListener('click', async () => {
  switchPage('feed');
  await loadPosts();
});
goTravelBtn.addEventListener('click', async () => {
  switchPage('travel');
  await loadTravels();
});
travelRefreshBtn.addEventListener('click', loadTravels);
publishTravelBtn.addEventListener('click', publishTravel);
window.addEventListener('resize', () => {
  if (chinaMapChart) chinaMapChart.resize();
});

switchPage(currentPage);

function syncView() {
  const isAuth = Boolean(state.token);
  const canPublish = ['uploader', 'admin'].includes(state.role);
  viewerState.textContent = isAuth
    ? `当前：${state.username}（${state.role}）`
    : `当前：${state.guestName}`;
  loginBtn.hidden = isAuth;
  logoutBtn.hidden = !isAuth;
  publishSection.hidden = !canPublish;
  travelPublishSection.hidden = !canPublish;
}

function switchPage(name) {
  currentPage = name;
  feedPage.hidden = name !== 'feed';
  travelPage.hidden = name !== 'travel';
  goFeedBtn.classList.toggle('active-tab', name === 'feed');
  goTravelBtn.classList.toggle('active-tab', name === 'travel');
  if (name === 'travel') {
    setTimeout(() => {
      if (chinaMapChart) chinaMapChart.resize();
    }, 60);
  }
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
  if (currentPage === 'feed') loadPosts();
  if (currentPage === 'travel') loadTravels();
}

async function register() {
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  if (!username || !password) return alert('请输入用户名和密码');

  const data = await request('/auth/register', {
    method: 'POST',
    body: { username, password }
  });
  if (!data) return;
  alert('注册成功，请点击“登录”继续');
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
  const note = document.getElementById('travelNoteInput').value.trim();

  if (!place) {
    alert('请填写省份/城市/区县信息');
    return;
  }

  const resolved = resolveChinaLocation(place);
  if (!resolved) {
    alert('是不是记错地方了？\n请重新填写更准确的省份/城市/区县名称。');
    return;
  }

  const travel = await request('/travels', {
    method: 'POST',
    body: {
      place,
      country,
      date,
      lat: resolved.lat,
      lng: resolved.lng,
      note
    },
    auth: true
  });

  if (!travel) return;
  ['travelPlaceInput', 'travelCountryInput', 'travelDateInput', 'travelNoteInput']
    .forEach(id => { document.getElementById(id).value = ''; });
  await loadTravels();
}

async function deletePost(postId) {
  if (!confirm('确认删除这条内容吗？')) return;
  const result = await request(`/posts/${postId}`, {
    method: 'DELETE',
    auth: true
  });
  if (result) loadPosts();
}

async function toggleLike(postId) {
  const payload = state.token ? {} : { guestName: state.guestName };
  const result = await request(`/posts/${postId}/like`, {
    method: 'POST',
    body: payload,
    auth: Boolean(state.token)
  });
  if (result) loadPosts();
}

async function commentPost(postId, inputEl, parentId = null) {
  const content = inputEl.value.trim();
  if (!content) return;
  const result = await request(`/posts/${postId}/comments`, {
    method: 'POST',
    body: {
      content,
      parentId,
      guestName: state.token ? undefined : state.guestName
    },
    auth: Boolean(state.token)
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
  if (result) loadTravels();
}

async function loadPosts() {
  const posts = await request('/posts', { method: 'GET' });
  if (!posts) return;
  feed.innerHTML = '';

  posts.forEach(post => {
    const card = document.createElement('article');
    card.className = 'post';
    const time = new Date(post.createdAt).toLocaleString();
    const canDelete = state.role === 'admin' || state.username === 'chestnut' || state.username === post.author;
    const actorName = state.token ? state.username : state.guestName;
    const isLiked = (post.likes || []).includes(actorName);

    card.innerHTML = `
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.author)} · ${time}</p>
      ${post.content ? `<p>${escapeHtml(post.content)}</p>` : ''}
      ${post.topic ? `<p class="meta">#${escapeHtml(post.topic)}</p>` : ''}
      ${post.location ? `<p class="meta">📍${escapeHtml(post.location)}</p>` : ''}
      ${renderMedia(post.media)}
      <div class="post-actions">
        <button class="ghost" data-action="like" data-id="${post.id}">${isLiked ? '已点赞' : '点赞'} · ${(post.likes || []).length}</button>
        ${canDelete ? `<button class="ghost" data-action="delete" data-id="${post.id}">删除</button>` : ''}
      </div>
      <div class="comment-list">${renderComments(post.comments, post.id)}</div>
      <div class="comment-form">
        <div class="comment-form-bar">
          <input data-comment-input="${post.id}" placeholder="${state.token ? '写评论...' : `${state.guestName}：写评论...`}" />
          <button data-action="comment" data-id="${post.id}">发送</button>
        </div>
      </div>
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
      if (!inputEl) return;
      const parentId = inputEl.dataset.parentId || null;
      commentPost(btn.dataset.id, inputEl, parentId);
      inputEl.dataset.parentId = '';
    });
  });

  feed.querySelectorAll('button[data-action="reply"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputEl = feed.querySelector(`input[data-comment-input="${btn.dataset.post}"]`);
      if (!inputEl) return;
      inputEl.focus();
      const targetAuthor = btn.dataset.author || 'TA';
      inputEl.value = `回复 ${targetAuthor}：`;
      inputEl.dataset.parentId = btn.dataset.comment;
    });
  });
}

async function loadTravels() {
  const travels = await request('/travels', { method: 'GET' });
  if (!travels) return;

  await renderChinaMap(travels);
  travelList.innerHTML = '';

  travels.forEach(item => {
    const canDelete = state.role === 'admin' || state.username === 'chestnut' || state.username === item.author;
    const div = document.createElement('div');
    div.className = 'travel-item';
    div.innerHTML = `
      <p><strong>${escapeHtml(item.place)}</strong> ${item.country ? `· ${escapeHtml(item.country)}` : ''}</p>
      <p class="meta">${escapeHtml(item.author)}${item.date ? ` · ${escapeHtml(item.date)}` : ''}</p>
      <p>${escapeHtml(item.note || '')}</p>
      <p class="meta">估算省份：${escapeHtml(guessProvince(item.place))}</p>
      <p class="meta">纬度 ${item.lat}，经度 ${item.lng}</p>
      ${canDelete ? `<button class="ghost" data-travel-delete="${item.id}">删除地点</button>` : ''}
    `;
    travelList.appendChild(div);
  });

  travelList.querySelectorAll('button[data-travel-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteTravel(btn.dataset.travelDelete));
  });
}

function renderComments(comments = [], postId, level = 0) {
  if (!comments.length) return '<p class="tip">暂无评论</p>';

  return comments
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(comment => {
      const time = new Date(comment.createdAt).toLocaleString();
      return `
        <div class="comment-item">
          <p><strong>${escapeHtml(comment.author)}</strong> <span class="meta">${time}</span></p>
          <p>${escapeHtml(comment.content)}</p>
          <div class="reply-actions">
            <button class="ghost reply-btn" data-action="reply" data-post="${postId}" data-comment="${comment.id}" data-author="${escapeHtml(comment.author)}">回复</button>
          </div>
          ${comment.replies?.length ? `<div class="comment-children">${renderComments(comment.replies, postId, level + 1)}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function renderMedia(items = []) {
  if (!items.length) return '';
  return items
    .map(item => {
      const src = resolveMediaUrl(item);
      const type = getMediaType(item);
      if (type.startsWith('video/')) return `<video class="media" src="${src}" controls></video>`;
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

  if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) return item.url;
  if (item.url && item.url.startsWith('/')) return `${API_ORIGIN}${item.url}`;
  if (item.url) return `${API_ORIGIN}/uploads/${item.url}`;
  return '';
}

function getMediaType(item) {
  if (typeof item === 'object' && item?.type) return item.type;
  const url = typeof item === 'string' ? item : (item?.url || '');
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) return 'video/mp4';
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

async function renderChinaMap(travels) {
  await renderStaticChinaMap(travels);
}

async function renderStaticChinaMap(travels) {
  if (chinaMapChart) {
    try {
      chinaMapChart.dispose();
    } catch {
      // ignore
    }
    chinaMapChart = null;
  }

  const geo = await getChinaGeoData();
  if (!geo?.features?.length) {
    travelMap.innerHTML = '<p class="tip">地图数据加载失败。</p>';
    return;
  }

  const visitedProvinces = new Set(
    travels
      .map(item => normalizeProvinceName(guessProvince(item.place)))
      .filter(name => name && name !== '未知')
  );

  const projected = projectGeoFeatures(geo.features, 1000, 710, 22);

  const provincePaths = projected.paths.map(item => {
    const active = visitedProvinces.has(normalizeProvinceName(item.name));
    const label = active
      ? `<text class="province-label" x="${item.labelX.toFixed(1)}" y="${item.labelY.toFixed(1)}">${escapeHtml(item.shortName)}</text>`
      : '';
    return `
      <g class="province-group">
        <path class="province-shape ${active ? 'is-active' : ''}" d="${item.path}" />
        ${label}
      </g>
    `;
  }).join('');

  const borderPath = projected.borderPath;

  travelMap.innerHTML = `
    <div class="fallback-map">
      <svg class="china-svg" viewBox="0 0 1000 710" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="china-border" d="${borderPath}" />
        ${provincePaths}
      </svg>
    </div>
  `;
}

async function getChinaGeoData() {
  if (chinaGeoData) return chinaGeoData;
  try {
    const response = await fetch('./china.geo.json');
    if (!response.ok) return null;
    chinaGeoData = await response.json();
    return chinaGeoData;
  } catch {
    return null;
  }
}

function projectGeoFeatures(features, width, height, padding) {
  const coords = [];
  features.forEach(feature => collectCoords(feature.geometry, coords));
  const lngs = coords.map(item => item[0]);
  const lats = coords.map(item => item[1]);

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const xScale = (width - padding * 2) / (maxLng - minLng || 1);
  const yScale = (height - padding * 2) / (maxLat - minLat || 1);
  const scale = Math.min(xScale, yScale);

  const contentWidth = (maxLng - minLng) * scale;
  const contentHeight = (maxLat - minLat) * scale;
  const offsetX = (width - contentWidth) / 2;
  const offsetY = (height - contentHeight) / 2;

  function project(point) {
    const [lng, lat] = point;
    const x = offsetX + (lng - minLng) * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return [x, y];
  }

  const paths = features.map(feature => {
    const polygons = normalizeGeometryToPolygons(feature.geometry);
    const d = polygons.map(rings => rings.map((ring, ringIndex) =>
      ring.map((pt, idx) => {
        const [x, y] = project(pt);
        return `${idx === 0 ? (ringIndex === 0 ? 'M' : 'M') : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ') + ' Z'
    ).join(' ')).join(' ');

    const points = polygons.flat(2);
    const center = averageProjected(points, project);
    const fullName = String(feature.properties?.name || '');
    return {
      name: fullName,
      shortName: shortProvinceName(fullName),
      path: d,
      labelX: center[0],
      labelY: center[1]
    };
  });

  const borderPath = paths.map(item => item.path).join(' ');
  return { paths, borderPath };
}

function collectCoords(geometry, output) {
  if (!geometry) return;
  const polygons = normalizeGeometryToPolygons(geometry);
  polygons.forEach(rings => rings.forEach(ring => ring.forEach(point => output.push(point))));
}

function normalizeGeometryToPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function averageProjected(points, projector) {
  if (!points.length) return [500, 355];
  let totalX = 0;
  let totalY = 0;
  points.forEach(point => {
    const [x, y] = projector(point);
    totalX += x;
    totalY += y;
  });
  return [totalX / points.length, totalY / points.length];
}

function shortProvinceName(name) {
  return String(name || '')
    .replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/g, '')
    .replace(/^内蒙古/, '内蒙古')
    .replace(/^广西/, '广西')
    .replace(/^宁夏/, '宁夏')
    .replace(/^新疆/, '新疆')
    .replace(/^西藏/, '西藏');
}

function normalizeProvinceName(name) {
  return shortProvinceName(name).trim();
}

function guessProvince(place) {
  const text = String(place || '');
  const provinces = ['北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门'];
  const found = provinces.find(name => text.includes(name));
  return found || '未知';
}

function resolveChinaLocation(text) {
  const value = String(text || '').trim();
  if (!value) return null;

  const points = [
    { key: '北京', lat: 39.9042, lng: 116.4074 },
    { key: '上海', lat: 31.2304, lng: 121.4737 },
    { key: '天津', lat: 39.3434, lng: 117.3616 },
    { key: '重庆', lat: 29.5630, lng: 106.5516 },
    { key: '杭州', lat: 30.2741, lng: 120.1551 },
    { key: '西湖', lat: 30.2470, lng: 120.1500 },
    { key: '宁波', lat: 29.8683, lng: 121.5440 },
    { key: '温州', lat: 27.9949, lng: 120.6994 },
    { key: '南京', lat: 32.0603, lng: 118.7969 },
    { key: '苏州', lat: 31.2990, lng: 120.5853 },
    { key: '无锡', lat: 31.4912, lng: 120.3119 },
    { key: '广州', lat: 23.1291, lng: 113.2644 },
    { key: '深圳', lat: 22.5431, lng: 114.0579 },
    { key: '珠海', lat: 22.2707, lng: 113.5767 },
    { key: '佛山', lat: 23.0218, lng: 113.1219 },
    { key: '东莞', lat: 23.0205, lng: 113.7518 },
    { key: '中山', lat: 22.5176, lng: 113.3928 },
    { key: '成都', lat: 30.5728, lng: 104.0668 },
    { key: '武侯', lat: 30.6414, lng: 104.0431 },
    { key: '锦江', lat: 30.5987, lng: 104.0838 },
    { key: '高新', lat: 30.5537, lng: 104.0658 },
    { key: '西安', lat: 34.3416, lng: 108.9398 },
    { key: '长沙', lat: 28.2282, lng: 112.9388 },
    { key: '武汉', lat: 30.5928, lng: 114.3055 },
    { key: '郑州', lat: 34.7466, lng: 113.6254 },
    { key: '青岛', lat: 36.0671, lng: 120.3826 },
    { key: '济南', lat: 36.6512, lng: 117.1201 },
    { key: '厦门', lat: 24.4798, lng: 118.0894 },
    { key: '福州', lat: 26.0745, lng: 119.2965 },
    { key: '昆明', lat: 25.0389, lng: 102.7183 },
    { key: '贵阳', lat: 26.6470, lng: 106.6302 },
    { key: '拉萨', lat: 29.6525, lng: 91.1721 },
    { key: '乌鲁木齐', lat: 43.8256, lng: 87.6168 },
    { key: '呼和浩特', lat: 40.8427, lng: 111.7492 },
    { key: '南宁', lat: 22.8170, lng: 108.3669 },
    { key: '海口', lat: 20.0442, lng: 110.1983 },
    { key: '三亚', lat: 18.2528, lng: 109.5119 },
    { key: '香港', lat: 22.3193, lng: 114.1694 },
    { key: '澳门', lat: 22.1987, lng: 113.5439 },
    { key: '台北', lat: 25.0330, lng: 121.5654 },
    { key: '河北', lat: 38.0371, lng: 114.5315 },
    { key: '山西', lat: 37.8706, lng: 112.5489 },
    { key: '辽宁', lat: 41.8057, lng: 123.4315 },
    { key: '吉林', lat: 43.8171, lng: 125.3235 },
    { key: '黑龙江', lat: 45.8038, lng: 126.5349 },
    { key: '江苏', lat: 32.0617, lng: 118.7632 },
    { key: '浙江', lat: 30.2741, lng: 120.1551 },
    { key: '安徽', lat: 31.8612, lng: 117.2857 },
    { key: '福建', lat: 26.1008, lng: 119.2951 },
    { key: '江西', lat: 28.6829, lng: 115.8582 },
    { key: '山东', lat: 36.6512, lng: 117.1201 },
    { key: '河南', lat: 34.7466, lng: 113.6254 },
    { key: '湖北', lat: 30.5928, lng: 114.3055 },
    { key: '湖南', lat: 28.2282, lng: 112.9388 },
    { key: '广东', lat: 23.1291, lng: 113.2644 },
    { key: '海南', lat: 20.0442, lng: 110.1983 },
    { key: '四川', lat: 30.5728, lng: 104.0668 },
    { key: '贵州', lat: 26.6470, lng: 106.6302 },
    { key: '云南', lat: 25.0389, lng: 102.7183 },
    { key: '陕西', lat: 34.3416, lng: 108.9398 },
    { key: '甘肃', lat: 36.0611, lng: 103.8343 },
    { key: '青海', lat: 36.6171, lng: 101.7782 },
    { key: '台湾', lat: 25.0330, lng: 121.5654 },
    { key: '内蒙古', lat: 40.8427, lng: 111.7492 },
    { key: '广西', lat: 22.8170, lng: 108.3669 },
    { key: '西藏', lat: 29.6525, lng: 91.1721 },
    { key: '宁夏', lat: 38.4872, lng: 106.2309 },
    { key: '新疆', lat: 43.8256, lng: 87.6168 }
  ];

  const hit = points.find(item => value.includes(item.key));
  return hit ? { lat: hit.lat, lng: hit.lng, key: hit.key } : null;
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
  if (options.auth && state.token) headers.Authorization = `Bearer ${state.token}`;

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

function createGuestName() {
  return `游客${Math.floor(1000 + Math.random() * 9000)}`;
}
