import { buildContactPrompt } from "../prompts/contactPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function enrichLeadContacts({ leads, eventName, enrichLimit }) {
  const leadsToEnrich = leads
    .filter(lead => lead.website || lead.companyName)
    .slice(0, enrichLimit);

  const results = [];

  for (const lead of leadsToEnrich) {
    try {
      const contact = await findBestContactWithFirecrawl({
        companyName: lead.companyName,
        website: lead.website,
        eventName
      });

      results.push({
        rowId: lead.rowId,
        companyName: lead.companyName,
        success: true,
        contact
      });
    } catch (error) {
      console.log("CONTACT ENRICH ERROR:", lead.companyName, error.message);

      results.push({
        rowId: lead.rowId,
        companyName: lead.companyName,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

async function findBestContactWithFirecrawl({ companyName, website, eventName }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const query = buildSearchQuery({ companyName, website, eventName });

  const searchResponse = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: {
        formats: [
          {
            type: "json",
            prompt: buildContactPrompt({ companyName, website, eventName }),
            schema: contactSchema()
          }
        ],
        onlyMainContent: false,
        timeout: 120000
      }
    })
  });

  const searchData = await searchResponse.json();

  console.log("FIRECRAWL CONTACT SEARCH STATUS:", searchResponse.status);
  console.log("FIRECRAWL CONTACT SEARCH DATA:", JSON.stringify(searchData).slice(0, 2000));

  if (!searchResponse.ok || searchData.error) {
    throw new Error(JSON.stringify(searchData));
  }

  const candidates = extractContactsFromSearch(searchData);

  const best = candidates
    .filter(contact => contact && !contact.canceled)
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];

  return normalizeContact(best || {});
}

function buildSearchQuery({ companyName, website, eventName }) {
  const domain = website ? safeDomain(website) : "";

  return [
    `"${companyName}"`,
    domain,
    "event manager OR marketing manager OR exhibition manager OR trade show manager",
    eventName
  ]
    .filter(Boolean)
    .join(" ");
}

function contactSchema() {
  return {
    type: "object",
    properties: {
      company: { type: "string" },
      contactFirstName: { type: "string" },
      contactLastName: { type: "string" },
      contactEmail: { type: "string" },
      contactRole: { type: "string" },
      sourceUrl: { type: "string" },
      confidence: { type: "number" },
      canceled: { type: "boolean" }
    },
    required: ["canceled"]
  };
}

function extractContactsFromSearch(searchData) {
  const results = searchData.data || searchData.results || [];

  return results
    .map(result =>
      result.json ||
      result.data?.json ||
      result.scrape?.json ||
      result.content?.json
    )
    .filter(Boolean);
}

function normalizeContact(contact) {
  return {
    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    contactEmail: contact.contactEmail || "",
    contactRole: contact.contactRole || "",
    sourceUrl: contact.sourceUrl || "",
    confidence: Number(contact.confidence || 0),
    canceled: Boolean(contact.canceled)
  };
}

function safeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}