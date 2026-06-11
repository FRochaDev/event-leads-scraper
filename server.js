import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    status: "online"
  });
});

app.post("/scrape-event", async (req, res) => {

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

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});