import { buildContactPrompt } from "../prompts/contactPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function enrichLeadContacts({ leads, eventName, enrichLimit }) {
  const leadsToEnrich = leads
    .filter(lead => lead.website)
    .slice(0, enrichLimit);

  const results = [];

  for (const lead of leadsToEnrich) {
    try {
      const contact = await findBestContactFromCompanyWebsite({
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

async function findBestContactFromCompanyWebsite({ companyName, website, eventName }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const urls = buildCandidateCompanyUrls(website);

  const contacts = [];

  for (const url of urls) {
    const contact = await scrapeContactPage({
      url,
      companyName,
      website,
      eventName
    });

    if (contact && !contact.canceled) {
      contacts.push(contact);
    }
  }

  const best = contacts
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];

  return best || {
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactRole: "",
    sourceUrl: "",
    confidence: 0,
    canceled: true
  };
}

async function scrapeContactPage({ url, companyName, website, eventName }) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      waitFor: 5000,
      timeout: 120000,
      formats: [
        {
          type: "json",
          prompt: buildContactPrompt({ companyName, website, eventName }),
          schema: contactSchema()
        }
      ]
    })
  });

  const data = await response.json();

  console.log("FIRECRAWL CONTACT SCRAPE STATUS:", response.status, url);
  console.log("FIRECRAWL CONTACT SCRAPE DATA:", JSON.stringify(data).slice(0, 1000));

  if (!response.ok || data.error) {
    return null;
  }

  const raw =
    data.data?.json ||
    data.json ||
    null;

  if (!raw) {
    return null;
  }

  return normalizeAndValidateContact(raw, website, url);
}

function buildCandidateCompanyUrls(website) {
  const base = normalizeBaseUrl(website);

  if (!base) {
    return [];
  }

  return [
    base,
    `${base}/about`,
    `${base}/about-us`,
    `${base}/team`,
    `${base}/leadership`,
    `${base}/management`,
    `${base}/people`,
    `${base}/contact`,
    `${base}/contact-us`
  ];
}

function normalizeBaseUrl(url) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return "";
  }
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

function normalizeAndValidateContact(contact, website, fallbackSourceUrl) {
  const email = contact.contactEmail || "";

  const normalized = {
    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    contactEmail: email,
    contactRole: contact.contactRole || "",
    sourceUrl: contact.sourceUrl || fallbackSourceUrl || "",
    confidence: Number(contact.confidence || 0),
    canceled: Boolean(contact.canceled)
  };

  if (normalized.canceled) {
    return normalized;
  }

  if (!normalized.contactFirstName && !normalized.contactLastName) {
    normalized.canceled = true;
    normalized.confidence = 0;
    return normalized;
  }

  if (email && !emailMatchesCompanyDomain(email, website)) {
    normalized.contactEmail = "";
    normalized.confidence = Math.min(normalized.confidence, 40);
  }

  return normalized;
}

function emailMatchesCompanyDomain(email, website) {
  try {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    const websiteDomain = new URL(
      website.startsWith("http") ? website : `https://${website}`
    ).hostname.replace(/^www\./, "").toLowerCase();

    return emailDomain === websiteDomain || emailDomain?.endsWith(`.${websiteDomain}`);
  } catch {
    return false;
  }
}