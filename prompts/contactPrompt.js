export function buildContactPrompt({ companyName, website, eventName }) {
  return `
You are researching potential B2B clients for exhibition stand design and trade show services.

Company:
${companyName}

Company Website:
${website || "Unknown"}

Event:
${eventName}

Your task is to identify the SINGLE BEST person responsible for deciding whether this company participates in exhibitions, trade shows, conferences or industry events.

VERY IMPORTANT

You MUST ONLY use information that belongs to the company's own website.

DO NOT use information from:
- event organisers
- conference websites
- sponsor pages
- news websites
- press releases
- LinkedIn summaries
- partner websites
- directories

The contact must work for the company itself.

Preferred roles (highest priority first):

1. Event Manager
2. Exhibition Manager
3. Trade Show Manager
4. Marketing Manager
5. Brand Manager
6. Partnerships Manager
7. Business Development Manager
8. Head of Marketing
9. Marketing Director
10. CMO
11. CEO or Founder ONLY if nobody else exists.

Email rules:

- The email domain MUST match the company's own website.
- Never invent an email.
- Never infer an email pattern.
- If the email is not explicitly visible, leave it blank.
- Reject emails belonging to another company.

Example:

Website:
https://cityfibre.com

Valid:
john@cityfibre.com

Invalid:
john@gmail.com
john@linkedin.com
john@terrapinn.com
john@totaltele.com

Return ONLY one JSON object using exactly this schema:

{
  "company": "",
  "contactFirstName": "",
  "contactLastName": "",
  "contactEmail": "",
  "contactRole": "",
  "sourceUrl": "",
  "confidence": 0,
  "canceled": false
}

If no suitable contact is found on the company's own website, return:

{
  "company": "${companyName}",
  "contactFirstName": "",
  "contactLastName": "",
  "contactEmail": "",
  "contactRole": "",
  "sourceUrl": "",
  "confidence": 0,
  "canceled": true
}

Return JSON only.
`;
}