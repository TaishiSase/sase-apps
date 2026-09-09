var db              = null;
var cfg             = null;
var isAuthenticated = false;
var loginMember     = null;
const BIRTHDAY = new Date('2024-02-19T00:00:00');

var listViewMode   = 'timeline'; // 'timeline' | 'grid'
var _postMap       = {};         // id → post オブジェクト
var currentPopupId = null;

// ===== Supabase =====
async function initSupabase(config) {
  const { createClient } = window.supabase;
  db = createClient(config.supabaseUrl, config.supabaseKey);
 if(!(await FamilyAccount.requireSession(db)))return;
}

// ===== 認証 =====
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  isAuthenticated = !!session;
  updateAuthUI();
  goToPage('today');
}

function updateAuthUI() {
  const postBtn = document.querySelector('.bnav-btn[data-page="post"]');
  const hdrBtn  = document.getElementById('authHeaderBtn');
  if (isAuthenticated) {
    postBtn.style.display = '';
    hdrBtn.textContent    = 'ログアウト';
    hdrBtn.classList.add('logged-in');
    hdrBtn.onclick = signOut;
  } else {
    postBtn.style.display = 'none';
    hdrBtn.textContent    = '🔑';
    hdrBtn.classList.remove('logged-in');
    hdrBtn.onclick = showLoginModal;
  }
}

function showLoginModal() {
  loginMember = null;
  document.getElementById('loginPwInput').value = '';
  document.getElementById('loginError').textContent = '';
  document.querySelectorAll('.login-member-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('loginModal').classList.remove('hidden');
}
function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
}

async function handleLogin() {
  const errEl = document.getElementById('loginError');
  if (!loginMember) { errEl.textContent = 'パパかママを選んでください'; return; }
  const pw    = document.getElementById('loginPwInput').value.trim();
  const email = loginMember === 'papa' ? cfg.papaEmail : cfg.mamaEmail;
  const btn   = document.getElementById('loginSubmitBtn');
  btn.disabled    = true;
  btn.textContent = '確認中…';
  const { error } = await db.auth.signInWithPassword({ email, password: pw });
  btn.disabled    = false;
  btn.textContent = 'ログイン';
  if (error) { errEl.textContent = 'パスワードが違います'; return; }
  isAuthenticated = true;
  closeLoginModal();
  updateAuthUI();
}

async function signOut() {
  await db.auth.signOut();
  isAuthenticated = false;
  updateAuthUI();
  goToPage('today');
}

// ===== ページ遷移 =====
function goToPage(pageName) {
  if (pageName === 'post' && !isAuthenticated) { showLoginModal(); return; }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.bnav-btn').forEach(function(b) { b.classList.remove('active'); });

  document.getElementById(pageName + 'Page').classList.add('active');
  const btn = document.querySelector('.bnav-btn[data-page="' + pageName + '"]');
  if (btn) btn.classList.add('active');

  if (pageName === 'list')           { albumPhotos=[]; albumHasMore=true; loadAllPhotos(); }
  else if (pageName === 'favorites') loadFavorites();
  else if (pageName === 'today')     loadTodayPhoto();
}

// ===== 日付・季節 =====
function getTodayDate() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function getWeekNumber(date) {
  const first  = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  return Math.ceil((date.getDate() + offset) / 7);
}

