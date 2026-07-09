import { buildClaudeContactPrompt } from "../prompts/contactExtractionPrompt.js";
import { extractContactsWithClaude } from "./claudeContactExtraction.js";
import { extractEmails } from "./emailExtractor.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const CONCURRENCY = 10;

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
  console.log("START:", lead.companyName);

  try {
    const result = await findBestContact({
      companyName: lead.companyName,
      website: lead.website,
      eventName
    });

    completed++;

    console.log("FINISHED:", lead.companyName);
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

  console.log(
    `STARTING BATCH ${i / CONCURRENCY + 1} (${batch.length} companies)`
  );

  const batchResults = await Promise.all(batch.map(processLead));

  batchResults.forEach(result => {
    totalCredits += result.creditsUsed || 0;
  });

  results.push(...batchResults);
}

console.log(
  `ENRICHMENT FINISHED. Processed ${completed}/${leadsToEnrich.length}. Credits used: ${totalCredits}`
);

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
  const bestUrls = chooseBestContactUrls(homepage.links, homeUrl);

  console.log("BEST CONTACT URLS:", companyName, bestUrls);

  let combinedMarkdown = "";
  let creditsUsed = homepage.creditsUsed || 0;

  for (const url of bestUrls) {
    const result = await scrapeContactFromUrl({
      url,
      companyName,
      website: homeUrl,
      eventName
    });

    combinedMarkdown += `\n\n====================\nSOURCE: ${url}\n\n`;
    combinedMarkdown += result.markdown || "";

    creditsUsed += result.creditsUsed || 0;
  }

  console.log(
    "CONTACT MARKDOWN SAMPLE:",
    combinedMarkdown.slice(0, 1000)
  );
const extractedEmails = extractEmails(
  combinedMarkdown,
  getDomain(homeUrl)
);

console.log("EMAILS FOUND BY REGEX:", companyName, extractedEmails);
  const extracted = await extractContactsWithClaude({
    companyName,
    website: homeUrl,
    eventName,
    sourceUrl: bestUrls[0] || homeUrl,
    markdown: combinedMarkdown
  });

  const contact = normalizeAndValidateContact(
    extracted,
    homeUrl,
    bestUrls[0] || homeUrl
  );

  return {
    contact,
    creditsUsed
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
formats: ["markdown"]
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
  markdown: data.data?.markdown || "",
  creditsUsed: data.data?.metadata?.creditsUsed || 0
};
}

function chooseBestContactUrls(links, homeUrl) {
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

  const MAX_CONTACT_PAGES = 3;

  const best = scored
    .slice(0, MAX_CONTACT_PAGES)
    .map(item => item.url);

  return best.length ? best : [homeUrl];
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
  { token: "contact-us", score: 100 },
  { token: "contact", score: 95 },
  { token: "events", score: 25 },
  { token: "event", score: 20 },
  { token: "marketing", score: 80 },
  { token: "sales", score: 75 },
  { token: "partnerships", score: 70 },
  { token: "partners", score: 65 },
  { token: "business-development", score: 60 },
  { token: "commercial", score: 55 },

  { token: "our-team", score: 45 },
  { token: "team", score: 40 },
  { token: "people", score: 35 },
  { token: "meet-the-team", score: 75 },
  { token: "our-people", score: 70 },
  { token: "team-members", score: 65 },
  { token: "staff", score: 55 },
  { token: "directory", score: 50 },
  { token: "about-us", score: 20 },
  { token: "about", score: 15 },

  { token: "leadership-team", score: 5 },
  { token: "leadership", score: 5 },
  { token: "management-team", score: 5 },
  { token: "executive-team", score: 1 }
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
      country: { type: "string" },
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
            sourceUrl: { type: "string" },
            confidence: { type: "number" }
          }
        }
      }
    },
    required: ["contacts"]
  };
}

