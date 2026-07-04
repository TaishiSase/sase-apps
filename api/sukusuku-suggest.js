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
    "あなたは0歳から6歳の子どもを育てる親のためのAI育児コンシェルジュです。",
    "目的は、親の不安をやわらげ、今日できる具体的な遊び、声かけ、教育方針に変えることです。",
    "医療診断、発達診断、治療方針の断定は禁止です。",
    "発達や診断名に近い情報があっても、家庭でできる小さな関わりと専門家相談の目安に留めてください。",
    "親を責めず、子どもを採点せず、いいところを伸ばし、次に育てたい力を補う表現にしてください。",
    "必ずJSONだけを返してください。Markdownや説明文は不要です。",
    "JSON形式: {\"summary\":\"短い総括\",\"suggestions\":[{\"type\":\"quick|creative|deep\",\"title\":\"\",\"aim\":\"\",\"materials\":\"\",\"steps\":[\"\"],\"phrases\":[\"\"],\"skills\":[\"\"],\"fallback\":\"\"}]}",
    "suggestionsは必ず3件で、quick, creative, deepを1件ずつ含めてください。"
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
              consultationType: payload.consultationType,
              durationType: payload.durationType,
              advisorTone: payload.advisorTone,
              categories: payload.categoryLabels || payload.categories || [],
              parentMessage: payload.message || "",
              recentLogs: payload.recentLogs || []
            })
          }
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 1800
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
