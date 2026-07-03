import { extractExhibitorsFromEvent } from "../services/firecrawl.js";
import {
  updateEventStatus,
  createLeadRows,
  updateLeadContact
} from "../services/glide.js";
import { enrichLeadContacts } from "../services/contactEnrichment.js";

export async function scrapeEvent(req, res) {
  console.log("HIT /scrape-event");
  console.log("BODY:", req.body);

  const body = req.body || {};

  const eventId = body.eventId;
  const eventName = body.eventName;
  const startUrl = body.start_url;

  const resultLimit = Math.min(Number(body.result_limit) || 20, 100);
  const enrichLimit = Math.min(Number(body.enrich_limit) || 0, 50);

  if (!eventId || !eventName || !startUrl) {
    return res.status(400).json({
      error: true,
      message: "eventId, eventName and start_url are required",
      received: body
    });
  }

  try {
    await updateEventStatus(eventId, {
      leadsScrappingStatus: "Scraping exhibitors...",
      leadsLastScrapped: new Date()
    });

    const extraction = await extractExhibitorsFromEvent({
      eventId,
      eventName,
      startUrl,
      resultLimit
    });

    const exhibitors = extraction.exhibitors || [];
    const eventScrapeCreditsUsed = extraction.creditsUsed || 0;

    if (!exhibitors.length) {
      await updateEventStatus(eventId, {
        leadsScrappingStatus: "Completed - no valid exhibitors",
        leadsLeadsFound: 0,
        leadsLastScrapped: new Date(),
        leadsResponseBodyStatus: "200",
        leadsResponseBody: JSON.stringify({
          exhibitorsFound: 0,
          source: "firecrawl",
          leadsCreated: 0,
          contactsProcessed: 0,
          creditsUsed: 0,
          creditsPerProcessedContact: 0
        })
      });

      return res.status(200).json({
        success: false,
        eventId,
        eventName,
        exhibitorsFound: 0,
        leadsCreated: 0,
        contactsProcessed: 0,
        creditsUsed: 0,
        creditsPerProcessedContact: 0,
        source: "firecrawl",
        message: "No valid exhibitors found."
      });
    }

    await updateEventStatus(eventId, {
      leadsScrappingStatus: `Creating leads (${exhibitors.length})...`
    });

    const createdLeads = await createLeadRows(exhibitors);

    let enrichResults = [];
    let enrichmentCreditsUsed = 0;

    if (enrichLimit > 0) {
      const enrichment = await enrichLeadContacts({
        leads: createdLeads,
        eventName,
        enrichLimit,
        onProgress: async (current, total, companyName) => {
          await updateEventStatus(eventId, {
            leadsScrappingStatus: `Enriching contacts ${current}/${total} - ${companyName}`
          });
        }
      });

      enrichResults = enrichment.results || [];
      enrichmentCreditsUsed = enrichment.totalCredits || 0;

      for (const result of enrichResults) {
        if (
          result.success &&
          result.contact &&
          !result.contact.canceled &&
          (result.contact.personEmail || result.contact.companyEmail)
        ) {
          await updateLeadContact(result.rowId, result.contact);
        }
      }
    }

    const creditsPerProcessedContact =
      enrichResults.length > 0
        ? Number((enrichmentCreditsUsed / enrichResults.length).toFixed(2))
        : 0;

    const totalCreditsUsed =
      eventScrapeCreditsUsed + enrichmentCreditsUsed;

    const summary = {
      exhibitorsFound: exhibitors.length,
      source: "firecrawl",
      leadsCreated: createdLeads.length,
      contactsProcessed: enrichResults.length,
      eventScrapeCreditsUsed,
      enrichmentCreditsUsed,
      totalCreditsUsed,
      creditsPerProcessedContact
    };

    await updateEventStatus(eventId, {
      leadsScrappingStatus: "Completed",
      leadsLeadsFound: createdLeads.length,
      leadsLastScrapped: new Date(),
      leadsResponseBodyStatus: "200",
      leadsResponseBody: JSON.stringify(summary)
    });

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      exhibitorsFound: exhibitors.length,
      source: "firecrawl",
      leadsCreated: createdLeads.length,
      contactsProcessed: enrichResults.length,
      eventScrapeCreditsUsed,
      enrichmentCreditsUsed,
      totalCreditsUsed,
      creditsPerProcessedContact,
      enrichResults
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
    } catch { }

    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
}