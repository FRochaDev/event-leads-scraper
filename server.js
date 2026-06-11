import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

app.get("/", (req, res) => {
  res.json({
    status: "online"
  });
});

app.post("/scrape-event", async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});