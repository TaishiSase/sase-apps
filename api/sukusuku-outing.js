const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseJson(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON.");
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function weatherCodeLabel(code) {
  const labels = {
    0: "快晴",
    1: "晴れ",
    2: "一部くもり",
    3: "くもり",
    45: "霧",
    48: "霧氷",
    51: "弱い霧雨",
    53: "霧雨",
    55: "強い霧雨",
    61: "弱い雨",
    63: "雨",
    65: "強い雨",
    71: "弱い雪",
    73: "雪",
    75: "強い雪",
    80: "弱いにわか雨",
    81: "にわか雨",
    82: "強いにわか雨",
    95: "雷雨",
    96: "雷雨と雹",
    99: "強い雷雨と雹"
  };
  return labels[code] || "天気変化あり";
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function distanceText(meters) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `約${Math.round(meters / 10) * 10}m`;
  return `約${(meters / 1000).toFixed(1)}km`;
}

function placeType(tags = {}) {
  if (tags.leisure === "playground") return "遊具・公園";
  if (tags.leisure === "indoor_play") return "屋内遊び場";
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "nature_reserve") return "公園・自然";
  if (tags.tourism === "museum" || tags.tourism === "gallery") return "博物館・展示";
  if (tags.tourism === "zoo" || tags.tourism === "aquarium") return "動物・水族館";
  if (tags.tourism === "theme_park" || tags.tourism === "attraction") return "体験施設";
  if (tags.amenity === "library") return "図書館";
  if (tags.amenity === "cinema") return "映画・室内";
  if (tags.amenity === "community_centre" || tags.amenity === "arts_centre") return "公共施設";
  if (tags.amenity === "cafe") return "休憩スポット";
  if (tags.amenity === "childcare") return "子育て施設";
  if (tags.shop === "mall") return "大型商業施設";
  if (tags.shop === "books") return "本屋";
  if (tags.shop === "toys") return "おもちゃ";
  return "周辺スポット";
}

