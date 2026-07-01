import { normalizeFirecrawlExhibitor } from "../utils/normalize.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function extractExhibitorsFromMarkdown({
  markdown,
  eventId,
  eventName,
  startUrl,
  resultLimit
}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }

  const prompt = `
You are extracting exhibitor leads from an event website.

Event: ${eventName}
Source URL: ${startUrl}

Extract exhibitors, sponsors, partners, startups, or companies listed as participating in the event.

Rules:
- Return only real company names.
- Ignore menu items, speakers, agenda sessions, ticket links, navigation, venue info, generic CTAs, and the event organizer unless it is listed as an exhibitor.
- Prefer companies in sections like Sponsors, Exhibitors, Partners, Aussteller, Sponsoren, Start-Up Zone.
- Include website if visible.
- Include country if visible.
- Include sourceUrl if visible.
- Return maximum ${resultLimit} companies.
- Return ONLY valid JSON.
- No markdown.
- No text before or after JSON.

Schema:
{
  "exhibitors": [
    {
      "companyName": "",
      "website": "",
      "email": "",
      "country": "",
      "sourceUrl": ""
    }
  ]
}

Markdown:
${markdown.slice(0, 120000)}
`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  console.log("ANTHROPIC EXTRACT STATUS:", response.status);

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  const text = data.content
    ?.filter(block => block.type === "text")
    ?.map(block => block.text)
    ?.join("")
    ?.trim();

  const jsonObjectMatch = text?.match(/\{[\s\S]*\}/);

  if (!jsonObjectMatch) {
    throw new Error("No JSON found in Claude exhibitor extraction response");
  }

  const parsed = JSON.parse(jsonObjectMatch[0]);

  const rawExhibitors = Array.isArray(parsed.exhibitors)
    ? parsed.exhibitors.slice(0, resultLimit)
    : [];

  return rawExhibitors
    .map(item => normalizeFirecrawlExhibitor(item, eventId, startUrl))
    .filter(item => item.companyName);
}