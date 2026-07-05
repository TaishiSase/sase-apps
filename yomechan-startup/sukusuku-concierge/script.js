const STORAGE_KEY = "sukusuku-concierge-v1";

const categories = [
  ["english", "英語"],
  ["movement", "運動"],
  ["science", "科学"],
  ["craft", "工作"],
  ["music", "音楽"],
  ["conversation", "会話"],
  ["picture_book", "絵本"],
  ["math", "算数"],
  ["nature", "自然遊び"],
  ["social", "社会性"],
  ["routine", "生活習慣"],
  ["emotion", "感情教育"],
  ["food", "食育"]
];

const recommendedResources = [
  {
    title: "Super Simple Songs",
    type: "動画/歌",
    url: "https://supersimple.com/super-simple-songs/",
    note: "英語の歌を親子で短くまねる。",
    keywords: ["英語", "音楽", "歌", "生活習慣"]
  },
  {
    title: "Khan Academy Kids",
    type: "アプリ",
    url: "https://www.khanacademy.org/kids",
    note: "絵本・数・英語を短時間で試す。",
    keywords: ["英語", "算数", "絵本", "読"]
  },
  {
    title: "Duolingo ABC",
    type: "アプリ",
    url: "https://abc.duolingo.com/",
    note: "英語の文字や音に親しむ。",
    keywords: ["英語", "文字", "フォニックス"]
  },
  {
    title: "GoNoodle",
    type: "動画/運動",
    url: "https://www.gonoodle.com/",
    note: "室内で体を動かす短い動画に。",
    keywords: ["運動", "ダンス", "体", "感情"]
  },
  {
    title: "Sesame Street",
    type: "動画",
    url: "https://www.sesamestreet.org/videos",
    note: "英語・会話・社会性を親子で見る。",
    keywords: ["英語", "会話", "社会性", "感情"]
  },
  {
    title: "NASA Kids' Club",
    type: "サイト",
    url: "https://www.nasa.gov/learning-resources/nasa-kids-club/",
    note: "科学や宇宙への興味づけに。",
    keywords: ["科学", "自然", "宇宙"]
  },
  {
    title: "ScratchJr",
    type: "アプリ",
    url: "https://www.scratchjr.org/",
    note: "5歳以上の物語づくり・初歩プログラミングに。",
    keywords: ["科学", "算数", "工作", "プログラミング"]
  }
];

const typeLabels = {
  quick: "すぐできる案",
  creative: "ちょっと工夫する案",
  deep: "親子でじっくり案"
};

const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

const state = loadState();

let db = null;
let session = null;
let currentUser = null;
let activeFamily = null;
let activeMember = null;
let activeChild = null;
let activeProfileId = null;

const authPanel = document.getElementById("authPanel");
const appTabs = Array.from(document.querySelectorAll("[data-app-tab]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const authForm = document.getElementById("authForm");
const authSession = document.getElementById("authSession");
const authStatus = document.getElementById("authStatus");
const authLogout = document.getElementById("authLogout");
const authSubmit = document.getElementById("authSubmit");
const authAlert = document.getElementById("authAlert");
const signupFields = document.getElementById("signupFields");
const syncStatus = document.getElementById("syncStatus");
const familyPanel = document.getElementById("familyPanel");
const familyRoleStatus = document.getElementById("familyRoleStatus");
const familySummaryText = document.getElementById("familySummaryText");
const createFamilyForm = document.getElementById("createFamilyForm");
const createFamilyButton = document.getElementById("createFamilyButton");
const joinFamilyForm = document.getElementById("joinFamilyForm");
const inviteFamilyForm = document.getElementById("inviteFamilyForm");
const inviteResult = document.getElementById("inviteResult");
const profileForm = document.getElementById("profileForm");
const photoInput = document.getElementById("photoInput");
const childPhotoPreview = document.getElementById("childPhotoPreview");
const askForm = document.getElementById("askForm");
const durationField = document.getElementById("durationField");
const logForm = document.getElementById("logForm");
const resultsSection = document.getElementById("resultsSection");
const reflectionContent = document.getElementById("reflectionContent");
const categoryChoices = document.getElementById("categoryChoices");
const profileStatus = document.getElementById("profileStatus");
const askButton = document.getElementById("askButton");
const logEmpty = document.getElementById("logEmpty");
const logHistory = document.getElementById("logHistory");
const selectedSuggestionTitle = document.getElementById("selectedSuggestionTitle");
const plannerForm = document.getElementById("plannerForm");
const plannerButton = document.getElementById("plannerButton");
const plannerBoard = document.getElementById("plannerBoard");
const missionStatus = document.getElementById("missionStatus");

let authMode = "login";

function loadState() {
  const fallback = { profile: {}, suggestions: [], logs: [], currentPlan: null };
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch (_) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function setSyncStatus(text, mode = "local") {
  syncStatus.textContent = text;
  syncStatus.dataset.mode = mode;
}

function showAuthAlert(html = "") {
  if (!authAlert) return;
  authAlert.classList.toggle("hidden", !html);
  authAlert.innerHTML = html;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 20);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 240);
  }, 3200);
}

function buildInviteMessage(invite) {
  const appUrl = `${location.origin}/yomechan-startup/sukusuku-concierge`;
  return [
    "すくすくコンシェルジュの家族招待です。",
    "",
    `ログインメール: ${invite.email}`,
    `招待コード: ${invite.token}`,
    "",
    "使い方:",
    "1. 下のURLを開く",
    "2. 上のメールアドレスで新規登録またはログイン",
    "3. 基本設定の「招待コードで参加」にコードを入力",
    "",
    appUrl
  ].join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function setAuthMode(mode) {
  authMode = mode;
  showAuthAlert("");
  authForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  signupFields.classList.toggle("hidden", mode !== "signup");
  authSubmit.textContent = mode === "signup" ? "新規登録して家族を作る" : "ログインして同期";
}

function roleLabel(role) {
  return role === "parent" ? "編集可能" : "閲覧のみ";
}

function relationLabel(relation) {
  return {
    papa: "パパ",
    mama: "ママ",
    grandparent: "祖父母",
    sibling: "兄弟姉妹",
    relative: "その他親族",
    other: "その他"
  }[relation] || "家族";
}

function makeInviteToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function renderProfilePhoto() {
  const photoData = state.profile?.photoData;
  if (photoData) {
    childPhotoPreview.innerHTML = `<img src="${esc(photoData)}" alt="子どもの顔写真">`;
  } else {
    childPhotoPreview.textContent = "🌱";
  }
}

function readCompressedImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("写真を読み込めませんでした。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("写真を読み込めませんでした。"));
      image.onload = () => {
        const maxSize = 480;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getAgeText(birthDate) {
  if (!birthDate) return "年齢未入力";
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return `${Math.max(months, 0)}か月`;
  return `${years}歳${months}か月`;
}

function renderCategoryChoices() {
  categoryChoices.innerHTML = categories.map(([value, label], index) => `
    <label>
      <input type="checkbox" name="categories" value="${value}" ${index < 3 ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `).join("");
  syncChoiceState(categoryChoices);
}

function syncChoiceState(root = document) {
  root.querySelectorAll(".chip-grid label, .segmented label, .feedback-grid label").forEach((label) => {
    const input = label.querySelector("input");
    if (input) label.classList.toggle("is-checked", input.checked);
  });
}

function switchAppTab(tabName) {
  appTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.appTab === tabName);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  });
}

