import express from "express";
import cors from "cors";

import { scrapeEvent } from "./routes/scrapeEvent.js";
import { addDefaultTasks } from "./addDefaultTasks.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ status: "online" });
});

app.post("/scrape-event", scrapeEvent);

app.post("/add-default-tasks", addDefaultTasks);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});