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
    sourceUrl: { type: "uri", name: "py9X9" },
    selected: { type: "boolean", name: "8XjYu" },
    contacted: { type: "boolean", name: "Jz3lG" },
    confidence: { type: "number", name: "CsRyg" },
    createdAt: { type: "date-time", name: "5Jee0" }
  }
});

app.get("/", (req, res) => {
  res.json({
    status: "online"
  });
});
app.post("/scrape-event", async (req, res) => {
  try {
    const { eventID, eventURL } = req.body;

    console.log("NEW MOCK SCRAPE REQUEST");
    console.log("Event:", eventID);
    console.log("URL:", eventURL);

    const rowId = await leadsTable.add({
      eventId: eventID,
      companyName: "Test Exhibitor",
      website: "https://example.com",
      websiteFound: true,
      email: "",
      emailFound: false,
      sourceUrl: eventURL,
      selected: false,
      contacted: false,
      confidence: 100,
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      mode: "mock",
      rowId
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});
/*app.post("/scrape-event", async (req, res) => {
  try {
    const { eventID, eventURL } = req.body;

    console.log("NEW SCRAPE REQUEST");
    console.log("Event:", eventID);
    console.log("URL:", eventURL);

    const actorResponse = await fetch(
      `https://api.apify.com/v2/acts/skython~exhibitor-list-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startUrls: [
            {
              url: eventURL
            }
          ]
        })
      }
    );

    const apifyData = await actorResponse.json();

    if (!actorResponse.ok || apifyData.error) {
      return res.status(500).json({
        error: true,
        source: "apify",
        message: apifyData?.error?.message || "Apify request failed",
        details: apifyData
      });
    }

    const exhibitors = Array.isArray(apifyData) ? apifyData : [];

    const normalized = exhibitors.map(item => ({
      eventID,
      companyName:
        item.companyName ||
        item.name ||
        item.title ||
        "",
      website:
        item.website ||
        item.url ||
        "",
      sourceURL:
        item.sourceURL ||
        item.sourceUrl ||
        eventURL,
      raw: item
    }));

    console.log("EXHIBITORS FOUND:", normalized.length);

    await leadsTable.add({
  eventId: eventID,
  companyName: "Test Exhibitor",
  website: "https://example.com",
  websiteFound: true,
  email: "",
  emailFound: false,
  sourceUrl: eventURL,
  selected: false,
  contacted: false,
  confidence: 100,
  createdAt: new Date()
});

    return res.status(200).json({
      success: true,
      eventID,
      exhibitorsFound: normalized.length,
      preview: normalized.slice(0, 5)
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
});*/

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});