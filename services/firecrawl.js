import { sleep } from "../utils/sleep.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function crawlEventWebsite({ startUrl }) {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY environment variable");
  }

  const crawlResponse = await fetch("https://api.firecrawl.dev/v2/crawl", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: startUrl,
      limit: 5,
      allowExternalLinks: false,
      scrapeOptions: {
        formats: ["markdown", "links"],
        onlyMainContent: false,
        timeout: 300000,
        waitFor: 10000
      }
    })
  });

  const crawlData = await crawlResponse.json();

  console.log("FIRECRAWL CRAWL STATUS:", crawlResponse.status);
  console.log("FIRECRAWL CRAWL DATA:", JSON.stringify(crawlData).slice(0, 2000));

  if (!crawlResponse.ok || crawlData.error) {
    throw new Error(JSON.stringify(crawlData));
  }

  const statusUrl = crawlData.url;

  for (let attempt = 1; attempt <= 20; attempt++) {
    await sleep(3000);

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`
      }
    });

    const statusData = await statusResponse.json();

    console.log("FIRECRAWL POLL STATUS:", statusResponse.status);
    console.log("FIRECRAWL POLL DATA:", JSON.stringify(statusData).slice(0, 2000));

    if (!statusResponse.ok || statusData.error) {
      throw new Error(JSON.stringify(statusData));
    }

    if (statusData.status === "completed") {
      const pages = statusData.data || [];

      const markdown = pages
        .map(page => page.markdown || "")
        .join("\n\n");

      console.log("FIRECRAWL COMPLETED PAGES:", pages.length);
      console.log("FIRECRAWL MARKDOWN LENGTH:", markdown.length);
      console.log("FIRECRAWL SAMPLE:", markdown.substring(0, 5000));

      return {
        pages,
        markdown
      };
    }
  }

  throw new Error("Firecrawl crawl polling timed out");
}