function updateConsultationControls() {
  const type = askForm?.elements.consultationType?.value || "today_action";
  const needsDuration = type === "today_action";
  durationField?.classList.toggle("hidden", !needsDuration);
  durationField?.parentElement?.classList.toggle("single", !needsDuration);
}

function fillProfileForm() {
  const profile = state.profile || {};
  Object.entries(profile).forEach(([key, value]) => {
    if (profileForm.elements[key]) {
      profileForm.elements[key].value = value || "";
    }
  });
  renderProfilePhoto();
  updateProfileStatus();
}

function updateProfileStatus() {
  const profile = state.profile || {};
  if (profile.name && profile.birthDate) {
    profileStatus.textContent = `${profile.name} / ${getAgeText(profile.birthDate)}`;
  } else {
    profileStatus.textContent = "未保存";
  }
}

function getSelectedCategories() {
  return Array.from(askForm.querySelectorAll('input[name="categories"]:checked'))
    .map((input) => input.value);
}

function getCategoryLabels(values) {
  return values.map((value) => {
    const found = categories.find(([key]) => key === value);
    return found ? found[1] : value;
  });
}

function formatDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

function getWeekStart(dateText = formatDateInputValue()) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatDateInputValue(date);
}

function getPlanStartDate() {
  return plannerForm?.elements.planStartDate?.value || getWeekStart();
}

function getCompletedMissionIds(plan = state.currentPlan) {
  return new Set(plan?.completedMissionIds || []);
}

function buildPayload(formData) {
  const selectedCategories = getSelectedCategories();
  const consultationType = formData.get("consultationType") || "today_action";
  return {
    profile: state.profile,
    consultationType,
    durationType: consultationType === "today_action" ? formData.get("durationType") : "not_needed",
    advisorTone: formData.get("advisorTone"),
    categories: selectedCategories,
    categoryLabels: getCategoryLabels(selectedCategories),
    message: formData.get("message") || "",
    recentLogs: state.logs.slice(-5),
    createdAt: new Date().toISOString()
  };
}

async function initSupabase() {
  if (!window.supabase) {
    setSyncStatus("ローカル保存", "local");
    return;
  }

  try {
    const response = await fetch("/config.json");
    const config = await response.json();
    db = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
    const result = await db.auth.getSession();
    session = result.data.session;
    currentUser = null;
    if (session) {
      try {
        await ensureFreshUser();
      } catch (error) {
        console.warn("Supabase user verification failed:", error);
        await db.auth.signOut({ scope: "local" });
        session = null;
      }
    }
    await refreshAuthState();
  } catch (error) {
    console.warn("Supabase init failed:", error);
    setSyncStatus("ローカル保存", "local");
  }
}

async function ensureFreshUser() {
  if (!db) throw new Error("Supabaseに接続できていません。");

  const userResult = await db.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    currentUser = null;
    throw new Error("ログイン状態を確認できませんでした。もう一度ログインしてください。");
  }

  currentUser = userResult.data.user;
  const sessionResult = await db.auth.getSession();
  session = sessionResult.data.session;
  return currentUser;
}

function toUserFacingError(error) {
  const message = error?.message || String(error || "");
  if (message.includes("row-level security policy")) {
    return "ログイン状態または家族権限の確認で止まりました。ログアウトして再ログインしてから、もう一度お試しください。";
  }
  return message;
}

async function refreshAuthState() {
  if (!db) return;
  if (!currentUser) {
    authForm.classList.remove("hidden");
    authSession.classList.add("hidden");
    familyPanel.classList.add("hidden");
    setSyncStatus("ローカル保存", "local");
    return;
  }

  authForm.classList.add("hidden");
  authSession.classList.remove("hidden");
  authStatus.textContent = `${currentUser.email} で同期中`;
  setSyncStatus("同期中", "online");

  await loadFamilyMembership();
  renderFamilyPanel();
  if (!activeFamily) {
    setSyncStatus("家族未設定", "local");
    return;
  }
  await loadFirstChild();
  await loadRecentLogs();
  await loadCurrentPlan();
}

async function loadFamilyMembership() {
  const memberResult = await db
    .from("family_members")
    .select("id, family_id, role, relation, display_name, families(id, name)")
    .eq("user_id", currentUser.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (memberResult.error) throw memberResult.error;

  if (memberResult.data) {
    activeMember = memberResult.data;
    activeFamily = memberResult.data.families || { id: memberResult.data.family_id, name: "佐瀬家" };
    return;
  }

  activeMember = null;
  activeFamily = null;
}

async function createFamily(name = "佐瀬家", relation = "papa") {
  const user = await ensureFreshUser();

  const familyResult = await db
    .from("families")
    .insert({ name, created_by: user.id })
    .select("id, name")
    .single();

  if (familyResult.error) throw familyResult.error;
  activeFamily = familyResult.data;

  const memberInsert = await db
    .from("family_members")
    .insert({
      family_id: activeFamily.id,
      user_id: user.id,
      display_name: user.email || "parent",
      role: "parent",
      relation,
      status: "active"
    })
    .select("id, family_id, role, relation, display_name")
    .single();

  if (memberInsert.error) throw memberInsert.error;
  activeMember = memberInsert.data;
  renderFamilyPanel();
}

function renderFamilyPanel() {
  if (!currentUser) {
    familyPanel.classList.add("hidden");
    return;
  }

  familyPanel.classList.remove("hidden");
  const isParent = activeMember?.role === "parent";
  createFamilyForm.classList.toggle("hidden", Boolean(activeFamily));
  inviteFamilyForm.classList.toggle("hidden", !activeFamily || !isParent);
  joinFamilyForm.classList.toggle("hidden", Boolean(activeFamily));

  if (!activeFamily) {
    familyRoleStatus.textContent = "家族未設定";
    familySummaryText.textContent = "新しく家庭IDを作るか、家族から共有された招待コードで参加してください。";
    updateEditAccess();
    return;
  }

  familyRoleStatus.textContent = `${relationLabel(activeMember?.relation)} / ${roleLabel(activeMember?.role)}`;
  familySummaryText.textContent = `${activeFamily.name || "家族"} に同期中です。家庭IDは ${activeFamily.id.slice(0, 8)}... です。`;
  updateEditAccess();
}

function updateEditAccess() {
  const canEdit = !activeFamily || activeMember?.role === "parent";
  profileForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = !canEdit;
  });
  askForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = !canEdit;
  });
  logForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = !canEdit;
  });
  plannerForm?.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = !canEdit;
  });
  if (!canEdit) {
    askButton.textContent = "閲覧のみ";
    if (plannerButton) plannerButton.textContent = "閲覧のみ";
  } else if (!askButton.disabled) {
    askButton.textContent = "提案してもらう";
    if (plannerButton && !plannerButton.disabled) plannerButton.textContent = "プランを作る";
  }
}

