export function buildContactPrompt({ companyName, website, eventName }) {
  return `
You are extracting B2B prospecting contacts.

Company:
${companyName}

Company Website:
${website || "Unknown"}

Event:
${eventName}

Goal:
Extract up to 5 relevant business contacts for trade shows, exhibitions, events, partnerships, sales and marketing.

Do NOT choose the best contact.
Simply extract every suitable candidate you can confidently identify.

Preferred roles:

1. Event Manager
2. Exhibition Manager
3. Trade Show Manager
4. Events Coordinator
5. Marketing Manager
6. Field Marketing Manager
7. Marketing Coordinator
8. Partnerships Manager
9. Business Development Manager
10. Sales Manager
11. Regional Sales Manager
12. Brand Manager
13. Founder

Avoid executive contacts whenever possible:

- CEO
- CMO
- CFO
- CTO
- COO
- VP
- Vice President
- President
- Managing Director
- Board Member

For EACH contact return:

- firstName
- lastName
- email
- role
- sourceUrl
- confidence

Rules:

- Prefer information published on the company's own website.
- If necessary, use another trustworthy public source.
- Never invent names.
- Never invent email addresses.
- Email must belong to the company domain.
- Ignore LinkedIn profile URLs.
- Ignore event organisers.
- Ignore media websites.
- Ignore placeholder contacts (John Doe, Jane Doe, Unknown, Admin, Test User).
- Return a maximum of 5 contacts.

Also return:

- company
- country

Return JSON only.
`;
}