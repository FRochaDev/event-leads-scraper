const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function extractContactsWithClaude({
  companyName,
  website,
  eventName,
  sourceUrl,
  markdown
}) {

  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  console.log("CLAUDE EXTRACTION");
  console.log("Company:", companyName);
  console.log("Website:", website);
  console.log("Source:", sourceUrl);
  console.log("Markdown length:", markdown.length);

  return {
    contacts: []
  };
}