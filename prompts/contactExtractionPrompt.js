export function buildContactPrompt({ companyName, website, eventName }) {
  return `
You are extracting contact information for B2B prospecting.

Company:
${companyName}

Company Website:
${website || "Unknown"}

Event:
${eventName}

Goal:
Find the best professional contact for exhibition stand design, trade shows, events, marketing, partnerships or business development.

Return TWO different email fields:

1. personEmail
- Individual business email of the person.
- Example: john.smith@company.com
- Only return if explicitly visible in a trustworthy public source.
- Never invent.
- Never infer.
- If an email belongs to the identified person, it MUST be returned in personEmail.
- Do not place individual emails in companyEmail.

2. companyEmail
- Best generic company email if no personEmail is available.
- Only use companyEmail for generic/shared inboxes.
- Do not return an individual person's email in companyEmail.
- Leave companyEmail blank if personEmail is available.
- Prefer:
  marketing@
  events@
  partnerships@
  business@
  sales@
  info@
  contact@
- Must belong to the company domain.

Preferred person roles:
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
11. CEO or Founder only if no better contact exists.

Rules:
- Prefer information published on the company's own website.
- If the company's website does not provide a suitable email, you may use another trustworthy public source.
- The email must belong to the company's own domain.
- Never invent or infer an email address.
- Do not use emails belonging to event organisers, media companies or third parties.
If no suitable person is found, leave contactFirstName, contactLastName, contactRole and personEmail blank.
- If no email is found, leave email fields blank.
- Return JSON only.

Schema:
{
  "company": "",
  "contactFirstName": "",
  "contactLastName": "",
  "personEmail": "",
  "companyEmail": "",
  "contactRole": "",
  "sourceUrl": "",
  "confidence": 0,
  "canceled": false
}
`;
}