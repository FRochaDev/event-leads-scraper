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
2. From those explicit mentions only, select the best contacts for someone selling exhibition stands, trade show services, event services or B2B partnerships.
3. Return ONLY the final selected contacts as JSON.

Preferred roles:
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

Avoid these roles:
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
- If a real person is visible but no email is visible, return the person with email blank.
- If only generic company emails are visible, return them with blank names.
- Email must belong to the company's own domain.
- Ignore event organisers, media companies and unrelated third parties.
- Return a maximum of 5 contacts.
- If nothing relevant is found, return an empty contacts array.

Emails extracted by regex from the markdown:
${extractedEmails}

Email selection rules:
- Use the email list above as the trusted list of emails found in the markdown.
- Prefer a personal company email if it can be matched to a relevant person in the markdown.
- Prefer emails linked to events, marketing, sales, partnerships, commercial or business development roles.
- If no personal email can be matched to a relevant person, choose the best department email.
- Prefer department emails such as events@, marketing@, partnerships@, commercial@, business@ or sales@.
- Use info@ or contact@ only as fallback.
- Never invent an email.
- Never return an email that is not in the extracted email list.

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