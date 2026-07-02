import { buildContactPrompt } from "../prompts/contactPrompt.js";
import { buildContactNavigationPrompt } from "../prompts/contactNavigationPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function enrichLeadContacts({ leads, eventName, enrichLimit }) {
  const leadsToEnrich = leads
    .filter(lead => lead.website)
    .slice(0, enrichLimit);

  const results = [];

  for (const lead of leadsToEnrich) {
    try {
      const contact = await findBestContactWithAgent({
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

async function findBestContactWithAgent({ companyName, website, eventName }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const startUrl = normalizeWebsiteUrl(website);

  if (!startUrl) {
    return emptyContact();
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
      waitFor: 5000,
      timeout: 120000,
      agent: {
        model: "FIRE-1",
        prompt: buildContactNavigationPrompt({
          companyName,
          website: startUrl
        })
      },
      formats: [
        {
          type: "json",
          prompt: buildContactPrompt({ companyName, website: startUrl, eventName }),
          schema: contactSchema()
        }
      ]
    })
  });

  const data = await response.json();

  console.log("FIRECRAWL CONTACT AGENT STATUS:", response.status, startUrl);
  console.log("FIRECRAWL CONTACT AGENT DATA:", JSON.stringify(data).slice(0, 1500));

  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data));
  }

  const raw =
    data.data?.json ||
    data.json ||
    null;

  if (!raw) {
    return emptyContact();
  }

  return normalizeAndValidateContact(raw, startUrl);
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

function normalizeAndValidateContact(contact, website) {
  const websiteDomain = getDomain(website);
  const sourceDomain = getDomain(contact.sourceUrl || website);

  const normalized = {
    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    contactEmail: contact.contactEmail || "",
    contactRole: contact.contactRole || "",
    sourceUrl: contact.sourceUrl || website,
    confidence: Number(contact.confidence || 0),
    canceled: Boolean(contact.canceled)
  };

  if (normalized.canceled) return normalized;

  if (!normalized.contactFirstName && !normalized.contactLastName) {
    return emptyContact();
  }

  if (sourceDomain && websiteDomain && sourceDomain !== websiteDomain) {
    return emptyContact();
  }

  if (
    normalized.contactEmail &&
    !emailMatchesCompanyDomain(normalized.contactEmail, websiteDomain)
  ) {
    normalized.contactEmail = "";
    normalized.confidence = Math.min(normalized.confidence, 40);
  }

  return normalized;
}

function emptyContact() {
  return {
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactRole: "",
    sourceUrl: "",
    confidence: 0,
    canceled: true
  };
}

function normalizeWebsiteUrl(url) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return "";
  }
}

function getDomain(url) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function emailMatchesCompanyDomain(email, websiteDomain) {
  const emailDomain = email.split("@")[1]?.toLowerCase();
  return emailDomain === websiteDomain || emailDomain?.endsWith(`.${websiteDomain}`);
}