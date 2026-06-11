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

/*app.post("/scrape-event", async (req, res) => {

  try {

    const { eventId, eventURL } = req.body;

    console.log("=================================");
    console.log("NEW SCRAPE REQUEST");
    console.log("Event ID:", eventId);
    console.log("Site:", eventURL);
    console.log("=================================");

    return res.status(200).json({
      success: true,
      eventId,
      eventURL
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: true,
      message: error.message
    });

  }

});*/

app.post("/scrape-event", async (req, res) => {

  try {

    const { eventId, eventURL } = req.body;

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
          startUrls: [
            {
              url: eventURL
            }
          ]
        })
      }
    );

    const exhibitors = await actorResponse.json();



console.log(
  "APIFY RESPONSE:"
);

console.log(
  JSON.stringify(exhibitors, null, 2)
);

return res.status(200).json({
  success: true
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