async function createInvitation(formData) {
  if (!db || !activeFamily || activeMember?.role !== "parent") {
    throw new Error("招待コードを作れるのはパパ/ママ権限の家族だけです。");
  }

  const token = makeInviteToken();
  const email = String(formData.get("inviteEmail") || "").trim().toLowerCase();
  const role = formData.get("inviteRole");
  const relation = formData.get("inviteRelation");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  if (!email) throw new Error("招待するメールを入力してください。");

  const result = await db.from("invitations").insert({
    family_id: activeFamily.id,
    email,
    role,
    relation,
    token,
    expires_at: expiresAt
  }).select("token, email, role, relation, expires_at").single();

  if (result.error) throw result.error;
  return result.data;
}

async function joinFamilyByToken(token) {
  if (!db || !currentUser) throw new Error("先にログインまたは新規登録してください。");
  const normalizedToken = String(token || "").trim().toUpperCase();
  if (!normalizedToken) throw new Error("招待コードを入力してください。");

  const inviteResult = await db
    .from("invitations")
    .select("id, family_id, email, role, relation, token, status")
    .eq("token", normalizedToken)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteResult.error) throw inviteResult.error;
  if (!inviteResult.data) {
    throw new Error("招待コードが見つからないか、ログイン中のメールと一致していません。");
  }

  const invite = inviteResult.data;
  const memberResult = await db.from("family_members").insert({
    family_id: invite.family_id,
    user_id: currentUser.id,
    display_name: currentUser.email || "family",
    role: invite.role,
    relation: invite.relation,
    status: "active"
  });
  if (memberResult.error && memberResult.error.code !== "23505") throw memberResult.error;

  const updateResult = await db
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: currentUser.id,
      accepted_at: new Date().toISOString()
    })
    .eq("id", invite.id);
  if (updateResult.error) throw updateResult.error;

  await loadFamilyMembership();
  renderFamilyPanel();
  await loadFirstChild();
  await loadRecentLogs();
}