function getSeason(dateStr) {
  const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
  if (m >= 3 && m <= 5)  return { name: 'spring', color: '#FF8FAB', emoji: '🌸', bg: '#FFF0F5' };
  if (m >= 6 && m <= 8)  return { name: 'summer', color: '#45B7D1', emoji: '☀️',  bg: '#EEF8FF' };
  if (m >= 9 && m <= 11) return { name: 'autumn', color: '#FF8C42', emoji: '🍂', bg: '#FFF5EE' };
  return                         { name: 'winter', color: '#7EB8D4', emoji: '❄️',  bg: '#EEF6FF' };
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== 年齢計算 =====
function getAge(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let years  = d.getFullYear() - BIRTHDAY.getFullYear();
  let months = d.getMonth()    - BIRTHDAY.getMonth();
  if (d.getDate() < BIRTHDAY.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return { years: years, months: months, total: years * 12 + months };
}

function getAgeStr(dateStr) {
  const a = getAge(dateStr);
  if (a.years === 0 && a.months === 0) return '生後すぐ';
  if (a.years === 0) return a.months + 'ヶ月';
  if (a.months === 0) return a.years + '歳';
  return a.years + '歳' + a.months + 'ヶ月';
}

// 19日チェック：マイルストーン返す（月次・年次）
function getMilestone(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDate() !== 19) return null;
  const a = getAge(dateStr);
  if (a.total === 0) return null;
  if (d.getMonth() === 1 && a.months === 0 && a.years > 0) {
    return { type: 'yearly', label: a.years + '歳のお誕生日！🎂', emoji: '🎂' };
  }
  return { type: 'monthly', label: a.total + 'ヶ月の記念日 🎀', emoji: '🎀' };
}

// ===== 連続記録 =====
function calcStreak(postDates) {
  if (!postDates || postDates.length === 0) return 0;
  const dateSet = new Set(postDates);
  const today = getTodayDate();
  const cur = new Date(today + 'T00:00:00');
  // 今日未投稿なら昨日から数える
  if (!dateSet.has(today)) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (true) {
    const s = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
    if (dateSet.has(s)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ===== 今日のページ =====
async function loadTodayPhoto() {
  const photoEl  = document.getElementById('todayPhoto');
  const infoEl   = document.getElementById('todayInfo');
  const streakEl = document.getElementById('streakBanner');
  const otdEl    = document.getElementById('onThisDay');

  // 初期化
  streakEl.style.display = 'none';
  otdEl.style.display    = 'none';

  try {
    const { data } = await db.from('posts').select('*').eq('post_date', getTodayDate()).single();
    if (!data) {
      photoEl.innerHTML         = '<p class="no-photo">📷<br>未投稿です</p>';
      photoEl.style.borderColor = '';
      infoEl.innerHTML          = '';
    } else {
      _postMap[data.id] = data;
      const s         = getSeason(data.post_date);
      const milestone = getMilestone(data.post_date);
      const ageStr    = getAgeStr(data.post_date);

      photoEl.style.borderColor = milestone
        ? (milestone.type === 'yearly' ? '#FFD700' : '#FFAACC')
        : s.color;
      photoEl.innerHTML =
        '<img src="' + data.image_url + '" alt="今日の写真" onclick="showPhotoPopup(\'' + data.id + '\')">';

      infoEl.innerHTML =
        (milestone ? '<div class="today-milestone-banner">' + milestone.emoji + ' ' + milestone.label + '</div>' : '') +
        '<div class="today-meta">' +
          '<span class="season-badge">' + s.emoji + ' ' + formatDate(data.post_date) + '</span>' +
          '<div class="today-meta-right">' +
            '<span class="age-badge-today">' + ageStr + '</span>' +
            '<button class="fav-btn" onclick="toggleFavorite(\'' + data.id + '\', ' + data.is_favorite + ', \'today\')">' +
              (data.is_favorite ? '⭐' : '☆') +
            '</button>' +
          '</div>' +
        '</div>' +
        '<p class="today-comment">' + esc(data.comment) + '</p>' +
        '<button class="line-share-btn" onclick="shareTodayToLine()">🟢 LINEでシェア</button>';
    }
  } catch (err) {
    console.error('今日の写真エラー:', err);
  }

  // ストリーク & 過去の今日（並行取得）
  loadTodayExtras();
}

async function loadTodayExtras() {
  const streakEl = document.getElementById('streakBanner');
  const otdEl    = document.getElementById('onThisDay');
  try {
    const { data } = await db.from('posts').select('*').order('post_date', { ascending: false });
    if (!data || data.length === 0) return;

    data.forEach(function(p) { _postMap[p.id] = p; });

    // ストリーク
    const streak = calcStreak(data.map(function(p) { return p.post_date; }));
    if (streak >= 2) {
      streakEl.innerHTML =
        '<span class="streak-flame">🔥</span>' +
        '<span class="streak-count">' + streak + '日</span>' +
        '<span class="streak-label">連続投稿中！</span>';
      streakEl.style.display = 'flex';
    }

    // 過去の今日
    const today = new Date(getTodayDate() + 'T00:00:00');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = getTodayDate();
    const sameDayPosts = data.filter(function(p) {
      return p.post_date !== todayStr && p.post_date.slice(5) === mm + '-' + dd;
    });

    if (sameDayPosts.length === 0) return;

    otdEl.style.display = 'block';
    otdEl.innerHTML = '<h3 class="otd-title">📅 過去の今日</h3>';
    sameDayPosts.forEach(function(post) {
      const d = new Date(post.post_date + 'T00:00:00');
      const item = document.createElement('div');
      item.className = 'otd-item';
      item.innerHTML =
        '<img loading="lazy" decoding="async" src="' + post.image_url + '" class="otd-img" onclick="showPhotoPopup(\'' + post.id + '\')">' +
        '<div class="otd-info">' +
          '<div class="otd-year">' + d.getFullYear() + '年</div>' +
          '<div class="otd-age">' + getAgeStr(post.post_date) + '</div>' +
          '<div class="otd-comment">' + esc(post.comment) + '</div>' +
        '</div>';
      otdEl.appendChild(item);
    });
  } catch(e) { /* サイレント失敗 */ }
}

function shareTodayToLine() {
  const todayStr = getTodayDate();
  var post = null;
  Object.values(_postMap).forEach(function(p) { if (p.post_date === todayStr) post = p; });
  if (!post) return;
  const text = '今日のことちゃん ✨\n' + formatDate(post.post_date) + '\n「' + post.comment + '」\n' + post.image_url;
  window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
}

// ===== スケルトン =====
function renderSkeletons(container, count) {
  container.innerHTML = '';
  for (var i = 0; i < count; i++) {
    container.innerHTML +=
      '<div class="skeleton-card">' +
        '<div class="skeleton-img"></div>' +
        '<div class="skeleton-line"></div>' +
        '<div class="skeleton-line short"></div>' +
      '</div>';
  }
}

// ===== 一覧ページ =====
var albumPhotos=[], albumHasMore=true, albumBusy=false, albumMonth='', albumGeneration=0;
async function loadAllPhotos(more){
  var timeline=document.getElementById('photoTimeline'), grid=document.getElementById('gridContainer');
  document.getElementById('timelineContainer').style.display=listViewMode==='grid'?'none':'';
  grid.style.display=listViewMode==='grid'?'':'none';
  document.getElementById('listHint').style.display=listViewMode==='grid'?'none':'';
  var button=document.getElementById('albumMore');
  if(albumBusy)return;
  var generation=albumGeneration;
  if(!albumPhotos.length || more){
    albumBusy=true;button.disabled=true;document.getElementById('albumMonth').disabled=true;button.textContent='読み込み中…';
    try{
      var query=db.from('posts').select('*').order('post_date',{ascending:false}).limit(60);
      if(albumMonth){var parts=albumMonth.split('-').map(Number), last=new Date(parts[0],parts[1],0).getDate();query=query.gte('post_date',albumMonth+'-01').lte('post_date',albumMonth+'-'+last);}
      if(more && albumPhotos.length)query=query.lt('post_date',albumPhotos[albumPhotos.length-1].post_date);
      var r=await query;if(r.error)throw r.error;if(generation!==albumGeneration)return;
      albumPhotos=more?albumPhotos.concat(r.data||[]):r.data||[];albumHasMore=(r.data||[]).length===60;
    }catch(e){document.getElementById('albumStatus').textContent='読み込めませんでした。もう一度お試しください。';button.hidden=false;button.textContent='再試行';return;}
    finally{albumBusy=false;button.disabled=false;document.getElementById('albumMonth').disabled=false;}
  }
  document.getElementById('albumStatus').textContent=albumPhotos.length+' 枚'+(albumHasMore?' · 過去の写真は追加で読み込めます':'');
  albumPhotos.forEach(function(p){_postMap[p.id]=p;});
  if(listViewMode==='grid'){renderGridView(albumPhotos);}
  else{
    var scroller=document.getElementById('timelineContainer'), scrollLeft=scroller.scrollLeft;
    timeline.replaceChildren();var lastMonth=null;
    albumPhotos.forEach(function(post){var month=post.post_date.slice(0,7);if(month!==lastMonth){timeline.appendChild(makeDivider('month',month.replace('-','年')+'月'));lastMonth=month;}var card=makeCard(post,getSeason(post.post_date));card.classList.add('visible');timeline.appendChild(card);});
    scroller.scrollLeft=scrollLeft;
    if(!scroller.dataset.dragReady){enableDragScroll(scroller);scroller.dataset.dragReady='true';}
  }
  if(!albumPhotos.length)(listViewMode==='grid'?grid:timeline).textContent='この期間の写真はまだありません。';
  button.hidden=!albumHasMore;button.textContent='以前の写真を読み込む';
}
async function loadGridView(){return loadAllPhotos();}
async function changeAlbumMonth(){
  if(albumBusy)return;
  albumMonth=document.getElementById('albumMonth').value;albumPhotos=[];albumHasMore=true;albumGeneration++;
  await loadAllPhotos();
}
function movePopup(dir){
  var posts=Object.values(_postMap).sort(function(a,b){return b.post_date.localeCompare(a.post_date);});
  var idx=posts.findIndex(function(p){return p.id===currentPopupId;}), next=posts[idx+dir];if(next)showPhotoPopup(next.id);
}

function renderGridView(data) {
  const container = document.getElementById('gridContainer');
  container.innerHTML = '';

  // 年月ごとにグループ化
  var groups = {}, groupOrder = [];
  data.forEach(function(post) {
    const d   = new Date(post.post_date + 'T00:00:00');
    const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(post);
  });

  groupOrder.forEach(function(month) {
    const section = document.createElement('div');
    section.className = 'grid-month-section';

    const label = document.createElement('h3');
    label.className = 'grid-month-label';
    label.textContent = month;
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'photo-grid';

    groups[month].forEach(function(post) {
      const item = document.createElement('div');
      const milestone = getMilestone(post.post_date);
      item.className = 'grid-item' + (milestone ? ' grid-item-milestone' : '');

      const d = new Date(post.post_date + 'T00:00:00');
      item.innerHTML =
        '<img src="' + post.image_url + '" alt="' + esc(post.comment) + '" onclick="showPhotoPopup(\'' + post.id + '\')">' +
        '<div class="grid-item-date">' + d.getDate() + '日</div>' +
        (milestone ? '<div class="grid-item-milestone-badge">' + milestone.emoji + '</div>' : '');
      grid.appendChild(item);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function toggleListView() {
  listViewMode = listViewMode === 'timeline' ? 'grid' : 'timeline';
  const btn = document.getElementById('viewToggleBtn');
  if (listViewMode === 'grid') {
    btn.textContent = '📜 タイムライン';
  } else {
    btn.textContent = '📅 月別グリッド';
  }
  loadAllPhotos();
}

function makeDivider(type, label) {
  const el = document.createElement('div');
  el.className = 'h-divider ' + type + '-divider';
  el.innerHTML = '<span class="h-divider-label">' + label + '</span><div class="h-divider-line"></div>';
  return el;
}

function makeCard(post, s) {
  const card      = document.createElement('div');
  const milestone = getMilestone(post.post_date);
  const ageStr    = getAgeStr(post.post_date);
  card.className  = 'timeline-card ' + s.name + (milestone ? ' milestone-card' : '');
  card.innerHTML =
    (milestone ? '<div class="milestone-banner">' + milestone.label + '</div>' : '') +
    '<div class="card-header">' +
      '<span class="season-icon">' + s.emoji + '</span>' +
      '<span class="age-badge">' + ageStr + '</span>' +
      '<span class="fav-star" onclick="toggleFavorite(\'' + post.id + '\', ' + post.is_favorite + ', \'list\')">' +
        (post.is_favorite ? '⭐' : '☆') +
      '</span>' +
    '</div>' +
    '<div class="timeline-date">' + formatDate(post.post_date) + '</div>' +
    '<img src="' + post.image_url + '" alt="' + esc(post.comment) + '" class="timeline-image" onclick="showPhotoPopup(\'' + post.id + '\')">' +
    '<div class="timeline-comment">' + esc(post.comment) + '</div>';
  return card;
}

// ===== お気に入りページ =====
async function loadFavorites() {
  const container = document.getElementById('favoritesList');
  container.innerHTML = '';
  const wrapper  = document.createElement('div');
  const tWrapper = document.createElement('div');
  tWrapper.className = 'timeline-container';
  const timeline = document.createElement('div');
  timeline.className = 'photo-timeline';

  renderSkeletons(timeline, 3);
  tWrapper.appendChild(timeline);
  wrapper.appendChild(tWrapper);
  container.appendChild(wrapper);

  try {
    const { data, error } = await db.from('posts').select('*').eq('is_favorite', true).order('post_date', { ascending: false });
    if (error) throw error;

    timeline.innerHTML = '';
    if (!data || data.length === 0) {
      timeline.innerHTML = '<p class="empty-msg">⭐ お気に入りはまだありません</p>';
      return;
    }
    data.forEach(function(post, idx) {
      _postMap[post.id] = post;
      const card = makeCard(post, getSeason(post.post_date));
      card.style.animationDelay = Math.min(idx, 12) * 60 + 'ms';
      timeline.appendChild(card);
    });
    requestAnimationFrame(function() {
      timeline.querySelectorAll('.timeline-card').forEach(function(c) {
        c.classList.add('visible');
      });
    });
    enableDragScroll(tWrapper);
  } catch (err) {
    console.error('お気に入りエラー:', err);
  }
}

// ===== お気に入り切り替え =====
async function toggleFavorite(postId, current, ctx) {
  try {
    const { error } = await db.from('posts')
      .update({ is_favorite: !current, updated_at: new Date() }).eq('id', postId);
    if (error) throw error;

    if (_postMap[postId]) _postMap[postId].is_favorite = !current;
    albumPhotos.forEach(function(post) { if (post.id === postId) post.is_favorite = !current; });

    var stars = document.querySelectorAll('.fav-star, .fav-btn');
    stars.forEach(function(el) {
      if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(postId)) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    });

    if (ctx === 'today')          loadTodayPhoto();
    else if (ctx === 'list')      loadAllPhotos();
    else if (ctx === 'favorites') loadFavorites();
  } catch (err) {
    console.error('お気に入りエラー:', err);
  }
}

// ===== 写真ポップアップ =====
function showPhotoPopup(postId) {
  const post = _postMap[postId];
  if (!post) return;
  currentPopupId = postId;
  document.getElementById('popupImage').src = post.image_url;
  document.getElementById('popupImage').alt=post.comment || 'ことちゃんの写真';
  document.getElementById('popupCaption').textContent=formatDate(post.post_date)+' · '+post.comment;
  document.getElementById('photoPopup').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePhotoPopup() {
  document.getElementById('photoPopup').classList.remove('active');
  document.getElementById('popupImage').src = '';
  document.body.style.overflow = '';
  currentPopupId = null;
}

function sharePopupToLine() {
  const post = _postMap[currentPopupId];
  if (!post) return;
  const text = '今日のことちゃん ✨\n' + formatDate(post.post_date) + '\n「' + post.comment + '」\n' + post.image_url;
  window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
}

// ===== スワイプで閉じる（縦スワイプ） =====
(function() {
  var startY = 0, startX = 0;
  document.getElementById('photoPopup').addEventListener('touchstart', function(e) {
    if(e.touches.length!==1)return;
    startY = e.touches[0].clientY; startX=e.touches[0].clientX;
  }, { passive: true });
  document.getElementById('photoPopup').addEventListener('touchend', function(e) {
    var dy=e.changedTouches[0].clientY-startY, dx=e.changedTouches[0].clientX-startX;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5)movePopup(dx<0?1:-1);
    else if(Math.abs(dy)>80 && Math.abs(dy)>Math.abs(dx)*1.5)closePhotoPopup();
  }, { passive: true });
})();

// ===== 画像圧縮（Canvas, max 1920px, 85% JPEG） =====
async function compressImage(file) {
  return new Promise(function(resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      const MAX = 1920;
      var w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(blob) {
        const name = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ===== HEIC変換 =====
async function convertHEIC(file) {
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (e) { console.error('HEIC変換失敗', e); }
  }
  return file;
}

// ===== アップロード =====
async function uploadPhoto(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = 'public/' + Date.now() + '.' + ext;
  const { error } = await db.storage.from('photos').upload(path, file, { upsert: false });
  if (error) throw error;
  return db.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

async function deleteOldPhoto(url) {
  try {
    const path = url.split('/photos/')[1];
    if (path) await db.storage.from('photos').remove([path]);
  } catch (e) { console.warn('旧画像削除失敗（無視）', e); }
}

// ===== ドラッグスクロール =====
function enableDragScroll(el) {
  if (!el) return;
  var down = false, sx, sl;
  el.addEventListener('mousedown',  function(e) { down = true; sx = e.pageX - el.offsetLeft; sl = el.scrollLeft; el.style.cursor = 'grabbing'; });
  el.addEventListener('mouseleave', function()  { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup',    function()  { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  function(e) { if (!down) return; e.preventDefault(); el.scrollLeft = sl - (e.pageX - el.offsetLeft - sx); });
}

// ===== 写真プレビュー =====
function updatePhotoPreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('previewImage').src = e.target.result;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('fileDropContent').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ===== 初期化 =====
window.addEventListener('load', async function() {

  // 文字数カウント
  document.getElementById('commentInput').addEventListener('input', function(e) {
    document.getElementById('charCount').textContent = e.target.value.length;
  });

  // Supabase 初期化
  try {
    const res = await fetch('config.json');
    cfg       = await res.json();
    await initSupabase(cfg);
  } catch (err) {
    console.error('Supabase初期化エラー:', err);
  }

  // ログインモーダル イベント
  document.getElementById('loginModalBg').addEventListener('click', closeLoginModal);
  document.getElementById('loginModalClose').addEventListener('click', closeLoginModal);
  document.getElementById('loginSubmitBtn').addEventListener('click', handleLogin);
  document.getElementById('loginPwInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.querySelectorAll('.login-member-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      loginMember = this.dataset.member;
      document.querySelectorAll('.login-member-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      document.getElementById('loginPwInput').focus();
    });
  });

  await checkAuth();

  // 写真選択 → プレビュー & 上書き確認
  document.getElementById('photoInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    updatePhotoPreview(file);
    if (!db) return;
    try {
      const { data } = await db.from('posts').select('id').eq('post_date', getTodayDate()).single();
      document.getElementById('overwriteWarning').style.display = data ? 'block' : 'none';
    } catch (_) {}
  });

  // 投稿フォーム
  document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn       = e.target.querySelector('[type="submit"]');
    const errEl     = document.getElementById('postError');
    const successEl = document.getElementById('postSuccess');
    btn.disabled    = true;
    btn.textContent = '投稿中… ✨';
    errEl.textContent       = '';
    successEl.style.display = 'none';

    try {
      // db 再接続
      if (!db) {
        try {
          const r = await fetch('config.json');
          const c = await r.json();
          await initSupabase(c);
        } catch (_) {}
      }
      if (!db) { errEl.textContent = 'データベース接続エラー。ページを再読み込みしてください。'; return; }

      var file = document.getElementById('photoInput').files[0];
      if (!file) { errEl.textContent = '写真を選択してください'; return; }

      const comment = document.getElementById('commentInput').value.trim();
      if (!comment) { errEl.textContent = 'コメントを入力してください'; return; }

      // HEIC変換 → Canvas圧縮
      file = await convertHEIC(file);
      file = await compressImage(file);

      const today = getTodayDate();
      const { data: existing } = await db.from('posts').select('image_url').eq('post_date', today).single();
      const imageUrl = await uploadPhoto(file);

      const { error } = await db.from('posts').upsert(
        { post_date: today, image_url: imageUrl, comment: comment, is_favorite: false, updated_at: new Date() },
        { onConflict: 'post_date' }
      );
      if (error) throw error;

      if (existing && existing.image_url) await deleteOldPhoto(existing.image_url);

      albumPhotos=[];albumHasMore=true;albumGeneration++;
      successEl.style.display = 'block';
      document.getElementById('postForm').reset();
      document.getElementById('charCount').textContent = '0';
      document.getElementById('overwriteWarning').style.display = 'none';
      document.getElementById('photoPreview').style.display = 'none';
      document.getElementById('fileDropContent').style.display = 'flex';

      setTimeout(function() {
        successEl.style.display = 'none';
        goToPage('today');
      }, 2000);

    } catch (err) {
      console.error('投稿エラー:', err);
      errEl.textContent = '投稿に失敗しました: ' + err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = '投稿する ✨';
    }
  });
});

// ポップアップを外側クリック / Esc で閉じる
document.addEventListener('click', function(e) {
  if (e.target === document.getElementById('photoPopup')) closePhotoPopup();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePhotoPopup();
});
