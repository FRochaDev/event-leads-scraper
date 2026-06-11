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
  res.json({
    status: "online"
  });
});

function normalizeExhibitor(item, eventId, eventURL) {
  const companyName =
    item.__company_name ||
    item.companyName ||
    item.name ||
    item.title ||
    item.exhibitorName ||
    "";

  const website =
    item._company_website ||
    item.website ||
    item.url ||
    item.companyWebsite ||
    "";

  const email =
    item._company_email ||
    item.email ||
    item.contactEmail ||
    item.companyEmail ||
    "";

  const sourceUrl =
    item.___exhibitor_profile_url ||
    item.sourceURL ||
    item.sourceUrl ||
    item.detailUrl ||
    eventURL;

  const country =
    item._company_country ||
    item.country ||
    "";

  return {
    eventId,
    companyName,
    website,
    email,
    sourceUrl,
    country
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

    const eventURL =
      body.eventURL ||
      body.eventUrl ||
      body.site ||
      body.url;

    if (!eventId || !eventURL) {
      return res.status(400).json({
        error: true,
        message: "eventId and eventURL are required",
        received: body
      });
    }

    console.log("NEW SCRAPE REQUEST");
    console.log("Event:", eventId);
    console.log("URL:", eventURL);

    const actorResponse = await fetch(
      `https://api.apify.com/v2/acts/skython~exhibitor-list-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
 body: JSON.stringify({
  start_url: eventURL,
  get_booth_sizes: false,
  output_type: "single_row",
  result_limit: 500
})
      }
    );

    console.log("APIFY STATUS:", actorResponse.status);

    const apifyData = await actorResponse.json();

    console.log("APIFY DATA:");
    console.log(JSON.stringify(apifyData, null, 2));

    if (!actorResponse.ok || apifyData.error) {
      console.log("APIFY FAILED");

      return res.status(500).json({
        error: true,
        source: "apify",
        status: actorResponse.status,
        message:
          apifyData?.error?.message ||
          "Apify request failed",
        details: apifyData
      });
    }

    const exhibitors = Array.isArray(apifyData)
      ? apifyData
      : [];

    const normalized = exhibitors
      .map(item => normalizeExhibitor(item, eventId, eventURL))
      .filter(item => item.companyName);

    console.log("EXHIBITORS FOUND:", normalized.length);

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