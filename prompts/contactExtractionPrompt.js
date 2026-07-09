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

Company: ${companyName}
Website: ${website}
Event: ${eventName}
Source URL: ${sourceUrl}

Return JSON only with this schema:

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

Rules:
- Extract only people or emails explicitly visible in the markdown.
- If a real person is visible but no email is visible, return the person with email blank.
- If only a generic company email is visible, return it with firstName and lastName blank.
- Email must belong to the company domain.
- Ignore event organisers, media companies and unrelated third parties.
- Return maximum 5 contacts.
- If nothing relevant is visible, return contacts as an empty array.

Return raw JSON only.
Do not wrap the JSON in markdown.
Never surround the response with markdown code fences.

Markdown:
${safeMarkdown}
`;
}