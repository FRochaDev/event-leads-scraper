import express from "express";
import cors from "cors";
import * as glide from "@glideapps/tables";
import { addDefaultTasks } from "./addDefaultTasks.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

const leadsTable = glide.table({
  token: process.env.GLIDE_TOKEN,
  app: "4emgJAe0tdBbNwo2rEeq",
  table: "native-table-2q2iGRqESIW68SLykDwf",
  columns: {
    eventId: { type: "string", name: "wqqEw" },
    companyName: { type: "string", name: "Zd1GL" },
    website: { type: "uri", name: "oSm1A" },
    websiteFound: { type: "boolean", name: "ltsRJ" },

    email: { type: "email-address", name: "Xz7P9" },
    emailFound: { type: "boolean", name: "GxyYQ" },

    emailContact: { type: "email-address", name: "mzBFs" },
    contactFirstName: { type: "string", name: "gZOTI" },
    contactLastName: { type: "string", name: "bozIA" },
    contactRole: { type: "string", name: "YNPib" },
    contactSourceUrl: { type: "uri", name: "vpvOh" },

    contactPage: { type: "uri", name: "Trypw" },
    sourceUrl: { type: "uri", name: "py9X9" },
    country: { type: "string", name: "h1fz0" },
    selected: { type: "boolean", name: "8XjYu" },
    contacted: { type: "boolean", name: "Jz3lG" },
    notes: { type: "string", name: "0LE4i" },
    confidence: { type: "number", name: "CsRyg" },
    createdAt: { type: "date-time", name: "5Jee0" }
  }
});

const eventsTable = glide.table({
    token: process.env.GLIDE_TOKEN,
    app: "4emgJAe0tdBbNwo2rEeq",
    table: "native-table-t2HyWYJua4PKB9CHCRBZ",
    columns: {
        evento: { type: "string", name: "7A8nT" },
        site: { type: "uri", name: "FCRaw" },

        leadsScrappingStatus: { type: "string", name: "Xfaf7" },
        leadsLeadsFound: { type: "number", name: "H5xem" },
        leadsLastScrapped: { type: "date-time", name: "Cesvc" },
        leadsResponseBody: { type: "string", name: "Z05gt" },
        leadsResponseBodyStatus: { type: "string", name: "Ha9z9" }
    }
});

app.get("/", (req, res) => {
  res.json({ status: "online" });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeExhibitor(item, eventId, startUrl) {
  return {
    eventId,
    companyName:
      item.__company_name ||
      item.companyName ||
      item.name ||
      item.title ||
      item.exhibitorName ||
      "",
    website:
      item._company_website ||
      item.website ||
      item.url ||
      item.companyWebsite ||
      "",
    email:
      item._company_email ||
      item.email ||
      item.contactEmail ||
      item.companyEmail ||
      "",
    sourceUrl:
      item.___exhibitor_profile_url ||
      item.sourceURL ||
      item.sourceUrl ||
      item.detailUrl ||
      startUrl,
    country:
      item._company_country ||
      item.country ||
      ""
  };
}

async function extractExhibitorsWithAnthropic(markdown, eventName, startUrl, resultLimit) {
  const prompt = `
You are extracting exhibitor leads from an event website.

Event: ${eventName}
Source URL: ${startUrl}

Extract exhibitors, sponsors, partners, startups, or companies listed as participating in the event.

Rules:
- Return only real company names.
- Ignore menu items, speakers, agenda sessions, ticket links, navigation, venue info, generic CTAs, and Terrapinn itself unless Terrapinn is listed as an exhibitor.
- Prefer companies in sections like Sponsors, Exhibitors, Partners, Aussteller, Sponsoren, Start-Up Zone.
- Include website if visible.
- Return maximum ${resultLimit} companies.
- Return ONLY valid JSON.

Schema:
{
  "exhibitors": [
    {
      "companyName": "",
      "website": "",
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

  return Array.isArray(parsed.exhibitors)
    ? parsed.exhibitors.slice(0, resultLimit)
    : [];
}

function normalizeFirecrawlExhibitor(item, eventId, startUrl) {
  return {
    eventId,
    companyName:
      item.companyName ||
      item.company_name ||
      item.name ||
      item.exhibitorName ||
      item.sponsorName ||
      "",
    website:
      item.website ||
      item.url ||
      item.companyWebsite ||
      "",
    email:
      item.email ||
      item.contactEmail ||
      "",
    sourceUrl:
      item.sourceUrl ||
      item.profileUrl ||
      startUrl,
    country:
      item.country ||
      ""
  };
}



async function scrapeExhibitorsWithFirecrawl(startUrl, eventId, resultLimit, eventName) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const crawlResponse = await fetch("https://api.firecrawl.dev/v2/crawl", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
body: JSON.stringify({
  url: startUrl,
  limit: 5,
  allowExternalLinks: false,
  scrapeOptions: {
    formats: ["markdown", "links"],
    onlyMainContent: false,
    timeout: 300000,
    waitFor: 10000
  }
})
  });

  const crawlData = await crawlResponse.json();

  console.log("FIRECRAWL CRAWL STATUS:", crawlResponse.status);
  console.log("FIRECRAWL CRAWL DATA:", JSON.stringify(crawlData).slice(0, 2000));

  if (!crawlResponse.ok || crawlData.error) {
    throw new Error(JSON.stringify(crawlData));
  }

  const statusUrl = crawlData.url;

for (let attempt = 1; attempt <= 20; attempt++) {
  await sleep(3000);

  const statusResponse = await fetch(statusUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`
    }
  });

  const statusData = await statusResponse.json();

  console.log("FIRECRAWL POLL STATUS:", statusResponse.status);
  console.log("FIRECRAWL POLL DATA:", JSON.stringify(statusData).slice(0, 2000));

  if (!statusResponse.ok || statusData.error) {
    throw new Error(JSON.stringify(statusData));
  }

  if (statusData.status === "completed") {
    const pages = statusData.data || [];

    const allText = pages
      .map(page => page.markdown || "")
      .join("\n\n");

    console.log("FIRECRAWL COMPLETED PAGES:", pages.length);
    console.log("FIRECRAWL MARKDOWN LENGTH:", allText.length);
    console.log(
  "FIRECRAWL SAMPLE:",
  allText.substring(0, 5000)
);
   const extractedExhibitors = await extractExhibitorsWithAnthropic(
  allText,
  eventName,
  startUrl,
  resultLimit
);

return extractedExhibitors
  .map(item => normalizeFirecrawlExhibitor(item, eventId, startUrl))
  .filter(item => item.companyName);
  }
}

