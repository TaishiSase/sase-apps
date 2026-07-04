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

const typeLabels = {
  quick: "すぐできる案",
  creative: "ちょっと工夫する案",
  deep: "親子でじっくり案"
};

const state = loadState();

let db = null;
let session = null;
let currentUser = null;
let activeFamily = null;
let activeMember = null;
let activeChild = null;
let activeProfileId = null;

const authPanel = document.getElementById("authPanel");
const authForm = document.getElementById("authForm");
const authSession = document.getElementById("authSession");
const authStatus = document.getElementById("authStatus");
const authLogout = document.getElementById("authLogout");
const syncStatus = document.getElementById("syncStatus");
const profileForm = document.getElementById("profileForm");
const askForm = document.getElementById("askForm");
const logForm = document.getElementById("logForm");
const resultsSection = document.getElementById("resultsSection");
const reflectionContent = document.getElementById("reflectionContent");
const categoryChoices = document.getElementById("categoryChoices");
const profileStatus = document.getElementById("profileStatus");
const askButton = document.getElementById("askButton");
const logEmpty = document.getElementById("logEmpty");
const logHistory = document.getElementById("logHistory");
const selectedSuggestionTitle = document.getElementById("selectedSuggestionTitle");

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { profile: {}, suggestions: [], logs: [] };
  } catch (_) {
    return { profile: {}, suggestions: [], logs: [] };
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
}

function fillProfileForm() {
  const profile = state.profile || {};
  Object.entries(profile).forEach(([key, value]) => {
    if (profileForm.elements[key]) {
      profileForm.elements[key].value = value || "";
    }
  });
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

function buildPayload(formData) {
  const selectedCategories = getSelectedCategories();
  return {
    profile: state.profile,
    consultationType: formData.get("consultationType"),
    durationType: formData.get("durationType"),
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
    currentUser = session?.user || null;
    await refreshAuthState();
  } catch (error) {
    console.warn("Supabase init failed:", error);
    setSyncStatus("ローカル保存", "local");
  }
}

async function refreshAuthState() {
  if (!db) return;
  if (!currentUser) {
    authForm.classList.remove("hidden");
    authSession.classList.add("hidden");
    setSyncStatus("ローカル保存", "local");
    return;
  }

  authForm.classList.add("hidden");
  authSession.classList.remove("hidden");
  authStatus.textContent = `${currentUser.email} で同期中`;
  setSyncStatus("同期中", "online");

  await loadOrCreateFamily();
  await loadFirstChild();
  await loadRecentLogs();
}

async function loadOrCreateFamily() {
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

  const familyResult = await db
    .from("families")
    .insert({ name: "佐瀬家", created_by: currentUser.id })
    .select("id, name")
    .single();

  if (familyResult.error) throw familyResult.error;
  activeFamily = familyResult.data;

  const memberInsert = await db
    .from("family_members")
    .insert({
      family_id: activeFamily.id,
      user_id: currentUser.id,
      display_name: currentUser.email || "parent",
      role: "parent",
      relation: "papa",
      status: "active"
    })
    .select("id, family_id, role, relation, display_name")
    .single();

  if (memberInsert.error) throw memberInsert.error;
  activeMember = memberInsert.data;
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
    .select("id, likes, concerns, parent_goals")
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
    goals: profileResult.data?.parent_goals || ""
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
    .select("id, title, suggestion_type, aim, materials, steps, phrases, skills, fallback");

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
        fallback: "実験が難しい日は、絵本の中の不思議を一緒に探す。"
      }
    ]
  };
}

function normalizeSuggestions(suggestions) {
  return (suggestions || []).slice(0, 3).map((item, index) => ({
    id: item.id || crypto.randomUUID(),
    type: item.type || ["quick", "creative", "deep"][index] || "quick",
    title: item.title || "今日のおすすめ",
    aim: item.aim || "",
    materials: item.materials || "",
    steps: Array.isArray(item.steps) ? item.steps : String(item.steps || "").split("\n").filter(Boolean),
    phrases: Array.isArray(item.phrases) ? item.phrases : String(item.phrases || "").split("\n").filter(Boolean),
    skills: Array.isArray(item.skills) ? item.skills : String(item.skills || "").split(/[、,\n]/).filter(Boolean),
    fallback: item.fallback || ""
  }));
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
      <article class="suggestion-card" data-kind="${esc(item.type)}">
        <div class="suggestion-top">
          <div>
            <p class="suggestion-type">${esc(typeLabels[item.type] || "おすすめ案")}</p>
            <h3>${esc(item.title)}</h3>
          </div>
        </div>
        <div class="detail-grid">
          ${detailBox("ねらい", item.aim)}
          ${detailBox("準備するもの", item.materials)}
          ${listBox("手順", item.steps, true)}
          ${listBox("声かけ例", item.phrases)}
          ${listBox("伸びる力", item.skills)}
          ${detailBox("うまくいかなかった時", item.fallback)}
        </div>
        <button class="log-button" type="button" data-log-id="${esc(item.id)}">この提案を記録する</button>
      </article>
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

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) return;
  const formData = new FormData(authForm);
  setSyncStatus("ログイン中...", "online");
  const result = await db.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (result.error) {
    setSyncStatus("ログイン失敗", "local");
    alert(result.error.message);
    return;
  }
  session = result.data.session;
  currentUser = session.user;
  await refreshAuthState();
});

authLogout.addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  session = null;
  currentUser = null;
  activeFamily = null;
  activeMember = null;
  activeChild = null;
  await refreshAuthState();
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  state.profile = Object.fromEntries(formData.entries());
  saveState();
  updateProfileStatus();
  try {
    await saveProfileToSupabase(state.profile);
  } catch (error) {
    console.error(error);
    setSyncStatus("ローカル保存", "local");
    alert(`Supabase保存に失敗しました: ${error.message}`);
  }
});

askForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(askForm);
  const payload = buildPayload(formData);
  askButton.disabled = true;
  askButton.textContent = "考え中...";
  resultsSection.innerHTML = '<div class="loading">すくすく案を考えています...</div>';

  try {
    const data = await requestSuggestions(payload);
    let suggestions = data.suggestions;
    try {
      const saved = await saveSuggestionsToSupabase(payload, data);
      if (saved) suggestions = saved;
    } catch (dbError) {
      console.warn("Suggestion DB save failed:", dbError);
      setSyncStatus("一部ローカル保存", "local");
    }
    renderSuggestions(data.summary, suggestions);
  } catch (error) {
    const data = fallbackSuggestions(payload);
    renderSuggestions(data.summary, data.suggestions);
    resultsSection.insertAdjacentHTML("afterbegin", `<div class="error-card">${esc(error.message)}</div>`);
  } finally {
    askButton.disabled = false;
    askButton.textContent = "提案してもらう";
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
fillProfileForm();
renderLogHistory();
renderReflection();
initSupabase();
