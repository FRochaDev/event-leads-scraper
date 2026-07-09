import { buildClaudeContactPrompt } from "../prompts/contactExtractionPrompt.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function extractContactsWithClaude({
  companyName,
  website,
  eventName,
  sourceUrl,
  markdown
}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

const prompt = buildClaudeContactPrompt({
  companyName,
  website,
  eventName,
  sourceUrl,
  markdown
});

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  console.log("CLAUDE STATUS:", response.status, companyName);
  console.log("CLAUDE RAW:", JSON.stringify(data).slice(0, 1500));

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  const text = data.content?.[0]?.text || "{}";

const cleanedText = text
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/```$/i, "")
  .trim();

try {
  return JSON.parse(cleanedText);
} catch {
  console.log("CLAUDE JSON PARSE ERROR:", text);
  return {
    company: companyName,
    country: "",
    contacts: []
  };
}
}