async function loadFirstChild() {
  if (!activeFamily) return;
  const childResult = await db
    .from("children")
    .select("id, name, birth_date, gender")
    .eq("family_id", activeFamily.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (childResult.error) throw childResult.error;
  activeChild = childResult.data;

  if (!activeChild) return;

  const profileResult = await db
    .from("child_profiles")
    .select("id, likes, concerns, parent_goals, photo_data")
    .eq("child_id", activeChild.id)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;
  activeProfileId = profileResult.data?.id || null;

  state.profile = {
    name: activeChild.name,
    birthDate: activeChild.birth_date,
    gender: activeChild.gender || "",
    likes: profileResult.data?.likes || "",
    concerns: profileResult.data?.concerns || "",
    goals: profileResult.data?.parent_goals || "",
    photoData: profileResult.data?.photo_data || ""
  };
  saveState();
  fillProfileForm();
}

async function saveProfileToSupabase(profile) {
  if (!db || !currentUser || !activeFamily || activeMember?.role !== "parent") return;

  if (!activeChild) {
    const childResult = await db
      .from("children")
      .insert({
        family_id: activeFamily.id,
        name: profile.name,
        birth_date: profile.birthDate,
        gender: profile.gender || null
      })
      .select("id, name, birth_date, gender")
      .single();
    if (childResult.error) throw childResult.error;
    activeChild = childResult.data;
  } else {
    const childResult = await db
      .from("children")
      .update({
        name: profile.name,
        birth_date: profile.birthDate,
        gender: profile.gender || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", activeChild.id)
      .select("id, name, birth_date, gender")
      .single();
    if (childResult.error) throw childResult.error;
    activeChild = childResult.data;
  }

  const profileRow = {
    child_id: activeChild.id,
    likes: profile.likes || null,
    concerns: profile.concerns || null,
    parent_goals: profile.goals || null,
    photo_data: profile.photoData || null,
    updated_at: new Date().toISOString()
  };

  const profileResult = activeProfileId
    ? await db.from("child_profiles").update(profileRow).eq("id", activeProfileId).select("id").single()
    : await db.from("child_profiles").insert(profileRow).select("id").single();

  if (profileResult.error) throw profileResult.error;
  activeProfileId = profileResult.data.id;
  setSyncStatus("同期済み", "online");
}

async function requestSuggestions(payload) {
  const response = await fetch("/api/sukusuku-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "AI提案の生成に失敗しました。");
  }
  return data;
}

async function requestPlan(payload) {
  const response = await fetch("/api/sukusuku-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "プラン生成に失敗しました。");
  }
  return data;
}

function buildPlanPayload(formData) {
  const selectedCategories = getSelectedCategories();
  return {
    profile: state.profile,
    range: formData.get("planRange") || "week",
    startDate: formData.get("planStartDate") || getWeekStart(),
    intensity: formData.get("planIntensity") || "balanced",
    categories: selectedCategories,
    categoryLabels: getCategoryLabels(selectedCategories),
    message: formData.get("planMessage") || "",
    recentLogs: state.logs.slice(-10),
    currentPlan: state.currentPlan,
    createdAt: new Date().toISOString()
  };
}

function normalizeResource(resource = {}) {
  const url = String(resource.url || "").trim();
  return {
    title: resource.title || "",
    type: resource.type || "なし",
    url: /^https:\/\/[^\s<>"']+$/i.test(url) ? url : "",
    note: resource.note || ""
  };
}

function inferResourceLinks(item = {}) {
  const text = [
    item.title,
    item.aim,
    item.materials,
    ...(Array.isArray(item.skills) ? item.skills : []),
    ...(Array.isArray(item.steps) ? item.steps : [])
  ].filter(Boolean).join(" ");
  return recommendedResources
    .filter((resource) => resource.keywords.some((keyword) => text.includes(keyword)))
    .slice(0, 2)
    .map(({ keywords, ...resource }) => resource);
}

function normalizePlan(data, payload = {}) {
  const range = data.range === "month" || payload.range === "month" ? "month" : "week";
  const startDate = payload.startDate || data.startDate || getWeekStart();
  const missions = (data.missions || []).slice(0, range === "month" ? 12 : 7).map((mission, index) => {
    const date = mission.date || addDays(startDate, range === "month" ? Math.floor(index / 3) * 7 + (index % 3) * 2 : index);
    const dateObj = new Date(`${date}T00:00:00`);
    return {
      id: String(mission.id || `${range}-${index + 1}`).replace(/[^a-zA-Z0-9-]/g, "-"),
      date,
      dayLabel: mission.dayLabel || dayLabels[dateObj.getDay()],
      title: mission.title || "親子ミッション",
      category: mission.category || "会話",
      duration: mission.duration || "5分",
      aim: mission.aim || "",
      steps: Array.isArray(mission.steps) ? mission.steps : String(mission.steps || "").split("\n").filter(Boolean),
      successCriteria: mission.successCriteria || "親子で一度試せたら達成",
      parentPhrase: mission.parentPhrase || "",
      evidenceTag: mission.evidenceTag || "NAEYC型",
      resource: normalizeResource(mission.resource)
    };
  });

  return {
    id: data.id || crypto.randomUUID(),
    range,
    startDate,
    summary: data.summary || "今のプロフィールと記録から、続けやすいミッションに整理しました。",
    theme: data.theme || (range === "month" ? "今月の育ちミッション" : "今週の育ちミッション"),
    parentGuide: data.parentGuide || "完璧にこなすより、子どもの反応がよかったものを次につなげます。",
    missions,
    completedMissionIds: data.completedMissionIds || [],
    createdAt: data.createdAt || new Date().toISOString()
  };
}

async function savePlanToSupabase(plan) {
  if (!db || !currentUser || !activeFamily || !activeChild || activeMember?.role !== "parent") return false;
  const result = await db.from("weekly_plans").upsert({
    family_id: activeFamily.id,
    child_id: activeChild.id,
    week_start: getWeekStart(plan.startDate),
    plan_json: plan,
    created_by: currentUser.id
  }, { onConflict: "child_id,week_start" });
  if (result.error) throw result.error;
  return true;
}

async function loadCurrentPlan() {
  if (!db || !activeFamily || !activeChild) {
    renderPlanner();
    return;
  }

  const result = await db
    .from("weekly_plans")
    .select("id, plan_json, week_start, created_at")
    .eq("family_id", activeFamily.id)
    .eq("child_id", activeChild.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data?.plan_json) {
    state.currentPlan = normalizePlan({
      ...result.data.plan_json,
      id: result.data.id
    }, { startDate: result.data.plan_json.startDate || result.data.week_start });
    saveState();
  }
  renderPlanner();
}

async function saveSuggestionsToSupabase(payload, data) {
  if (!db || !currentUser || !activeFamily || !activeChild || activeMember?.role !== "parent") return null;

  const consultationResult = await db
    .from("consultations")
    .insert({
      family_id: activeFamily.id,
      child_id: activeChild.id,
      user_id: currentUser.id,
      consultation_type: payload.consultationType,
      duration_type: payload.durationType,
      categories: payload.categoryLabels || [],
      advisor_tone: payload.advisorTone,
      user_message: payload.message || null
    })
    .select("id")
    .single();

  if (consultationResult.error) throw consultationResult.error;

  const rows = normalizeSuggestions(data.suggestions).map((item) => ({
    consultation_id: consultationResult.data.id,
    title: item.title,
    suggestion_type: item.type,
    aim: item.aim,
    materials: item.materials,
    steps: item.steps,
    phrases: item.phrases,
    skills: item.skills,
    fallback: item.fallback,
    raw_response: item
  }));

  const suggestionResult = await db
    .from("suggestions")
    .insert(rows)
    .select("id, title, suggestion_type, aim, materials, steps, phrases, skills, fallback, raw_response");

  if (suggestionResult.error) throw suggestionResult.error;

  return suggestionResult.data.map((row) => ({
    id: row.id,
    type: row.suggestion_type,
    title: row.title,
    aim: row.aim,
    materials: row.materials,
    steps: row.steps || [],
    phrases: row.phrases || [],
    skills: row.skills || [],
    evidenceTag: row.raw_response?.evidenceTag || "",
    evidence: row.raw_response?.evidence || "",
    observe: row.raw_response?.observe || "",
    consult: row.raw_response?.consult || "",
    resourceLinks: row.raw_response?.resourceLinks || [],
    fallback: row.fallback
  }));
}

function fallbackSuggestions(payload) {
  const childName = payload.profile.name || "お子さん";
  const labels = payload.categoryLabels.length ? payload.categoryLabels.join("・") : "会話";
  return {
    summary: "AI接続が不安定だったため、手元で安全なサンプル提案を表示しています。",
    suggestions: [
      {
        id: crypto.randomUUID(),
        type: "quick",
        title: `${childName}と${labels}を少しだけ混ぜる5分遊び`,
        aim: "親子で笑いながら、今日の小さな成功体験を作る。",
        materials: "紙、ペン、家にある小物",
        steps: ["好きなものを1つ選ぶ", "名前や色を一緒に言う", "できたところを短くほめる"],
        phrases: ["それいいね、どうして選んだの？", "もう一回やってみる？"],
        skills: ["会話", "観察", "自己肯定感"],
        evidenceTag: "Harvard型: 応答的な関わり",
        evidence: "応答的なやりとりは、言葉と社会性の土台を育てるとされています。",
        observe: "子どもが自分から見せる、指さす、もう一度求める反応を見る。",
        consult: "言葉や反応の少なさが長く気になる時は、健診や小児科で相談を。",
        resourceLinks: [
          {
            title: "Super Simple Songs",
            type: "動画/歌",
            url: "https://supersimple.com/super-simple-songs/",
            note: "短い歌を親子で一緒に歌う。"
          }
        ],
        fallback: "集中が続かなければ、1問だけで終わって大丈夫。"
      },
      {
        id: crypto.randomUUID(),
        type: "creative",
        title: "おうち探検ミッション",
        aim: "体を動かしながら、観察力とことばを増やす。",
        materials: "安全に歩ける部屋、見つけるものリスト",
        steps: ["丸いものを探す", "柔らかいものを探す", "見つけたものを親に紹介する"],
        phrases: ["どこが丸いと思った？", "これはどんな触り心地？"],
        skills: ["運動", "語彙", "分類"],
        evidenceTag: "NAEYC型: 発達に合った遊び",
        evidence: "遊びを通じた探索は、身体感覚・語彙・分類する力を一緒に使えます。",
        observe: "探す対象を自分で選べるか、親の言葉をまねるかを見る。",
        consult: "運動や感覚面の心配が続く場合は、専門家に相談してください。",
        resourceLinks: [
          {
            title: "GoNoodle",
            type: "動画/運動",
            url: "https://www.gonoodle.com/",
            note: "雨の日の室内運動に、短い動画を親子で選ぶ。"
          }
        ],
        fallback: "難しければ親が先に1つ見つけて見本を見せる。"
      },
      {
        id: crypto.randomUUID(),
        type: "deep",
        title: "週末の小さな研究会",
        aim: "好奇心を広げ、親子で考える時間を作る。",
        materials: "水、コップ、紙、好きな絵本",
        steps: ["なぜかな？を1つ決める", "親子で予想する", "試して結果を話す"],
        phrases: ["予想と同じだった？", "次は何を変えてみる？"],
        skills: ["科学", "思考力", "親子対話"],
        evidenceTag: "NAEYC型: 発達に合った遊び",
        evidence: "予想して試す遊びは、幼児期の探究心と実行機能を育てる足場になります。",
        observe: "予想、比較、言葉で説明する様子を一つだけ見る。",
        consult: "強い不安やこだわりで日常が難しい時は、専門家に相談してください。",
        resourceLinks: [
          {
            title: "NASA Kids' Club",
            type: "サイト",
            url: "https://www.nasa.gov/learning-resources/nasa-kids-club/",
            note: "宇宙や科学の写真を見て、親子で『なぜ？』を話す。"
          }
        ],
        fallback: "実験が難しい日は、絵本の中の不思議を一緒に探す。"
      }
    ]
  };
}

function normalizeSuggestions(suggestions) {
  return (suggestions || []).slice(0, 3).map((item, index) => {
    const normalized = {
      id: item.id || crypto.randomUUID(),
      type: item.type || ["quick", "creative", "deep"][index] || "quick",
      title: item.title || "今日のおすすめ",
      aim: item.aim || "",
      materials: item.materials || "",
      steps: Array.isArray(item.steps) ? item.steps : String(item.steps || "").split("\n").filter(Boolean),
      phrases: Array.isArray(item.phrases) ? item.phrases : String(item.phrases || "").split("\n").filter(Boolean),
      skills: Array.isArray(item.skills) ? item.skills : String(item.skills || "").split(/[、,\n]/).filter(Boolean),
      evidenceTag: item.evidenceTag || "",
      evidence: item.evidence || "",
      observe: item.observe || "",
      consult: item.consult || "",
      resourceLinks: Array.isArray(item.resourceLinks) ? item.resourceLinks.map(normalizeResource).filter((resource) => resource.url) : [],
      fallback: item.fallback || ""
    };
    if (!normalized.resourceLinks.length) {
      normalized.resourceLinks = inferResourceLinks(normalized).map(normalizeResource).filter((resource) => resource.url);
    }
    return normalized;
  });
}

function renderSuggestions(summary, suggestions) {
  const normalized = normalizeSuggestions(suggestions);
  state.suggestions = normalized;
  saveState();

  resultsSection.innerHTML = `
    <article class="summary-card">
      <p class="section-kicker">today</p>
      <h2>今日のおすすめ</h2>
      <p>${esc(summary || "今のプロフィールと相談内容から、親子で試しやすい順に3案を作りました。")}</p>
    </article>
    ${normalized.map((item) => `
      <details class="suggestion-card" data-kind="${esc(item.type)}">
        <summary class="suggestion-top">
          <div>
            <p class="suggestion-type">${esc(typeLabels[item.type] || "おすすめ案")}</p>
            <h3>${esc(item.title)}</h3>
            ${item.aim ? `<p class="card-preview">${esc(item.aim)}</p>` : ""}
          </div>
          <div class="card-actions">
            ${item.evidenceTag ? `<span class="evidence-tag">${esc(item.evidenceTag)}</span>` : ""}
            <span class="expand-hint">詳細</span>
          </div>
        </summary>
        <div class="card-detail">
          <div class="detail-grid">
            ${detailBox("ねらい", item.aim)}
            ${detailBox("準備するもの", item.materials)}
            ${listBox("手順", item.steps, true)}
            ${listBox("声かけ例", item.phrases)}
            ${listBox("伸びる力", item.skills)}
            ${detailBox("発達・教育の背景", item.evidence)}
            ${detailBox("見るポイント", item.observe)}
            ${detailBox("相談目安", item.consult)}
            ${resourceBox("おすすめ教材", item.resourceLinks)}
            ${detailBox("うまくいかなかった時", item.fallback)}
          </div>
          <button class="log-button" type="button" data-log-id="${esc(item.id)}">この提案を記録する</button>
        </div>
      </details>
    `).join("")}
  `;
}

function detailBox(label, value) {
  return `
    <div class="detail-box">
      <div class="detail-label">${label}</div>
      <p>${esc(value || "未設定")}</p>
    </div>
  `;
}

function listBox(label, values, full = false) {
  const items = (values || []).filter(Boolean);
  return `
    <div class="detail-box ${full ? "full" : ""}">
      <div class="detail-label">${label}</div>
      <ul>${items.length ? items.map((value) => `<li>${esc(value)}</li>`).join("") : "<li>未設定</li>"}</ul>
    </div>
  `;
}

function resourceBox(label, resources = []) {
  const items = (resources || []).filter((resource) => resource?.url);
  return `
    <div class="detail-box full resource-box">
      <div class="detail-label">${label}</div>
      ${items.length ? items.map((resource) => `
        <a href="${esc(resource.url)}" target="_blank" rel="noopener">
          <strong>${esc(resource.title || resource.type || "教材")}</strong>
          <span>${esc(resource.type || "リンク")} / ${esc(resource.note || "親子で一緒に使ってください。")}</span>
        </a>
      `).join("") : "<p>今回は家庭内の遊びだけで進められます。</p>"}
    </div>
  `;
}

function showLogForm(suggestionId) {
  const suggestion = state.suggestions.find((item) => item.id === suggestionId);
  if (!suggestion) return;
  logForm.classList.remove("hidden");
  logEmpty.classList.add("hidden");
  logForm.elements.suggestionId.value = suggestionId;
  selectedSuggestionTitle.textContent = suggestion.title;
  logForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function saveLogToSupabase(log) {
  if (!db || !currentUser || !activeFamily || !activeChild || activeMember?.role !== "parent") return false;
  const result = await db.from("activity_logs").insert({
    family_id: activeFamily.id,
    child_id: activeChild.id,
    suggestion_id: /^[0-9a-f-]{36}$/i.test(log.suggestionId) ? log.suggestionId : null,
    user_id: currentUser.id,
    did_try: log.reaction !== "skipped",
    reaction: log.reaction,
    parent_note: log.note || null,
    want_repeat: log.wantRepeat
  });
  if (result.error) throw result.error;
  return true;
}

async function loadRecentLogs() {
  if (!db || !activeFamily || !activeChild) return;
  const result = await db
    .from("activity_logs")
    .select("id, suggestion_id, reaction, parent_note, want_repeat, logged_at, suggestions(title)")
    .eq("family_id", activeFamily.id)
    .eq("child_id", activeChild.id)
    .order("logged_at", { ascending: false })
    .limit(10);

  if (result.error) throw result.error;
  state.logs = result.data.reverse().map((row) => ({
    id: row.id,
    suggestionId: row.suggestion_id,
    suggestionTitle: row.suggestions?.title || state.suggestions.find((item) => item.id === row.suggestion_id)?.title || "",
    reaction: row.reaction,
    note: row.parent_note || "",
    wantRepeat: row.want_repeat,
    loggedAt: row.logged_at
  }));
  saveState();
  renderLogHistory();
  renderReflection();
}

function getReactionLabel(reaction) {
  return {
    good: "とても効果的",
    okay: "まあまあ",
    bad: "微妙だった",
    skipped: "やらなかった"
  }[reaction] || "記録";
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (_) {
    return "";
  }
}

function renderLogHistory() {
  if (!state.logs.length) {
    logEmpty.classList.remove("hidden");
    logHistory.innerHTML = "";
    return;
  }

  logEmpty.classList.add("hidden");
  const recentLogs = [...state.logs].reverse().slice(0, 5);
  logHistory.innerHTML = recentLogs.map((log) => `
    <article class="log-entry">
      <div class="log-entry-head">
        <strong>${esc(getReactionLabel(log.reaction))}</strong>
        <span>${esc(formatDateTime(log.loggedAt))}</span>
      </div>
      <p class="log-entry-title">${esc(log.suggestionTitle || "提案カードの記録")}</p>
      <p>${esc(log.note || "メモなし")}</p>
      ${log.wantRepeat ? '<span class="mini-pill">またやりたい</span>' : ""}
    </article>
  `).join("");
}

function renderReflection() {
  if (!state.logs.length) {
    reflectionContent.innerHTML = `
      <div class="reflection-item">
        <strong>まだ記録はありません</strong>
        <p>実施記録が増えると、反応のよい遊びや次に育てたい力を見返せます。</p>
      </div>
    `;
    return;
  }

  const goodLogs = state.logs.filter((log) => log.reaction === "good");
  const repeated = state.logs.filter((log) => log.wantRepeat);
  const latest = state.logs[state.logs.length - 1];
  reflectionContent.innerHTML = `
    <div class="reflection-item">
      <strong>反応がよかった記録</strong>
      <p>${goodLogs.length}件。${goodLogs.length ? "似た遊びを次回の提案で優先しやすくなります。" : "まずは気軽に1つ試してみましょう。"}</p>
    </div>
    <div class="reflection-item">
      <strong>またやりたい活動</strong>
      <p>${repeated.length}件。続けやすいものを小さな習慣にできます。</p>
    </div>
    <div class="reflection-item">
      <strong>最近のメモ</strong>
      <p>${esc(latest.note || "メモなし")}</p>
    </div>
  `;
}

function renderPlanner() {
  if (!plannerBoard || !missionStatus) return;
  const plan = state.currentPlan;
  if (!plan || !plan.missions?.length) {
    missionStatus.textContent = "未作成";
    plannerBoard.innerHTML = `
      <div class="empty-state">プロフィールを保存してから、週プランまたは月プランを作れます。</div>
    `;
    return;
  }

  const completed = getCompletedMissionIds(plan);
  const total = plan.missions.length;
  const done = plan.missions.filter((mission) => completed.has(mission.id)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  missionStatus.textContent = `${done}/${total} 達成`;

  plannerBoard.innerHTML = `
    <section class="mission-summary">
      <div>
        <p class="section-kicker">${plan.range === "month" ? "monthly plan" : "weekly plan"}</p>
        <h3>${esc(plan.theme)}</h3>
        <p>${esc(plan.summary)}</p>
      </div>
      <div class="mission-ring" style="--progress:${percent}%">
        <strong>${percent}%</strong>
        <span>達成</span>
      </div>
    </section>
    <p class="mission-guide">${esc(plan.parentGuide)}</p>
    <div class="mission-grid">
      ${plan.missions.map((mission) => renderMissionCard(mission, completed.has(mission.id))).join("")}
    </div>
  `;
}

function renderMissionCard(mission, done) {
  const date = mission.date ? `${mission.date.slice(5).replace("-", "/")}(${esc(mission.dayLabel || "")})` : "";
  const resource = normalizeResource(mission.resource);
  return `
    <details class="mission-card ${done ? "done" : ""}">
      <summary class="mission-head">
        <div>
          <span class="mission-date">${esc(date)}</span>
          <h4>${esc(mission.title)}</h4>
          <p class="card-preview">${esc(mission.aim)}</p>
        </div>
        <div class="mission-actions">
          <button class="mission-check" type="button" data-mission-id="${esc(mission.id)}" aria-pressed="${done ? "true" : "false"}">
            ${done ? "達成" : "未達"}
          </button>
          <span class="expand-hint">詳細</span>
        </div>
      </summary>
      <div class="mission-meta">
        <span>${esc(mission.category)}</span>
        <span>${esc(mission.duration)}</span>
        <span>${esc(mission.evidenceTag)}</span>
      </div>
      <div class="mission-detail">
        <ul>${(mission.steps || []).map((step) => `<li>${esc(step)}</li>`).join("")}</ul>
        <div class="success-line"><strong>達成条件</strong><span>${esc(mission.successCriteria)}</span></div>
        ${mission.parentPhrase ? `<div class="success-line"><strong>声かけ</strong><span>${esc(mission.parentPhrase)}</span></div>` : ""}
        ${resource.url ? `
          <a class="mission-resource" href="${esc(resource.url)}" target="_blank" rel="noopener">
            <strong>${esc(resource.title)}</strong>
            <span>${esc(resource.type)} / ${esc(resource.note)}</span>
          </a>
        ` : ""}
      </div>
    </details>
  `;
}

function fallbackPlan(payload) {
  const startDate = payload.startDate || getWeekStart();
  const childName = payload.profile.name || "お子さん";
  const baseMissions = [
    ["english", "英語の歌を1曲だけ一緒に歌う", "英語", "5分", "Super Simple Songs", "https://supersimple.com/super-simple-songs/"],
    ["movement", "まねっこジャンプとストップ遊び", "運動", "5分", "GoNoodle", "https://www.gonoodle.com/"],
    ["science", "水に浮くもの探し", "科学", "15分", "NASA Kids' Club", "https://www.nasa.gov/learning-resources/nasa-kids-club/"],
    ["talk", "今日いちばん好きだったことを聞く", "会話", "5分", "", ""],
    ["book", "絵本の続きを親子で予想する", "絵本", "10分", "Khan Academy Kids", "https://www.khanacademy.org/kids"],
    ["music", "親子でリズム手拍子", "音楽", "5分", "Sesame Street", "https://www.sesamestreet.org/videos"],
    ["craft", "紙を丸めて的あて工作", "工作", "20分", "", ""]
  ];
  const missions = baseMissions.map(([id, title, category, duration, resourceTitle, url], index) => ({
    id: `${id}-${index + 1}`,
    date: addDays(startDate, index),
    dayLabel: dayLabels[new Date(`${addDays(startDate, index)}T00:00:00`).getDay()],
    title,
    category,
    duration,
    aim: `${childName}の反応を見ながら、楽しい成功体験を作る。`,
    steps: ["親が先に少し見本を見せる", "子どもが選ぶ場面を1つ入れる", "できたところを短く言葉にする"],
    successCriteria: "親子で一度笑って終われたら達成",
    parentPhrase: "いいね、もう一回やってみる？",
    evidenceTag: index % 3 === 0 ? "Harvard型" : "NAEYC型",
    resource: url ? { title: resourceTitle, type: "サイト/動画", url, note: "親子で短く使う" } : { type: "なし" }
  }));
  const monthMissions = Array.from({ length: 12 }, (_, index) => ({
    ...missions[index % missions.length],
    id: `month-${index + 1}`,
    date: addDays(startDate, Math.floor(index / 3) * 7 + (index % 3) * 2)
  }));

  return normalizePlan({
    range: payload.range,
    summary: "AI接続が不安定だったため、手元のサンプルプランを表示しています。",
    theme: payload.range === "month" ? "今月の親子ミッション" : "今週の親子ミッション",
    parentGuide: "全部こなすより、反応がよかったものを次の週に残しましょう。",
    missions: payload.range === "month" ? monthMissions : missions
  }, payload);
}

authForm.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-mode]");
  if (button) setAuthMode(button.dataset.authMode);
});

appTabs.forEach((button) => {
  button.addEventListener("click", () => {
    switchAppTab(button.dataset.appTab);
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) return;
  const formData = new FormData(authForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    alert("メールとパスワードを入力してください。");
    return;
  }

  setSyncStatus(authMode === "signup" ? "登録中..." : "ログイン中...", "online");

  if (authMode === "signup") {
    const result = await db.auth.signUp({ email, password });
    if (result.error) {
      setSyncStatus("登録失敗", "local");
      showAuthAlert("");
      alert(result.error.message);
      return;
    }
    session = result.data.session;
    currentUser = result.data.user || null;
    if (!session) {
      setSyncStatus("Auth設定の確認が必要", "local");
      showAuthAlert(`
        <strong>新規登録は作成されましたが、Supabase側でメール確認がONです。</strong>
        <p>家族内利用ではメール確認なしで使う想定です。Supabase Dashboard の Authentication → Providers → Email で「Confirm email」をOFFにしてください。OFFにした後、必要なら Authentication → Users からこのメールのユーザーを削除して、もう一度新規登録してください。</p>
      `);
      return;
    }
    await ensureFreshUser();
    showAuthAlert("");
    await createFamily(formData.get("familyName") || "佐瀬家", formData.get("relation") || "papa");
    showToast("新規登録と家庭IDの作成が完了しました。");
    setAuthMode("login");
  } else {
    const result = await db.auth.signInWithPassword({ email, password });
    if (result.error) {
      setSyncStatus("ログイン失敗", "local");
      showAuthAlert("");
      alert(result.error.message);
      return;
    }
    session = result.data.session;
    await ensureFreshUser();
    showAuthAlert("");
    showToast("ログインしました。");
  }

  await refreshAuthState();
});

authLogout.addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  session = null;
  currentUser = null;
  activeFamily = null;
  activeMember = null;
  activeChild = null;
  activeProfileId = null;
  await refreshAuthState();
});

createFamilyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createFamilyForm);
  try {
    createFamilyButton.disabled = true;
    createFamilyButton.textContent = "作成中...";
    await createFamily(formData.get("familyName") || "佐瀬家", formData.get("relation") || "mama");
    createFamilyForm.reset();
    setSyncStatus("同期済み", "online");
    await refreshAuthState();
    showToast("家庭IDを作成しました。");
  } catch (error) {
    console.error(error);
    alert(`家族作成に失敗しました: ${toUserFacingError(error)}`);
  } finally {
    createFamilyButton.disabled = false;
    createFamilyButton.textContent = "このアカウントで家庭IDを作る";
  }
});

joinFamilyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(joinFamilyForm);
  try {
    await joinFamilyByToken(formData.get("inviteToken"));
    joinFamilyForm.reset();
    setSyncStatus("同期済み", "online");
    showToast("家族に参加しました。");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});

inviteFamilyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(inviteFamilyForm);
  try {
    const invite = await createInvitation(formData);
    const message = buildInviteMessage(invite);
    inviteResult.classList.remove("hidden");
    inviteResult.innerHTML = `
      <strong>招待コード: ${esc(invite.token)}</strong>
      <p>${esc(invite.email)} 宛の招待コードを作りました。メールは自動送信されないので、下の文面をコピーしてLINEやメール本文で共有してください。</p>
      <div class="invite-share-box">${esc(message)}</div>
      <div class="invite-actions">
        <button class="secondary-btn" type="button" data-copy-invite>招待文をコピー</button>
        <a class="secondary-link-btn" href="mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent("すくすくコンシェルジュ招待")}&body=${encodeURIComponent(message)}">メールアプリで開く</a>
      </div>
    `;
    inviteFamilyForm.reset();
    showToast("招待コードを作成しました。");
  } catch (error) {
    console.error(error);
    alert(`招待コード作成に失敗しました: ${error.message}`);
  }
});

inviteResult.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-invite]");
  if (!copyButton) return;
  const text = inviteResult.querySelector(".invite-share-box")?.textContent || "";
  try {
    await copyText(text);
    showToast("招待文をコピーしました。");
  } catch (error) {
    console.error(error);
    alert("コピーに失敗しました。表示された招待文を手動でコピーしてください。");
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const nextProfile = Object.fromEntries(formData.entries());
  delete nextProfile.photo;
  nextProfile.photoData = state.profile?.photoData || "";
  state.profile = nextProfile;
  saveState();
  renderProfilePhoto();
  updateProfileStatus();
  try {
    await saveProfileToSupabase(state.profile);
    showToast("子どもプロフィールを保存しました。");
  } catch (error) {
    console.error(error);
    setSyncStatus("ローカル保存", "local");
    alert(`Supabase保存に失敗しました: ${error.message}`);
  }
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  try {
    state.profile = state.profile || {};
    state.profile.photoData = await readCompressedImage(file);
    saveState();
    renderProfilePhoto();
    setSyncStatus("プロフィール未保存", "local");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});

askForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(askForm);
  const payload = buildPayload(formData);
  askButton.disabled = true;
  askButton.textContent = "考え中...";
  resultsSection.innerHTML = '<div class="loading">AIが今日の提案を考えています...</div>';

  try {
    const data = await requestSuggestions(payload);
    let suggestions = data.suggestions;
    try {
      const saved = await saveSuggestionsToSupabase(payload, data);
      if (saved) suggestions = saved;
      showToast(saved ? "AI提案を保存しました。" : "AI提案を表示しました。");
    } catch (dbError) {
      console.warn("Suggestion DB save failed:", dbError);
      setSyncStatus("一部ローカル保存", "local");
    }
    renderSuggestions(data.summary, suggestions);
  } catch (error) {
    const data = fallbackSuggestions(payload);
    renderSuggestions(data.summary, data.suggestions);
    resultsSection.insertAdjacentHTML("afterbegin", `
      <div class="error-card">
        AI提案の通信で一時的に失敗しました。下には安全なサンプル提案を表示しています。少し待ってからもう一度試してください。<br>
        <small>${esc(error.message)}</small>
      </div>
    `);
  } finally {
    askButton.disabled = false;
    askButton.textContent = "提案してもらう";
  }
});

askForm.addEventListener("change", (event) => {
  if (event.target.matches('input[type="checkbox"], input[type="radio"]')) {
    syncChoiceState(askForm);
    updateConsultationControls();
  }
});

plannerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(plannerForm);
  const payload = buildPlanPayload(formData);
  plannerButton.disabled = true;
  plannerButton.textContent = "作成中...";
  plannerBoard.innerHTML = '<div class="loading">育ちのカレンダーを作っています...</div>';

  try {
    const data = await requestPlan(payload);
    state.currentPlan = normalizePlan(data, payload);
    saveState();
    try {
      const synced = await savePlanToSupabase(state.currentPlan);
      setSyncStatus(synced ? "同期済み" : "ローカル保存", synced ? "online" : "local");
      showToast(synced ? "育ちのプランを保存しました。" : "育ちのプランを作成しました。");
    } catch (dbError) {
      console.warn("Plan DB save failed:", dbError);
      setSyncStatus("一部ローカル保存", "local");
    }
    renderPlanner();
  } catch (error) {
    state.currentPlan = fallbackPlan(payload);
    saveState();
    renderPlanner();
    plannerBoard.insertAdjacentHTML("afterbegin", `<div class="error-card">${esc(error.message)}</div>`);
  } finally {
    plannerButton.disabled = false;
    plannerButton.textContent = "プランを作る";
  }
});

plannerBoard?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-mission-id]");
  if (!button || !state.currentPlan) return;
  event.preventDefault();
  event.stopPropagation();
  const missionId = button.dataset.missionId;
  const completed = getCompletedMissionIds();
  if (completed.has(missionId)) {
    completed.delete(missionId);
  } else {
    completed.add(missionId);
  }
  state.currentPlan.completedMissionIds = Array.from(completed);
  saveState();
  renderPlanner();
  try {
    const synced = await savePlanToSupabase(state.currentPlan);
    setSyncStatus(synced ? "同期済み" : "ローカル保存", synced ? "online" : "local");
    showToast("ミッション達成状況を更新しました。");
  } catch (error) {
    console.warn("Plan progress save failed:", error);
    setSyncStatus("一部ローカル保存", "local");
  }
});

