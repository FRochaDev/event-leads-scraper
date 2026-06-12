import express from "express";
import cors from "cors";
import * as glide from "@glideapps/tables";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

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

app.post("/scrape-event", async (req, res) => {
  console.log("HIT /scrape-event");
  console.log("BODY:", req.body);

  try {
    const body = req.body || {};

    const eventId =
      body.eventId ||
      body.eventID ||
      body.id;

    const startUrl =
      body.start_url ||
      body.eventURL ||
      body.eventUrl ||
      body.site ||
      body.url;

      const resultLimit = Math.min(
  Number(body.result_limit) || 50,
  100
);

    if (!eventId || !startUrl) {
      return res.status(400).json({
        error: true,
        message: "eventId and start_url are required",
        received: body
      });
    }

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
      return res.status(200).json({
        success: false,
        eventId,
        exhibitorsFound: 0,
        leadsCreated: 0,
        message: "No valid exhibitors found. The event URL may not be supported by this Apify actor."
      });
    }

    const createdRows = [];

    for (const exhibitor of normalized) {
      const rowId = await leadsTable.add({
        eventId: exhibitor.eventId,
        companyName: exhibitor.companyName,
        website: exhibitor.website,
        websiteFound: !!exhibitor.website,
        email: exhibitor.email,
        emailFound: !!exhibitor.email,
        contactPage: "",
        sourceUrl: exhibitor.sourceUrl,
        country: exhibitor.country,
        selected: false,
        contacted: false,
        notes: "",
        confidence: exhibitor.email ? 90 : 50,
        createdAt: new Date()
      });

      createdRows.push(rowId);
    }

await eventsTable.update(eventId, {
  scrappingStatus: "Completed",
  leadsFound: createdRows.length,
  lastScrapped: new Date(),
  responseStatus: "200",
  responseBody: JSON.stringify({
    exhibitorsFound: normalized.length,
    leadsCreated: createdRows.length
  })
});

return res.status(200).json({
  success: true,
  eventId,
  exhibitorsFound: normalized.length,
  leadsCreated: createdRows.length,
  preview: normalized.slice(0, 5)
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
/*app.post("/find-person-contact", async (req, res) => {
    console.log("FIND PERSON CONTACT");
  console.log("BODY:", req.body);
  try {
    const { companyName, eventName } = req.body || {};

    if (!companyName || !eventName) {
      return res.status(400).json({
        error: true,
        message: "companyName and eventName are required"
      });
    }

    const result = await findPersonContactWithAnthropic(
      companyName,
      eventName
    );

    return res.status(200).json({
      success: true,
      result
    });

  } catch (error) {
    console.error("ANTHROPIC CONTACT ERROR:", error);

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});*/
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function findPersonContactWithAnthropic(companyName, eventName) {
  const prompt = `
You are a B2B data extraction tool.

Identify the single best person at "${companyName}" to receive an email promoting trade show stand construction services for the event "${eventName}".

Prefer:
- marketing manager
- events manager
- trade show / exhibition manager
- partnerships / business development
- sales or commercial manager

Use only publicly available information.
If a direct person's email is unavailable, return the most relevant public company email.
If the event is canceled, return "Yes" in canceled, otherwise "No".

Return ONLY valid JSON with this exact structure:
{
  "company": "${companyName}",
  "contact_first_name": "",
  "contact_last_name": "",
  "contact_email": "",
  "contact_role": "",
  "source_url": "",
  "confidence": 0,
  "canceled": "No"
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
          max_uses: 5
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
const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);

if (!jsonMatch) {
  throw new Error("No JSON block found in Claude response");
}

return JSON.parse(jsonMatch[1]);
}
app.post("/enrich-event-contacts", async (req, res) => {
  console.log("HIT /enrich-event-contacts");
  console.log("BODY:", req.body);

  try {
    const { eventId, eventName } = req.body || {};

    if (!eventId || !eventName) {
      return res.status(400).json({
        error: true,
        message: "eventId and eventName are required",
        received: req.body
      });
    }

    const allLeads = await leadsTable.get();

const eventLeads = allLeads
  .filter(lead =>
    lead.eventId === eventId &&
    lead.companyName
  )
  .slice(0, 5);
  console.log("TOTAL LEADS:", allLeads.length);
console.log("SAMPLE LEAD:", JSON.stringify(allLeads[0], null, 2));
    console.log("LEADS TO ENRICH:", eventLeads.length);

    const results = [];
console.log(
  "FIRST LEAD:",
  JSON.stringify(eventLeads[0], null, 2)
);
  for (const lead of eventLeads) {
    
  await new Promise(resolve =>
    setTimeout(resolve, 1500)
  );

  try {

    const contact = await findPersonContactWithAnthropic(
      lead.companyName,
      eventName
    );

    await leadsTable.update(lead.$rowID, {
      contactFirstName: contact.contact_first_name || "",
      contactLastName: contact.contact_last_name || "",
      contactRole: contact.contact_role || "",
      contactSourceUrl: contact.source_url || "",

      email: contact.contact_email || "",
      emailFound: !!contact.contact_email,

      confidence: contact.confidence || 0
    });

    results.push({
      companyName: lead.companyName,
      success: true,
      email: contact.contact_email || "",
      contactName:
        `${contact.contact_first_name || ""} ${contact.contact_last_name || ""}`.trim()
    });

  } catch (error) {

    console.error(
      "ENRICH ERROR:",
      lead.companyName,
      error.message
    );

    results.push({
      companyName: lead.companyName,
      success: false,
      error: error.message
    });

  }
}

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      leadsProcessed: eventLeads.length,
      results
    });

  } catch (error) {
    console.error("ENRICH EVENT CONTACTS ERROR:", error);

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});