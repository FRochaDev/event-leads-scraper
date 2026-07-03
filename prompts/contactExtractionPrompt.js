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

First, identify the best relevant person.
Only after that, extract emails.

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

Email fields:

personEmail:
- Individual business email of the identified person.
- Example: john.smith@company.com
- Must belong to the company domain.
- Never invent or infer.
- Do not place individual emails in companyEmail.

companyEmail:
- Generic/shared company email.
- Only use as fallback if no personEmail is visible.
- Do not stop searching just because a generic email exists.
- If a relevant person is visible but no personal email is visible, still return the person's name and role, and put the generic email in companyEmail.
- Prefer: marketing@, events@, partnerships@, business@, sales@, info@, contact@
- Must belong to the company domain.

Country:
- Return the company's country if confidently determined.
- Leave country blank if uncertain.

Rules:
- Prefer information from the company's own website.
- If needed, use another trustworthy public source.
- Do not use emails from event organisers, media companies or third parties.
- If no suitable person is found, leave contactFirstName, contactLastName, contactRole and personEmail blank.
- If no email is found, leave both email fields blank.
- Return JSON only.

Schema:
{
  "company": "",
  "contactFirstName": "",
  "contactLastName": "",
  "personEmail": "",
  "companyEmail": "",
  "contactRole": "",
  "country": "",
  "sourceUrl": "",
  "confidence": 0,
  "canceled": false
}
`;
}