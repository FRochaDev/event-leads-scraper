import { crawlEventWebsite } from "../services/firecrawl.js";
import { extractExhibitorsFromMarkdown } from "../services/extractor.js";
import {
  updateEventStatus,
  createLeadRows
} from "../services/glide.js";

export async function scrapeEvent(req, res) {
  console.log("HIT /scrape-event");
  console.log("BODY:", req.body);

  const body = req.body || {};

  const eventId = body.eventId;
  const eventName = body.eventName;
  const startUrl = body.start_url;

  const resultLimit = Math.min(Number(body.result_limit) || 20, 100);

  if (!eventId || !eventName || !startUrl) {
    return res.status(400).json({
      error: true,
      message: "eventId, eventName and start_url are required",
      received: body
    });
  }

  try {
    await updateEventStatus(eventId, {
      leadsScrappingStatus: "Running",
      leadsLastScrapped: new Date()
    });

    const { markdown } = await crawlEventWebsite({ startUrl });

    const exhibitors = await extractExhibitorsFromMarkdown({
      markdown,
      eventId,
      eventName,
      startUrl,
      resultLimit
    });

    if (!exhibitors.length) {
      await updateEventStatus(eventId, {
        leadsScrappingStatus: "Completed - no valid exhibitors",
        leadsLeadsFound: 0,
        leadsLastScrapped: new Date(),
        leadsResponseBodyStatus: "200",
        leadsResponseBody: "No valid exhibitors found"
      });

      return res.status(200).json({
        success: false,
        eventId,
        eventName,
        exhibitorsFound: 0,
        leadsCreated: 0,
        contactsProcessed: 0,
        source: "firecrawl+extractor",
        message: "No valid exhibitors found."
      });
    }

    const createdLeads = await createLeadRows(exhibitors);

    await updateEventStatus(eventId, {
      leadsScrappingStatus: "Completed",
      leadsLeadsFound: createdLeads.length,
      leadsLastScrapped: new Date(),
      leadsResponseBodyStatus: "200",
      leadsResponseBody: JSON.stringify({
        exhibitorsFound: exhibitors.length,
        source: "firecrawl+extractor",
        leadsCreated: createdLeads.length,
        contactsProcessed: 0
      })
    });

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      exhibitorsFound: exhibitors.length,
      source: "firecrawl+extractor",
      leadsCreated: createdLeads.length,
      contactsProcessed: 0,
      enrichResults: []
    });

  } catch (error) {
    console.error("SCRAPE EVENT ERROR:", error);

    try {
      await updateEventStatus(eventId, {
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
}