resultsSection.addEventListener("click", (event) => {
  const button = event.target.closest("[data-log-id]");
  if (button) {
    showLogForm(button.dataset.logId);
  }
});

logForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(logForm);
  const suggestion = state.suggestions.find((item) => item.id === formData.get("suggestionId"));
  const log = {
    id: crypto.randomUUID(),
    suggestionId: formData.get("suggestionId"),
    suggestionTitle: suggestion ? suggestion.title : "",
    reaction: formData.get("reaction"),
    note: formData.get("note") || "",
    wantRepeat: formData.get("wantRepeat") === "on",
    loggedAt: new Date().toISOString()
  };
  state.logs.push(log);
  saveState();
  try {
    const synced = await saveLogToSupabase(log);
    setSyncStatus(synced ? "同期済み" : "ローカル保存", synced ? "online" : "local");
    showToast(synced ? "実施記録を保存しました。" : "実施記録をローカル保存しました。");
  } catch (error) {
    console.warn("Log DB save failed:", error);
    setSyncStatus("一部ローカル保存", "local");
  }
  logForm.reset();
  logForm.classList.add("hidden");
  renderLogHistory();
  renderReflection();
});

renderCategoryChoices();
if (plannerForm?.elements.planStartDate) plannerForm.elements.planStartDate.value = getWeekStart();
syncChoiceState();
updateConsultationControls();
fillProfileForm();
renderLogHistory();
renderReflection();
renderPlanner();
initSupabase();
