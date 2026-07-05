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
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n");
}

function parseSuggestions(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON.");
  }
}

function buildInstructions() {
  return [
    "あなたはHagumi「きょう、なにしよう。」のAI育児コンシェルジュです。0歳から6歳の子どもを育てる親を支えます。",
    "目的は、親の不安をやわらげ、今日できる具体的な遊び、声かけ、教育方針に変えることです。",
    "ターゲットは教育熱心で質の高い情報を求める保護者です。上品で落ち着いた語り口にし、過度な不安訴求や断定を避けてください。",
    "提案は、発達心理・幼児教育・小児保健で広く受け入れられている考え方を背景にしてください。特に、Harvard Center on the Developing Childのserve and return、NAEYCのDevelopmentally Appropriate Practice、CDCの発達マイルストーン確認、遊びを通じた学び、親子の応答的な関わりを優先してください。",
    "医療診断、発達診断、治療方針の断定は禁止です。",
    "発達や診断名に近い情報があっても、家庭でできる小さな関わりと専門家相談の目安に留めてください。",
    "親を責めず、子どもを採点せず、いいところを伸ばし、次に育てたい力を補う表現にしてください。",
    "エビデンスは論文風に長くせず、保護者が納得できる短い背景として書いてください。根拠が強い一般原則と、個別の推測を分けてください。",
    "必ずJSONだけを返してください。Markdownや説明文は不要です。",
    "evidenceTagは必ず次のいずれかにしてください: \"Harvard型: 応答的な関わり\", \"NAEYC型: 発達に合った遊び\", \"CDC型: 観察と相談目安\"。",
    "教材・動画・アプリが役立つ場合のみ、resourceLinksに公式サイトや公式チャンネルを最大2件入れてください。英語・音楽・運動・科学・絵本・算数がカテゴリに含まれる場合は、少なくとも1つの提案にresourceLinksを入れてください。URLはユーザー入力ではなく、resourceCatalogにあるURLだけを使ってください。",
    "JSON形式: {\"summary\":\"短い総括\",\"suggestions\":[{\"type\":\"quick|creative|deep\",\"title\":\"\",\"aim\":\"\",\"materials\":\"\",\"steps\":[\"\"],\"phrases\":[\"\"],\"skills\":[\"\"],\"evidenceTag\":\"Harvard型: 応答的な関わり\",\"evidence\":\"発達・教育上の背景を80字程度で\",\"observe\":\"親が見るポイントを1つ\",\"consult\":\"心配が続く場合の相談目安を柔らかく\",\"fallback\":\"\",\"resourceLinks\":[{\"title\":\"\",\"type\":\"動画|アプリ|サイト\",\"url\":\"\",\"note\":\"親向けの短い使い方\"}]}]}",
    "suggestionsは必ず3件で、quick, creative, deepを1件ずつ含めてください。"
  ].join("\n");
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
    }
  ];
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
              consultationType: payload.consultationType,
              durationType: payload.durationType,
              advisorTone: payload.advisorTone,
              categories: payload.categoryLabels || payload.categories || [],
              parentMessage: payload.message || "",
              recentLogs: payload.recentLogs || [],
              resourceCatalog: buildResourceCatalog()
            })
          }
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 2400
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.error?.message || "OpenAI API request failed."
      });
    }

    const outputText = extractOutputText(data);
    const parsed = parseSuggestions(outputText);
    return sendJson(res, 200, {
      summary: parsed.summary,
      suggestions: parsed.suggestions,
      model: MODEL
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
};