function normalizeAndValidateContact(extracted, website, sourceUrl) {
  if (!extracted) {
    return emptyContact();
  }

  const websiteDomain = getDomain(website);
  const contacts = Array.isArray(extracted.contacts)
    ? extracted.contacts
    : [];

  const country = extracted.country || "";

  if (!contacts.length) {
    const empty = emptyContact();
    empty.country = country;
    return empty;
  }

  const candidates = contacts.map(candidate => {
    const normalized = {
      contactFirstName: candidate.firstName || "",
      contactLastName: candidate.lastName || "",
      personEmail: candidate.email || "",
      companyEmail: "",
      contactRole: candidate.role || "",
      country,
      sourceUrl: candidate.sourceUrl || sourceUrl || "",
      confidence: Number(candidate.confidence || 0),
      canceled: false
    };

    return cleanCandidate(normalized, websiteDomain);
  });

  const validCandidates = candidates.filter(candidate =>
    candidate.personEmail ||
    candidate.contactFirstName ||
    candidate.contactLastName ||
    candidate.contactRole
  );

  if (!validCandidates.length) {
    const empty = emptyContact();
    empty.country = country;
    return empty;
  }

  validCandidates.sort((a, b) => scoreContact(b) - scoreContact(a));

  const best = validCandidates[0];

  if (!best.personEmail) {
    best.companyEmail = findBestCompanyEmail(contacts, websiteDomain);
  }

  if (!best.personEmail && !best.companyEmail) {
    best.canceled = true;
    best.confidence = 0;
  }

  return best;
}

function cleanCandidate(candidate, websiteDomain) {
  candidate.contactFirstName = candidate.contactFirstName.trim();
  candidate.contactLastName = candidate.contactLastName.trim();
  candidate.contactRole = candidate.contactRole.trim();
  candidate.personEmail = candidate.personEmail.trim().toLowerCase();

  const first = candidate.contactFirstName.toLowerCase();
  const last = candidate.contactLastName.toLowerCase();

  const invalidNames = ["john", "jane", "doe", "test", "tester", "admin", "unknown", "n/a", "na", "-"];

  if (
    (first === "john" && last === "doe") ||
    (first === "jane" && last === "doe") ||
    invalidNames.includes(first) ||
    invalidNames.includes(last)
  ) {
    candidate.contactFirstName = "";
    candidate.contactLastName = "";
    candidate.contactRole = "";
    candidate.personEmail = "";
    candidate.confidence = 0;
  }

  if (
    candidate.personEmail &&
    !emailMatchesCompanyDomain(candidate.personEmail, websiteDomain)
  ) {
    candidate.personEmail = "";
  }

  return candidate;
}

function scoreContact(contact) {
  const role = contact.contactRole.toLowerCase();

  let score = 0;

  if (contact.personEmail) score += 60;

  if (role.includes("event")) score += 50;
  if (role.includes("exhibition")) score += 50;
  if (role.includes("trade show")) score += 50;
  if (role.includes("marketing manager")) score += 45;
  if (role.includes("field marketing")) score += 45;
  if (role.includes("partnership")) score += 40;
  if (role.includes("business development")) score += 40;
  if (role.includes("sales manager")) score += 35;
  if (role.includes("regional sales")) score += 35;
  if (role.includes("coordinator")) score += 30;
  if (role.includes("brand")) score += 25;
  if (role.includes("founder")) score += 15;

  if (role.includes("ceo")) score -= 80;
  if (role.includes("cmo")) score -= 60;
  if (role.includes("cto")) score -= 80;
  if (role.includes("cfo")) score -= 80;
  if (role.includes("vp")) score -= 60;
  if (role.includes("vice president")) score -= 60;
  if (role.includes("president")) score -= 60;
  if (role.includes("board")) score -= 80;
  if (role.includes("press")) score -= 70;
  if (role.includes("pr ")) score -= 70;
  if (role.includes("public relations")) score -= 70;
  if (role.includes("communications")) score -= 60;
  if (role.includes("media relations")) score -= 70;
  if (role.includes("journalist")) score -= 90;
  if (role.includes("editor")) score -= 80;

  score += Number(contact.confidence || 0);

  return score;
}

function findBestCompanyEmail(contacts, websiteDomain) {
  const emails = contacts
    .map(contact => contact.email || "")
    .filter(Boolean)
    .map(email => email.trim().toLowerCase())
    .filter(email => emailMatchesCompanyDomain(email, websiteDomain))
    .filter(email => isGenericEmail(email));

  const priority = [
    "events",
    "marketing",
    "partnerships",
    "business",
    "sales",
    "info",
    "contact",
    "hello",
    "office"
  ];

  return emails.sort((a, b) => {
    const aLocal = a.split("@")[0];
    const bLocal = b.split("@")[0];

    const aScore = priority.indexOf(aLocal);
    const bScore = priority.indexOf(bLocal);

    return (aScore === -1 ? 999 : aScore) - (bScore === -1 ? 999 : bScore);
  })[0] || "";
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