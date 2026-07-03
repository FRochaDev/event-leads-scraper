import { buildContactPrompt } from "../prompts/contactExtractionPrompt.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const CONCURRENCY = 3;

export async function enrichLeadContacts({
  leads,
  eventName,
  enrichLimit,
  onProgress
}) {
  const leadsToEnrich = leads
    .filter(lead => lead.website)
    .slice(0, enrichLimit);

  const results = [];
  let completed = 0;
  let totalCredits = 0;

  async function processLead(lead) {
    try {
      const result = await findBestContact({
        companyName: lead.companyName,
        website: lead.website,
        eventName
      });

      totalCredits += result.creditsUsed || 0;
      completed++;

      console.log(
        `ENRICHMENT PROGRESS: ${completed}/${leadsToEnrich.length} - ${lead.companyName}`
      );

      if (onProgress) {
        await onProgress(completed, leadsToEnrich.length, lead.companyName);
      }

      return {
        rowId: lead.rowId,
        companyName: lead.companyName,
        success: true,
        contact: result.contact,
        creditsUsed: result.creditsUsed || 0
      };
    } catch (error) {
      completed++;

      console.log("CONTACT ENRICH ERROR:", lead.companyName, error.message);

      if (onProgress) {
        await onProgress(completed, leadsToEnrich.length, lead.companyName);
      }

      return {
        rowId: lead.rowId,
        companyName: lead.companyName,
        success: false,
        error: error.message,
        creditsUsed: 0
      };
    }
  }

  for (let i = 0; i < leadsToEnrich.length; i += CONCURRENCY) {
    const batch = leadsToEnrich.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(processLead));
    results.push(...batchResults);
  }

  return {
    results,
    totalCredits
  };
}

async function findBestContact({ companyName, website, eventName }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const homeUrl = normalizeWebsiteUrl(website);

  if (!homeUrl) {
    return {
      contact: emptyContact(),
      creditsUsed: 0
    };
  }

  const homepage = await scrapeHomepageForLinks(homeUrl);
  const bestUrl = chooseBestContactUrl(homepage.links, homeUrl);

  console.log("BEST CONTACT URL:", companyName, bestUrl);

  const contactResult = await scrapeContactFromUrl({
    url: bestUrl,
    companyName,
    website: homeUrl,
    eventName
  });

  const contact = normalizeAndValidateContact(
    contactResult.contact,
    homeUrl,
    bestUrl
  );

  return {
    contact,
    creditsUsed:
      (homepage.creditsUsed || 0) +
      (contactResult.creditsUsed || 0)
  };
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
    links: data.data?.links || [],
    creditsUsed: data.data?.metadata?.creditsUsed || 0
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
  console.log(
    "FIRECRAWL CONTACT SCRAPE DATA:",
    JSON.stringify(data).slice(0, 1500)
  );

  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data));
  }

  return {
    contact: data.data?.json || data.json || null,
    creditsUsed: data.data?.metadata?.creditsUsed || 0
  };
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

  if (
    path.includes("/news") ||
    path.includes("/blog") ||
    path.includes("/press") ||
    path.includes("/media") ||
    path.includes("/resources") ||
    path.includes("/case-studies") ||
    path.includes("/products") ||
    path.includes("/product") ||
    path.includes("/sustainability") ||
    path.includes("/values") ||
    path.includes("/careers") ||
    path.includes("/jobs")
  ) {
    return 0;
  }

  const rules = [
    { token: "management-team", score: 100 },
    { token: "management_team", score: 100 },
    { token: "leadership-team", score: 95 },
    { token: "leadership", score: 90 },
    { token: "executive-team", score: 90 },
    { token: "contact-us", score: 85 },
    { token: "contact", score: 80 },
    { token: "our-team", score: 75 },
    { token: "team", score: 70 },
    { token: "people", score: 40 },
    { token: "about-us", score: 35 },
    { token: "about", score: 30 }
  ];

  const pathParts = path
    .split(/[\/\-_]+/)
    .filter(Boolean);

  const match = rules.find(rule => {
    const tokenParts = rule.token.split(/[\-_]+/);
    return tokenParts.every(part => pathParts.includes(part));
  });

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
      personEmail: { type: "string" },
      companyEmail: { type: "string" },
      contactRole: { type: "string" },
      country: { type: "string" },
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

  const normalized = {
    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    personEmail: contact.personEmail || "",
    companyEmail: contact.companyEmail || "",
    contactRole: contact.contactRole || "",
    country: contact.country || "",
    sourceUrl: contact.sourceUrl || sourceUrl || "",
    confidence: Number(contact.confidence || 0),
    canceled: Boolean(contact.canceled)
  };

  if (
    normalized.personEmail &&
    !emailMatchesCompanyDomain(normalized.personEmail, websiteDomain)
  ) {
    normalized.personEmail = "";
  }

  if (
    normalized.companyEmail &&
    !emailMatchesCompanyDomain(normalized.companyEmail, websiteDomain)
  ) {
    normalized.companyEmail = "";
  }

  if (
    normalized.companyEmail &&
    !isGenericEmail(normalized.companyEmail)
  ) {
    normalized.companyEmail = "";
  }

  if (normalized.personEmail && normalized.companyEmail) {
    normalized.companyEmail = "";
  }

  if (!normalized.personEmail && !normalized.companyEmail) {
    normalized.canceled = true;
    normalized.confidence = 0;
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

function isGenericEmail(email) {
  const localPart = email.split("@")[0]?.toLowerCase();

  return [
    "info",
    "contact",
    "sales",
    "marketing",
    "support",
    "press",
    "media",
    "hello",
    "enquiries",
    "enquiry",
    "admin",
    "office"
  ].includes(localPart);
}

function emptyContact() {
  return {
    contactFirstName: "",
    contactLastName: "",
    personEmail: "",
    companyEmail: "",
    contactRole: "",
    country: "",
    sourceUrl: "",
    confidence: 0,
    canceled: true
  };
}