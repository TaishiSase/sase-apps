const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

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

function parsePlan(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON.");
  }
}

function buildResourceCatalog() {
  return [
    {
      title: "Super Simple Songs",
      type: "動画/歌",
      url: "https://supersimple.com/super-simple-songs/",
      categories: ["英語", "音楽", "生活習慣"],
      note: "幼児向け英語の歌。親子で歌いやすい短い曲を選ぶ。"
    },
    {
      title: "Khan Academy Kids",
      type: "アプリ",
      url: "https://www.khanacademy.org/kids",
      categories: ["英語", "算数", "絵本"],
      note: "2-8歳向けの無料学習アプリ。読み聞かせや数遊びに。"
    },
    {
      title: "Duolingo ABC",
      type: "アプリ",
      url: "https://abc.duolingo.com/",
      categories: ["英語", "絵本"],
      note: "英語の文字・音への入り口。短時間のフォニックス遊びに。"
    },
    {
      title: "GoNoodle",
      type: "動画/運動",
      url: "https://www.gonoodle.com/",
      categories: ["運動", "音楽", "感情教育"],
      note: "動きとマインドフルネスの動画。室内で体を動かしたい日に。"
    },
    {
      title: "Sesame Street",
      type: "動画",
      url: "https://www.sesamestreet.org/videos",
      categories: ["英語", "会話", "社会性", "感情教育"],
      note: "英語・社会性・生活場面の動画。親が隣で声かけしながら見る。"
    },
    {
      title: "NASA Kids' Club",
      type: "サイト",
      url: "https://www.nasa.gov/learning-resources/nasa-kids-club/",
      categories: ["科学", "自然遊び"],
      note: "宇宙や科学への興味づけ。親子で写真やゲームを眺める。"
    },
    {
      title: "ScratchJr",
      type: "アプリ",
      url: "https://www.scratchjr.org/",
      categories: ["科学", "算数", "工作"],
      note: "5歳以上向けの初歩プログラミング。物語づくりとして使う。"
    },
    {
      title: "PBS KIDS ScratchJr",
      type: "アプリ",
      url: "https://pbskids.org/apps/pbs-kids-scratchjr",
      categories: ["科学", "算数", "工作"],
      note: "5-8歳向け。キャラクターを使った物語づくりに。"
    }
  ];
}

function buildInstructions() {
  return [
    "あなたは0歳から6歳の子どもを育てる親のためのAI育児コンシェルジュです。",
    "週または月のカレンダー型プランを作ります。親が安心して続けられる、上品で現実的なミッション設計にしてください。",
    "富裕層の教育熱心な保護者向けですが、詰め込み教育ではなく、発達に合った遊び、親子の応答的な関わり、生活の中の学びを重視してください。",
    "背景にはHarvard Center on the Developing Childのserve and return、NAEYCのDevelopmentally Appropriate Practice、CDCの発達マイルストーン確認を置いてください。",
    "医療診断、発達診断、治療方針の断定は禁止です。気になる点は観察と相談目安に留めてください。",
    "動画やアプリのURLは、resourceCatalogに含まれるURLだけを使ってください。子ども一人で見せっぱなしにする表現は避け、親が一緒に使う前提にしてください。",
    "週プランは7件、月プランは12件のmissionsを返してください。月プランは週3件程度のリズムにしてください。",
    "missionのidは英数字とハイフンだけで、重複しない短いIDにしてください。",
    "evidenceTagは必ず次のいずれかにしてください: \"Harvard型\", \"NAEYC型\", \"CDC型\"。",
    "必ずJSONだけを返してください。Markdownや説明文は不要です。",
    "JSON形式: {\"summary\":\"\",\"range\":\"week|month\",\"theme\":\"\",\"parentGuide\":\"\",\"missions\":[{\"id\":\"\",\"date\":\"YYYY-MM-DD\",\"dayLabel\":\"月\",\"title\":\"\",\"category\":\"英語\",\"duration\":\"5分\",\"aim\":\"\",\"steps\":[\"\"],\"successCriteria\":\"達成の目安を1つ\",\"parentPhrase\":\"\",\"evidenceTag\":\"NAEYC型\",\"resource\":{\"title\":\"\",\"type\":\"動画|アプリ|サイト|なし\",\"url\":\"\",\"note\":\"\"}}]}"
  ].join("\n");
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

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "OPENAI_API_KEY is not configured." });
  }

  try {
    const payload = req.body || {};
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
              child: payload.profile || {},
              range: payload.range || "week",
              startDate: payload.startDate,
              intensity: payload.intensity || "balanced",
              categories: payload.categoryLabels || payload.categories || [],
              parentMessage: payload.message || "",
              recentLogs: payload.recentLogs || [],
              currentPlan: payload.currentPlan || null,
              resourceCatalog: buildResourceCatalog()
            })
          }
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 4200
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.error?.message || "OpenAI API request failed."
      });
    }

    const parsed = parsePlan(extractOutputText(data));
    return sendJson(res, 200, {
      summary: parsed.summary,
      range: parsed.range || payload.range || "week",
      theme: parsed.theme || "",
      parentGuide: parsed.parentGuide || "",
      missions: parsed.missions || [],
      model: MODEL
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
};
