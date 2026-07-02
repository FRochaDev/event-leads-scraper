import { buildContactPrompt } from "../prompts/contactPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function enrichLeadContacts({ leads, eventName, enrichLimit }) {
  const leadsToEnrich = leads
    .filter(lead => lead.website)
    .slice(0, enrichLimit);

  const results = [];

  for (const lead of leadsToEnrich) {
    try {
      const contact = await findBestContact({
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

async function findBestContact({ companyName, website, eventName }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const homeUrl = normalizeWebsiteUrl(website);

  if (!homeUrl) {
    return emptyContact();
  }

  const homepage = await scrapeHomepageForLinks(homeUrl);
  const bestUrl = chooseBestContactUrl(homepage.links, homeUrl);

  console.log("BEST CONTACT URL:", companyName, bestUrl);

  const contact = await scrapeContactFromUrl({
    url: bestUrl,
    companyName,
    website: homeUrl,
    eventName
  });

  return normalizeAndValidateContact(contact, homeUrl, bestUrl);
}

async function scrapeHomepageForLinks(url) {
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
      formats: ["markdown", "links"]
    })
  });

  const data = await response.json();

  console.log("FIRECRAWL HOMEPAGE STATUS:", response.status, url);

  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data));
  }

  return {
    markdown: data.data?.markdown || "",
    links: data.data?.links || []
  };
}

async function scrapeContactFromUrl({ url, companyName, website, eventName }) {
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
          prompt: buildContactPrompt({
            companyName,
            website,
            eventName
          }),
          schema: contactSchema()
        }
      ]
    })
  });

  const data = await response.json();

  console.log("FIRECRAWL CONTACT SCRAPE STATUS:", response.status, url);
  console.log("FIRECRAWL CONTACT SCRAPE DATA:", JSON.stringify(data).slice(0, 1500));

  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data));
  }

  return data.data?.json || data.json || null;
}

function chooseBestContactUrl(links, homeUrl) {
  const normalizedLinks = Array.isArray(links)
    ? links
        .map(link => normalizeLink(link, homeUrl))
        .filter(Boolean)
        .filter(link => sameDomain(link, homeUrl))
    : [];

  const scored = normalizedLinks
    .map(url => ({
      url,
      score: scoreUrl(url)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.url || homeUrl;
}

function scoreUrl(url) {
  const path = getPath(url);

  const rules = [
    { token: "management-team", score: 100 },
    { token: "management_team", score: 100 },
    { token: "leadership-team", score: 95 },
    { token: "leadership", score: 90 },
    { token: "executive-team", score: 90 },
    { token: "management", score: 80 },
    { token: "our-team", score: 75 },
    { token: "team", score: 70 },
    { token: "people", score: 65 },
    { token: "about-us", score: 45 },
    { token: "about", score: 40 },
    { token: "contact-us", score: 35 },
    { token: "contact", score: 30 },
    { token: "press", score: 15 },
    { token: "media", score: 15 }
  ];

  const match = rules.find(rule => path.includes(rule.token));
  return match ? match.score : 0;
}

function normalizeLink(link, homeUrl) {
  const raw = typeof link === "string" ? link : link?.url;

  if (!raw) return "";

  try {
    return new URL(raw, homeUrl).href.split("#")[0];
  } catch {
    return "";
  }
}

function normalizeWebsiteUrl(url) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return "";
  }
}

function sameDomain(urlA, urlB) {
  return getDomain(urlA) === getDomain(urlB);
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

function getPath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
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

function normalizeAndValidateContact(contact, website, sourceUrl) {
  if (!contact) {
    return emptyContact();
  }

  const websiteDomain = getDomain(website);
  const contactEmail = contact.contactEmail || "";

  const normalized = {
    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    contactEmail,
    contactRole: contact.contactRole || "",
    sourceUrl: contact.sourceUrl || sourceUrl || "",
    confidence: Number(contact.confidence || 0),
    canceled: Boolean(contact.canceled)
  };

  if (normalized.canceled) return normalized;

  if (!normalized.contactFirstName && !normalized.contactLastName) {
    return emptyContact();
  }

  if (
    contactEmail &&
    !emailMatchesCompanyDomain(contactEmail, websiteDomain)
  ) {
    normalized.contactEmail = "";
    normalized.confidence = Math.min(normalized.confidence, 40);
  }

  return normalized;
}

function emailMatchesCompanyDomain(email, websiteDomain) {
  const emailDomain = email.split("@")[1]?.toLowerCase();

  return (
    emailDomain === websiteDomain ||
    emailDomain?.endsWith(`.${websiteDomain}`)
  );
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