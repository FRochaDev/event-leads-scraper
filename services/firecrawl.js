import { normalizeFirecrawlExhibitor } from "../utils/normalize.js";
import { buildExhibitorPrompt } from "../prompts/exhibitorPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function extractExhibitorsFromEvent({
  eventId,
  eventName,
  startUrl,
  resultLimit
}) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: startUrl,
      onlyMainContent: false,
      waitFor: 10000,
      timeout: 500000,
      formats: [
        {
          type: "json",
          prompt: buildExhibitorPrompt({ eventName, startUrl, resultLimit }),
          schema: {
            type: "object",
            properties: {
              exhibitors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    companyName: { type: "string" },
                    website: { type: "string" },
                    email: { type: "string" },
                    country: { type: "string" },
                    sourceUrl: { type: "string" }
                  },
                  required: ["companyName"]
                }
              }
            },
            required: ["exhibitors"]
          }
        }
      ]
    })
  });

  const data = await response.json();

  console.log("FIRECRAWL SCRAPE STATUS:", response.status);
  console.log("FIRECRAWL SCRAPE DATA:", JSON.stringify(data).slice(0, 2000));

  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data));
  }

  const rawExhibitors =
    data.data?.json?.exhibitors ||
    data.json?.exhibitors ||
    data.exhibitors ||
    [];

const creditsUsed = data.data?.metadata?.creditsUsed || 0;

if (!Array.isArray(rawExhibitors)) {
  return {
    exhibitors: [],
    creditsUsed
  };
}

const exhibitors = rawExhibitors
  .slice(0, resultLimit)
  .map(item => normalizeFirecrawlExhibitor(item, eventId, startUrl))
  .filter(item => item.companyName);

return {
  exhibitors,
  creditsUsed
};
}

