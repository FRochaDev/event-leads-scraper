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
  table: "native-table-kaGkp45eRnfVonDI7LYM",
  columns: {
    eventName: { type: "string", name: "6yjzn" },
    eventUrl: { type: "uri", name: "fMJYV" },
    country: { type: "string", name: "5MqfO" },
    eventDate: { type: "date-time", name: "Xfwqb" },
    scrappingStatus: { type: "string", name: "6G5uy" },
    leadsFound: { type: "number", name: "4PJY9" },
    lastScrapped: { type: "date-time", name: "oO6V2" },
    responseBody: { type: "string", name: "I5pYh" },
    responseStatus: { type: "string", name: "F1gfv" }
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

async function findPersonContactWithAnthropic(companyName, website, eventName) {
  const prompt = `
You are a B2B lead research assistant.

Company: ${companyName}
Website: ${website || ""}
Event: ${eventName}

Task:
Find the SINGLE BEST contact for exhibition stand design and trade show services.

Priority order:
1. Event Manager
2. Exhibition Manager
3. Trade Show Manager
4. Marketing Manager
5. Brand Manager
6. Partnerships Manager
7. Business Development Manager
8. Marketing Director
9. CEO or Founder ONLY if nobody else is found

Rules:
- Prefer contacts directly involved in events, exhibitions, marketing or partnerships.
- Prefer contacts from the exhibitor company itself.
- Use the website to disambiguate companies with similar names.
- Do not return generic company emails unless no individual contact can be found.
- If an email cannot be verified, infer it from the company's public email format and lower confidence.
- Ignore sales representatives, recruiters, engineers, support staff and HR contacts.
- Return only ONE contact.
- Return ONLY valid JSON.
- No explanations.
- No markdown.
- No text before or after JSON.

Required JSON schema:
{
  "company":"",
  "contact_first_name":"",
  "contact_last_name":"",
  "contact_email":"",
  "contact_role":"",
  "source_url":"",
  "confidence":0,
  "canceled":"No"
}
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
      max_tokens: 300,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 1
        }
      ],
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

  const jsonBlockMatch = text?.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonBlockMatch) {
    return JSON.parse(jsonBlockMatch[1]);
  }

  const jsonObjectMatch = text?.match(/\{[\s\S]*\}/);

  if (jsonObjectMatch) {
    return JSON.parse(jsonObjectMatch[0]);
  }

  throw new Error("No JSON found in Claude response");
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
      scrappingStatus: "Running",
      lastScrapped: new Date()
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
        scrappingStatus: "Failed",
        lastScrapped: new Date(),
        responseStatus: String(actorResponse.status),
        responseBody: JSON.stringify(apifyData)
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

    if (normalized.length === 0) {
      await eventsTable.update(eventId, {
        scrappingStatus: "Completed - no valid exhibitors",
        leadsFound: 0,
        lastScrapped: new Date(),
        responseStatus: "200",
        responseBody: "No valid exhibitors found"
      });

      return res.status(200).json({
        success: false,
        eventId,
        exhibitorsFound: 0,
        leadsCreated: 0,
        contactsProcessed: 0,
        message: "No valid exhibitors found."
      });
    }

    const createdLeads = [];

    for (const exhibitor of normalized) {
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

        await eventsTable.update(eventId, {
  enrichStatus: "Completed",
  contactsFound: totalFound,
  contactsNotFound: totalMissing
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
      scrappingStatus: "Completed",
      leadsFound: createdLeads.length,
      lastScrapped: new Date(),
      responseStatus: "200",
      responseBody: JSON.stringify({
        exhibitorsFound: normalized.length,
        leadsCreated: createdLeads.length,
        contactsProcessed: enrichResults.length
      })
    });

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      exhibitorsFound: normalized.length,
      leadsCreated: createdLeads.length,
      contactsProcessed: enrichResults.length,
      enrichResults
    });

  } catch (error) {
    console.error("SCRAPE EVENT ERROR:", error);

    try {
      await eventsTable.update(eventId, {
        scrappingStatus: "Failed",
        lastScrapped: new Date(),
        responseStatus: "500",
        responseBody: error.message
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