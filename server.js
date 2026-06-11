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

    console.log("APIFY DATA:");
    console.log(JSON.stringify(apifyData, null, 2));

    if (!actorResponse.ok || apifyData.error) {
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

    return res.status(200).json({
      success: true,
      eventId,
      exhibitorsFound: normalized.length,
      leadsCreated: createdRows.length,
      preview: normalized.slice(0, 5)
    });

  } catch (error) {
    console.error("SCRAPE EVENT ERROR:", error);

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});