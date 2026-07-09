export function buildClaudeContactPrompt({
  companyName,
  website,
  eventName,
  sourceUrl,
  markdown,
  extractedEmails = "None"
}) {
  const safeMarkdown = (markdown || "").slice(0, 25000);

  return `
You extract B2B prospecting contacts from webpage markdown.

Use ONLY the markdown provided.
Use ONLY the extracted email list provided.
Do not use outside knowledge.
Do not invent names, roles, emails or URLs.

Company:
${companyName}

Website:
${website}

Event:
${eventName}

Source URL:
${sourceUrl}

Task:

1. Read the markdown and identify every person, role and company email explicitly mentioned.

2. Match the extracted emails to the people mentioned whenever possible.

3. Select the SINGLE BEST contact for someone selling exhibition stands, trade show services, event services or B2B partnerships.

Return ONLY that single contact.

Preferred roles (highest priority):

- Event Manager
- Exhibition Manager
- Trade Show Manager
- Events Coordinator
- Marketing Manager
- Marketing Director
- Field Marketing Manager
- Marketing Coordinator
- Brand Manager
- Partnerships Manager
- Commercial Partnerships
- Business Development Manager
- Sales Manager
- Regional Sales Manager
- Commercial Manager
- Operations Manager

Avoid these roles whenever possible:

- CEO
- CFO
- CTO
- COO
- CMO
- CIO
- CCO
- President
- Vice President
- Managing Director
- Executive Director
- Board Member
- Chairman
- Founder
- Co-Founder
- Press Officer
- PR Manager
- Communications Manager
- Media Relations
- Public Relations
- Journalist
- Editor
- Content Manager

Rules:

- Extract only people, roles and emails explicitly visible in the markdown.
- Return only people who currently work for the company.
- If a suitable non-executive contact exists, never return executives.
- If only executives are visible, return an empty contacts array.
- Match people only with emails present in the extracted email list.
- Never invent an email.
- Never infer an email pattern.
- Never return an email that is not in the extracted email list.
- If a real person is visible but no matching email exists, return the person with email blank.
- If no suitable person can be matched but a department email exists, return the best department email with blank firstName and lastName.
- Prefer department emails such as:
  - events@
  - marketing@
  - partnerships@
  - commercial@
  - business@
  - sales@
- Use info@ or contact@ only as a last resort.
- Email must belong to the company's own domain.
- Ignore event organisers, media companies and unrelated third parties.
- Return exactly ONE contact.
- If nothing relevant is found, return an empty contacts array.

Emails extracted by regex:

${extractedEmails}

Return raw JSON only.
Do not wrap the response in markdown.
Do not use markdown code fences.

Schema:

{
  "company": "",
  "country": "",
  "contacts": [
    {
      "firstName": "",
      "lastName": "",
      "email": "",
      "role": "",
      "sourceUrl": "",
      "confidence": 0
    }
  ]
}

Markdown:

${safeMarkdown}
`;
}