function mapUrl(lat, lon, name) {
  const query = name ? `${name} ${lat},${lon}` : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function categoryMapUrl(lat, lon, keyword) {
  return `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lon},14z`;
}

async function fetchWeather(payload) {
  const params = new URLSearchParams({
    latitude: String(payload.latitude),
    longitude: String(payload.longitude),
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
    timezone: "Asia/Tokyo",
    start_date: payload.date,
    end_date: payload.date
  });
  const response = await fetch(`${WEATHER_ENDPOINT}?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || "天気情報を取得できませんでした。");
  return summarizeWeather(data, payload);
}

function summarizeWeather(data, payload) {
  const hourly = data.hourly || {};
  const times = hourly.time || [];
  const selected = times
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time.slice(0, 10) === payload.date
      && time.slice(11, 16) >= payload.startTime
      && time.slice(11, 16) <= payload.endTime);

  const rows = selected.length ? selected : times.map((time, index) => ({ time, index })).slice(0, 6);
  if (!rows.length) {
    return {
      summary: "指定時間の天気が取得できませんでした。",
      outdoorScore: 2,
      label: "天気不明"
    };
  }

  const values = (key) => rows.map(({ index }) => hourly[key]?.[index]).filter((value) => Number.isFinite(value));
  const temps = values("temperature_2m");
  const precipProb = values("precipitation_probability");
  const precip = values("precipitation");
  const wind = values("wind_speed_10m");
  const codes = values("weather_code");
  const avgTemp = temps.length ? temps.reduce((sum, value) => sum + value, 0) / temps.length : null;
  const maxPrecip = precipProb.length ? Math.max(...precipProb) : 0;
  const totalRain = precip.length ? precip.reduce((sum, value) => sum + value, 0) : 0;
  const maxWind = wind.length ? Math.max(...wind) : 0;
  const worstCode = codes.sort((a, b) => b - a)[0] || 0;

  let outdoorScore = 4;
  if (maxPrecip >= 60 || totalRain >= 2 || worstCode >= 80 || maxWind >= 30) outdoorScore = 1;
  else if (maxPrecip >= 35 || totalRain > 0 || maxWind >= 20 || (avgTemp !== null && (avgTemp <= 5 || avgTemp >= 32))) outdoorScore = 2;
  else if (avgTemp !== null && (avgTemp <= 10 || avgTemp >= 29)) outdoorScore = 3;

  const tempText = avgTemp === null ? "" : `${Math.round(avgTemp)}℃`;
  const summary = `${weatherCodeLabel(worstCode)}、平均${tempText || "気温不明"}、降水確率最大${Math.round(maxPrecip)}%、風速最大${Math.round(maxWind)}km/h`;
  return {
    summary,
    outdoorScore,
    label: weatherCodeLabel(worstCode),
    avgTemp,
    maxPrecip,
    totalRain,
    maxWind
  };
}

async function fetchPlaces(payload) {
  const radius = clampNumber(payload.radius, 600, 6000, 2500);
  const query = `
[out:json][timeout:12];
(
  nwr(around:${radius},${payload.latitude},${payload.longitude})["leisure"~"park|playground|garden|nature_reserve|sports_centre|indoor_play"];
  nwr(around:${radius},${payload.latitude},${payload.longitude})["tourism"~"museum|zoo|aquarium|theme_park|gallery|attraction"];
  nwr(around:${radius},${payload.latitude},${payload.longitude})["amenity"~"library|community_centre|arts_centre|cafe|cinema|childcare"];
  nwr(around:${radius},${payload.latitude},${payload.longitude})["shop"~"books|toys|mall"];
);
out center tags 60;
`;
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ data: query })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("周辺スポットを取得できませんでした。");

  const seen = new Set();
  return (data.elements || [])
    .map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const tags = element.tags || {};
      const name = tags["name:ja"] || tags.name || tags["name:en"] || "";
      if (!lat || !lon || !name) return null;
      const key = `${name}-${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const meters = haversineMeters(payload.latitude, payload.longitude, lat, lon);
      return {
        id: `${element.type}-${element.id}`,
        name,
        type: placeType(tags),
        latitude: lat,
        longitude: lon,
        distanceMeters: Math.round(meters),
        distanceText: distanceText(meters),
        tags: {
          leisure: tags.leisure,
          tourism: tags.tourism,
          amenity: tags.amenity,
          shop: tags.shop,
          opening_hours: tags.opening_hours || "",
          website: tags.website || tags["contact:website"] || ""
        },
        mapUrl: mapUrl(lat, lon, name),
        osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 16);
}

function isNearNagoya(payload) {
  return payload.latitude >= 34.85 && payload.latitude <= 35.38
    && payload.longitude >= 136.68 && payload.longitude <= 137.12;
}

function curatedNagoyaPlaces(payload) {
  if (!isNearNagoya(payload)) return [];
  const rows = [
    ["nagoya-port-aquarium", "名古屋港水族館", "動物・水族館", 35.0902, 136.8812, "雨の日も過ごしやすく、海の生きものを観察しながら会話を広げやすい定番スポット。"],
    ["higashiyama-zoo", "東山動植物園", "動物・水族館", 35.1569, 136.9770, "動物、植物、坂道歩きまで入れられ、体験と運動を組み合わせやすい。"],
    ["nagoya-science-museum", "名古屋市科学館", "博物館・展示", 35.1650, 136.8998, "科学への興味づけに向き、天候に左右されにくい。"],
    ["legoland-japan", "レゴランド・ジャパン", "体験施設", 35.0505, 136.8434, "創造力、身体遊び、親子の非日常体験をまとめて作りやすい。"],
    ["toda-gawa-kodomo-land", "とだがわこどもランド", "遊具・公園", 35.1117, 136.8102, "大型遊具と広い外遊びで、週末のしっかり活動に使いやすい。"],
    ["odaka-ryokuchi", "大高緑地", "公園・自然", 35.0651, 136.9525, "自然遊び、運動、乗り物系の体験を組み合わせやすい。"],
    ["tsuruma-park", "鶴舞公園", "公園・自然", 35.1551, 136.9190, "駅近で短時間の散歩や自然観察に使いやすい。"],
    ["norikake-garden", "ノリタケの森", "体験施設", 35.1770, 136.8806, "ものづくりや展示を見る体験に向き、短めのお出かけにしやすい。"],
    ["aeon-mall-nagoya-dome", "イオンモールナゴヤドーム前", "大型商業施設", 35.1877, 136.9450, "天候が悪い時の休憩、買い物、食事をまとめやすい。"],
    ["aeon-mall-atsuta", "イオンモール熱田", "大型商業施設", 35.1362, 136.9106, "屋内で過ごしやすく、短時間の気分転換や食事調整に使いやすい。"],
    ["mozo-wondercity", "mozoワンダーシティ", "大型商業施設", 35.2246, 136.8834, "屋内中心で、買い物・食事・休憩を挟みながら過ごしやすい。"],
    ["hisaya-odori-park", "Hisaya-odori Park", "公園・自然", 35.1737, 136.9089, "街中で短く歩き、休憩や親子会話を入れやすい。"]
  ];

  const maxDistance = payload.travelMode === "walk" && payload.radius <= 1200 ? 9000 : 28000;
  return rows
    .map(([id, name, type, latitude, longitude, note]) => {
      const meters = haversineMeters(payload.latitude, payload.longitude, latitude, longitude);
      return {
        id: `curated-${id}`,
        name,
        type,
        latitude,
        longitude,
        distanceMeters: Math.round(meters),
        distanceText: distanceText(meters),
        tags: { featured: true, note },
        mapUrl: mapUrl(latitude, longitude, name),
        osmUrl: ""
      };
    })
    .filter((place) => place.distanceMeters <= maxDistance);
}

function mergePlaces(places) {
  const seen = new Set();
  return places
    .filter(Boolean)
    .filter((place) => {
      const key = String(place.name || "").replace(/\s+/g, "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const featuredDiff = Number(Boolean(b.tags?.featured)) - Number(Boolean(a.tags?.featured));
      if (featuredDiff !== 0) return featuredDiff;
      return (a.distanceMeters || 999999) - (b.distanceMeters || 999999);
    })
    .slice(0, 24);
}

function buildSearchPlaces(payload, weather) {
  const curated = curatedNagoyaPlaces(payload);
  if (curated.length) return curated.slice(0, 8);

  const outdoorOk = weather.outdoorScore >= 3 && payload.preference !== "indoor";
  const keywords = outdoorOk
    ? [
      ["近くの公園", "公園・自然"],
      ["近くの遊び場", "遊具・公園"],
      ["近くの図書館", "図書館"],
      ["近くのカフェ 子連れ", "休憩スポット"]
    ]
    : [
      ["近くの図書館", "図書館"],
      ["近くの児童館", "公共施設"],
      ["近くの博物館 子供", "博物館・展示"],
      ["近くのカフェ 子連れ", "休憩スポット"]
    ];
  return keywords.map(([name, type], index) => ({
    id: `search-${index + 1}`,
    name,
    type,
    latitude: payload.latitude,
    longitude: payload.longitude,
    distanceMeters: null,
    distanceText: "現在地周辺",
    tags: { searchFallback: true },
    mapUrl: categoryMapUrl(payload.latitude, payload.longitude, name),
    osmUrl: ""
  }));
}

function buildInstructions() {
  return [
    "あなたはHagumi「きょう、なにしよう。」のAI育児コンシェルジュです。0歳から6歳の子どもを育てる親を支えます。",
    "現在地周辺のスポット候補、指定日と時間帯の天気、子どものプロフィールをもとに、親子のおでかけ先を提案してください。",
    "ターゲットは教育熱心で質の高い情報を求める保護者です。上品で落ち着いた語り口にし、過度な不安訴求や断定を避けてください。",
    "発達心理・幼児教育の背景として、Harvard Center on the Developing Childのserve and return、NAEYCのDevelopmentally Appropriate Practice、CDCの発達観察の考え方を使ってください。",
    "スポットの営業中、料金、予約可否、設備の有無は断定しないでください。必要なら公式情報や現地情報の確認を促してください。",
    "医療診断、発達診断、治療方針の断定は禁止です。",
    "与えられたplacesに含まれる場所だけを提案してください。必ず具体的なplaceNameを使い、名古屋港水族館、東山動植物園、名古屋市科学館、イオンモールなどの候補がplacesにある場合は、条件に合うものを優先的に検討してください。",
    "placesのidがsearch-で始まるものは固有施設ではなく地図検索候補です。固有名のように断定せず、『地図で探す』候補として扱ってください。",
    "必ずJSONだけを返してください。Markdownや説明文は不要です。",
    "JSON形式: {\"summary\":\"\",\"weatherSummary\":\"\",\"placeSummary\":\"\",\"plans\":[{\"id\":\"\",\"title\":\"\",\"placeName\":\"\",\"placeType\":\"\",\"distanceText\":\"\",\"timePlan\":\"\",\"why\":\"\",\"weatherFit\":\"\",\"learningAngle\":\"\",\"parentPhrase\":\"\",\"safetyNote\":\"\",\"backupPlan\":\"\",\"evidenceTag\":\"Harvard型|NAEYC型|CDC型\",\"mapUrl\":\"\",\"osmUrl\":\"\"}],\"indoorBackup\":\"\"}",
    "plansは3〜4件。最初の1件を一番おすすめにしてください。"
  ].join("\n");
}

function fallbackPlan(payload, weather, places, reason = "") {
  const childName = payload.profile?.name || "お子さん";
  const outdoorOk = weather.outdoorScore >= 3 && payload.preference !== "indoor";
  const preferredTypes = outdoorOk
    ? ["遊具・公園", "公園・自然", "体験施設", "動物・水族館", "博物館・展示", "図書館"]
    : ["図書館", "博物館・展示", "公共施設", "休憩スポット", "本屋", "おもちゃ"];
  const sorted = [...places].sort((a, b) => {
    const aRank = preferredTypes.includes(a.type) ? preferredTypes.indexOf(a.type) : 99;
    const bRank = preferredTypes.includes(b.type) ? preferredTypes.indexOf(b.type) : 99;
    const aFeatured = a.tags?.featured ? -2 : 0;
    const bFeatured = b.tags?.featured ? -2 : 0;
    const typeDiff = (aRank + aFeatured) - (bRank + bFeatured);
    if (typeDiff !== 0) return typeDiff;
    return a.distanceMeters - b.distanceMeters;
  });
  const selected = sorted.slice(0, 4);
  const plans = selected.map((place, index) => ({
    id: `outing-${index + 1}`,
    title: index === 0 ? `${place.name}で無理なく遊ぶ` : `${place.name}を候補にする`,
    placeName: place.name,
    placeType: place.type,
    distanceText: place.distanceText,
    timePlan: `${payload.startTime}から${payload.endTime}の間で、移動と休憩を含めて短めに楽しむ。`,
    why: place.tags?.note || (outdoorOk ? "天気が大きく崩れにくい時間帯なので、体を動かす活動を入れやすいです。" : "雨・暑さ・寒さの影響を受けにくい候補を優先しました。"),
    weatherFit: weather.summary,
    learningAngle: `${childName}の興味を見ながら、観察、会話、身体感覚を遊びの中で育てます。`,
    parentPhrase: "何が一番おもしろかった？もう一回見たいものはある？",
    safetyNote: "営業時間、混雑、授乳・トイレ・ベビーカー可否は出発前に公式情報で確認してください。",
    backupPlan: "疲れたら近くで短く切り上げ、帰宅後に見つけたものを1つだけ話します。",
    evidenceTag: index % 2 === 0 ? "NAEYC型" : "Harvard型",
    mapUrl: place.mapUrl,
    osmUrl: place.osmUrl
  }));

  if (!plans.length) {
    const keywords = outdoorOk
      ? [
        ["近くの公園", "公園・自然", "自然物を見つけて会話を増やす"],
        ["近くの遊び場", "遊具・公園", "身体を動かしながら順番や挑戦を経験する"],
        ["近くの図書館", "図書館", "落ち着いて絵本や言葉に触れる"],
        ["近くのカフェ 子連れ", "休憩スポット", "短く休憩して親子の余白を作る"]
      ]
      : [
        ["近くの図書館", "図書館", "絵本、会話、静かな観察を楽しむ"],
        ["近くの児童館", "公共施設", "安全な室内で身体遊びや社会性を育てる"],
        ["近くの博物館 子供", "博物館・展示", "見つける、比べる、質問する経験を作る"],
        ["近くのカフェ 子連れ", "休憩スポット", "短時間で気分転換する"]
      ];
    plans.push(...keywords.map(([keyword, type, angle], index) => ({
      id: `outing-search-${index + 1}`,
      title: `${keyword}を地図で探す`,
      placeName: keyword,
      placeType: type,
      distanceText: "現在地周辺",
      timePlan: `${payload.startTime}から${payload.endTime}の間で、移動と休憩を含めて短めに。`,
      why: "周辺スポットの固有名を十分に取得できなかったため、現在地から探しやすいカテゴリで提案しています。",
      weatherFit: weather.summary,
      learningAngle: `${childName}に合わせて、${angle}ことをねらいます。`,
      parentPhrase: "どれに行ってみたい？着いたら何を探そうか？",
      safetyNote: "出発前に営業時間、混雑、トイレ、ベビーカー可否、雨天対応を確認してください。",
      backupPlan: "合わなければ無理に滞在せず、帰宅後に絵本や工作へ切り替えます。",
      evidenceTag: index === 0 ? "NAEYC型" : "Harvard型",
      mapUrl: categoryMapUrl(payload.latitude, payload.longitude, keyword),
      osmUrl: ""
    })));
  }

  return {
    summary: "天気、移動距離、子どもの過ごしやすさを見て、具体的なおでかけ候補を整理しました。",
    weatherSummary: weather.summary,
    placeSummary: `${places.length}件の周辺候補を確認しました。${reason ? " 条件に合う候補を優先して表示しています。" : ""}`,
    plans,
    indoorBackup: "天気や混雑が合わない時は、図書館、短い買い物、家での工作・絵本に切り替えると親子とも疲れにくいです。"
  };
}

function normalizePlan(plan, payload, weather, places) {
  const fallback = fallbackPlan(payload, weather, places);
  const normalized = {
    summary: plan.summary || fallback.summary,
    weatherSummary: plan.weatherSummary || weather.summary,
    placeSummary: plan.placeSummary || `${places.length}件の周辺候補を確認しました。`,
    indoorBackup: plan.indoorBackup || fallback.indoorBackup,
    plans: Array.isArray(plan.plans) ? plan.plans.slice(0, 4) : []
  };
  normalized.plans = normalized.plans.map((item, index) => ({
    id: item.id || `outing-${index + 1}`,
    title: item.title || "親子のおでかけ案",
    placeName: item.placeName || "",
    placeType: item.placeType || "",
    distanceText: item.distanceText || "",
    timePlan: item.timePlan || "",
    why: item.why || "",
    weatherFit: item.weatherFit || weather.summary,
    learningAngle: item.learningAngle || "",
    parentPhrase: item.parentPhrase || "",
    safetyNote: item.safetyNote || "出発前に公式情報と現地状況を確認してください。",
    backupPlan: item.backupPlan || "",
    evidenceTag: ["Harvard型", "NAEYC型", "CDC型"].includes(item.evidenceTag) ? item.evidenceTag : "NAEYC型",
    mapUrl: /^https:\/\/[^\s<>"']+$/i.test(item.mapUrl || "") ? item.mapUrl : "",
    osmUrl: /^https:\/\/[^\s<>"']+$/i.test(item.osmUrl || "") ? item.osmUrl : ""
  }));
  if (!normalized.plans.length) return fallback;
  if (normalized.plans.length < 3) {
    const existingNames = new Set(normalized.plans.map((item) => item.placeName || item.title));
    const additions = fallback.plans.filter((item) => !existingNames.has(item.placeName || item.title));
    normalized.plans.push(...additions.slice(0, 3 - normalized.plans.length));
  }
  return normalized;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "POST only" });
  }

  try {
    const payload = req.body || {};
    const safePayload = {
      ...payload,
      latitude: clampNumber(payload.latitude, -90, 90, NaN),
      longitude: clampNumber(payload.longitude, -180, 180, NaN),
      radius: clampNumber(payload.radius, 600, 6000, 2500),
      date: payload.date || new Date().toISOString().slice(0, 10),
      startTime: payload.startTime || "10:00",
      endTime: payload.endTime || "12:00"
    };

    if (!Number.isFinite(safePayload.latitude) || !Number.isFinite(safePayload.longitude)) {
      return sendJson(res, 400, { error: "latitude and longitude are required." });
    }

    const [weatherResult, placesResult] = await Promise.allSettled([
      fetchWeather(safePayload),
      fetchPlaces(safePayload)
    ]);
    const weather = weatherResult.status === "fulfilled"
      ? weatherResult.value
      : { summary: "天気情報を取得できませんでした。", outdoorScore: 2, label: "天気不明" };
    const fetchedPlaces = placesResult.status === "fulfilled" ? placesResult.value : [];
    const places = mergePlaces([
      ...curatedNagoyaPlaces(safePayload),
      ...(fetchedPlaces.length ? fetchedPlaces : buildSearchPlaces(safePayload, weather))
    ]);

    if (!process.env.OPENAI_API_KEY) {
      return sendJson(res, 200, fallbackPlan(safePayload, weather, places, "OpenAI APIキーが未設定です。"));
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          instructions: buildInstructions(),
          input: [
            {
              role: "user",
              content: JSON.stringify({
                child: safePayload.profile || {},
                outing: {
                  date: safePayload.date,
                  startTime: safePayload.startTime,
                  endTime: safePayload.endTime,
                  travelMode: safePayload.travelMode || "walk",
                  preference: safePayload.preference || "balanced",
                  parentMessage: safePayload.message || ""
                },
                weather,
                places,
                recentLogs: safePayload.recentLogs || []
              })
            }
          ],
          reasoning: { effort: "low" },
          max_output_tokens: 2600
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return sendJson(res, 200, fallbackPlan(safePayload, weather, places, data.error?.message || "OpenAI API request failed."));
      }

      const parsed = parseJson(extractOutputText(data));
      return sendJson(res, 200, normalizePlan(parsed, safePayload, weather, places));
    } catch (error) {
      return sendJson(res, 200, fallbackPlan(safePayload, weather, places, error.message || ""));
    }
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
};
