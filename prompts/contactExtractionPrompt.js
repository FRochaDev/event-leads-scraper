export function buildClaudeContactPrompt({
  companyName,
  website,
  eventName,
  sourceUrl,
  markdown
}) {
  const safeMarkdown = (markdown || "").slice(0, 25000);

  return `
You extract B2B prospecting contacts from webpage markdown.

Use ONLY the markdown provided.
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

Step 1:
Read the markdown and identify every person, role and company email explicitly mentioned.

Step 2:
From those explicit mentions only, select the people who would be the best contacts for someone selling exhibition stands, trade show services, event services or B2B partnerships.

Step 3:
Return ONLY the final selected contacts as JSON.

Do not include your reasoning.
Do not include the intermediate list.

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
- Press Officer
- PR Manager
- Communications Manager
Media Relations
- Public Relations
- Journalist
- Editor
- Content Manager

Rules:

- Extract only people, roles and emails explicitly visible in the markdown.
- Return only people who currently work for the company.
- If a suitable non-executive contact exists, never return executives.
- If only executives are visible, return an empty contacts array.
- If a real person is visible but no email is visible, return the person with email blank.
- If only generic company emails are visible, return them with blank names.
- Email must belong to the company's own domain.
- Ignore event organisers, media companies and unrelated third parties.
- Return a maximum of 5 contacts.
- If nothing relevant is found, return an empty contacts array.

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