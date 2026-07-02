import fs from "fs";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

const response = await fetch("https://api.firecrawl.dev/v2/crawl", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://cityfibre.com",
    limit: 20,
    scrapeOptions: {
      formats: ["markdown"]
    }
  })
});

const job = await response.json();

console.log("JOB:");
console.log(job);

const jobId = job.id;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let result;

while (true) {

  await sleep(3000);

  const poll = await fetch(
    `https://api.firecrawl.dev/v2/crawl/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`
      }
    }
  );

  result = await poll.json();

  console.log(result.status);

  if (result.status === "completed") {
    break;
  }

  if (result.status === "failed") {
    console.log(result);
    process.exit();
  }
}

const pages = result.data || [];

console.log(`Pages: ${pages.length}`);

const markdown = pages
  .map(page => page.markdown || "")
  .join("\n\n-----------------------------------\n\n");

fs.writeFileSync("company.md", markdown);

console.log("company.md created");