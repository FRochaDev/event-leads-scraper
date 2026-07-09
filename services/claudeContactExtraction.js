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

  const safeMarkdown = (markdown || "").slice(0, 25000);

  const prompt = `
You extract B2B prospecting contacts from webpage markdown.

Use ONLY the markdown provided.
Do not use outside knowledge.
Do not invent names, roles, emails or URLs.

Company: ${companyName}
Website: ${website}
Event: ${eventName}
Source URL: ${sourceUrl}

Return JSON only with this schema:

{
  "company": "",
  "country": "",
  "contacts": [
    {
      "firstName": "",
      "lastName": "",
      "email": "",
      "role": "",
      "sourceUrl": "",
      "confidence": 0
    }
  ]
}

Rules:
- Extract only people or emails explicitly visible in the markdown.
- If a real person is visible but no email is visible, return the person with email blank.
- If only a generic company email is visible, return it with firstName and lastName blank.
- Email must belong to the company domain.
- Ignore event organisers, media companies and unrelated third parties.
- Return maximum 5 contacts.
- If nothing relevant is visible, return contacts as an empty array.

Markdown:
${safeMarkdown}
`;

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

  try {
    return JSON.parse(text);
  } catch {
    console.log("CLAUDE JSON PARSE ERROR:", text);
    return {
      company: companyName,
      country: "",
      contacts: []
    };
  }
}