throw new Error("Firecrawl crawl polling timed out");
}

app.post("/scrape-event", async (req, res) => {

  console.log("HIT /scrape-event");
console.log("BODY:", req.body);
  const body = req.body || {};

  const eventId = body.eventId;
  const eventName = body.eventName;
  const startUrl = body.start_url;

  const resultLimit = Math.min(
    Number(body.result_limit) || 20,
    100
  );

  const enrichLimit = Math.min(
    Number(body.enrich_limit) || 5,
    20
  );

  if (!eventId || !eventName || !startUrl) {
    return res.status(400).json({
      error: true,
      message: "eventId, eventName and start_url are required",
      received: body
    });
  }

  try {
    await eventsTable.update(eventId, {
      leadsScrappingStatus: "Running",
      leadsLastScrapped: new Date()
    });

    const actorResponse = await fetch(
      `https://api.apify.com/v2/acts/skython~exhibitor-list-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          get_booth_sizes: false,
          output_type: "single_row",
          result_limit: resultLimit,
          start_url: startUrl
        })
      }
    );

    console.log("APIFY STATUS:", actorResponse.status);

    const apifyData = await actorResponse.json();

    if (!actorResponse.ok || apifyData.error) {
      await eventsTable.update(eventId, {
        leadsScrappingStatus: "Failed",
        leadsLastScrapped: new Date(),
        leadsResponseBodyStatus: String(actorResponse.status),
        leadsResponseBody: JSON.stringify(apifyData)
      });

      return res.status(500).json({
        error: true,
        source: "apify",
        status: actorResponse.status,
        message: apifyData?.error?.message || "Apify request failed",
        details: apifyData
      });
    }

    const exhibitors = Array.isArray(apifyData) ? apifyData : [];

    const normalized = exhibitors
      .filter(item =>
        item.__company_name ||
        item.companyName ||
        item.name ||
        item.title ||
        item.exhibitorName
      )
      .map(item => normalizeExhibitor(item, eventId, startUrl))
      .filter(item =>
        item.companyName &&
        !item.companyName.toLowerCase().includes("given url is not supported") &&
        !item.companyName.toLowerCase().includes("please note")
      );

let finalNormalized = normalized;
let scrapeSource = "apify";

if (finalNormalized.length === 0) {
  console.log("APIFY RETURNED 0 VALID EXHIBITORS — TRYING FIRECRAWL");

  try {
finalNormalized = await scrapeExhibitorsWithFirecrawl(
  startUrl,
  eventId,
  resultLimit,
  eventName
);

    scrapeSource = "firecrawl";
  } catch (firecrawlError) {
    console.log("FIRECRAWL ERROR:", firecrawlError.message);

    await eventsTable.update(eventId, {
      leadsScrappingStatus: "Completed - no valid exhibitors",
      leadsLeadsFound: 0,
      leadsLastScrapped: new Date(),
      leadsResponseBodyStatus: "200",
      leadsResponseBody: JSON.stringify({
        apify: "No valid exhibitors found",
        firecrawlError: firecrawlError.message
      })
    });

    return res.status(200).json({
      success: false,
      eventId,
      exhibitorsFound: 0,
      leadsCreated: 0,
      contactsProcessed: 0,
      source: "apify+firecrawl",
      message: "No valid exhibitors found."
    });
  }
}

if (finalNormalized.length === 0) {
  await eventsTable.update(eventId, {
    leadsScrappingStatus: "Completed - no valid exhibitors",
    leadsLeadsFound: 0,
    leadsLastScrapped: new Date(),
    leadsResponseBodyStatus: "200",
    leadsResponseBody: "No valid exhibitors found"
  });

  return res.status(200).json({
    success: false,
    eventId,
    exhibitorsFound: 0,
    leadsCreated: 0,
    contactsProcessed: 0,
    source: scrapeSource,
    message: "No valid exhibitors found."
  });
}

    const createdLeads = [];

    for (const exhibitor of finalNormalized) {
      const rowId = await leadsTable.add({
        eventId: exhibitor.eventId,
        companyName: exhibitor.companyName,
        website: exhibitor.website,
        websiteFound: !!exhibitor.website,

        email: exhibitor.email,
        emailFound: !!exhibitor.email,

        emailContact: "",
        contactFirstName: "",
        contactLastName: "",
        contactRole: "",
        contactSourceUrl: "",

        contactPage: "",
        sourceUrl: exhibitor.sourceUrl,
        country: exhibitor.country,
        selected: true,
        contacted: false,
        notes: "",
        confidence: exhibitor.email ? 90 : 50,
        createdAt: new Date()
      });

      createdLeads.push({
        rowId,
        ...exhibitor
      });
    }

    console.log("LEADS CREATED:", createdLeads.length);

    const enrichResults = [];
    const leadsToEnrich = createdLeads.slice(0, enrichLimit);

    for (const lead of leadsToEnrich) {
      await sleep(1500);

      try {
const contact = await findPersonContactWithAnthropic(
  lead.companyName,
  lead.website,
  eventName
);

        await leadsTable.update(lead.rowId, {
          contactFirstName: contact.contact_first_name || "",
          contactLastName: contact.contact_last_name || "",
          contactRole: contact.contact_role || "",
          contactSourceUrl: contact.source_url || "",

          emailContact: contact.contact_email || "",

          confidence: contact.confidence || 0
        });

        enrichResults.push({
          companyName: lead.companyName,
          success: true,
          emailContact: contact.contact_email || "",
          contactName:
            `${contact.contact_first_name || ""} ${contact.contact_last_name || ""}`.trim(),
          role: contact.contact_role || "",
          confidence: contact.confidence || 0
        });

      } catch (error) {
        console.log(
          "ENRICH ERROR:",
          lead.companyName,
          error.message
        );

        enrichResults.push({
          companyName: lead.companyName,
          success: false,
          error: error.message
        });

        if (
          error.message.includes("rate_limit_error") ||
          error.message.includes("rate limit")
        ) {
          console.log("RATE LIMIT HIT — STOPPING ENRICHMENT");
          break;
        }
      }
    }

await eventsTable.update(eventId, {
  leadsScrappingStatus: "Completed",
  leadsLeadsFound: createdLeads.length,
  leadsLastScrapped: new Date(),
  leadsResponseBodyStatus: "200",
  leadsResponseBody: JSON.stringify({
    exhibitorsFound: finalNormalized.length,
source: scrapeSource,
    leadsCreated: createdLeads.length,
    contactsProcessed: enrichResults.length
  })
});

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      exhibitorsFound: finalNormalized.length,
source: scrapeSource,
      leadsCreated: createdLeads.length,
      contactsProcessed: enrichResults.length,
      enrichResults
    });

  } catch (error) {
    console.error("SCRAPE EVENT ERROR:", error);

    try {
await eventsTable.update(eventId, {
  leadsScrappingStatus: "Failed",
  leadsLastScrapped: new Date(),
  leadsResponseBodyStatus: "500",
  leadsResponseBody: error.message
});
    } catch {}

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.post("/add-default-tasks", addDefaultTasks);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});