export function buildContactPrompt({ companyName, website, eventName }) {
  return `
Find the SINGLE BEST person contact for this company.

Company: ${companyName}
Website: ${website || ""}
Event: ${eventName}

Context:
The user sells exhibition stand design and trade show services.

Priority order:
1. Event Manager
2. Exhibition Manager
3. Trade Show Manager
4. Marketing Manager
5. Brand Manager
6. Partnerships Manager
7. Business Development Manager
8. Marketing Director
9. CEO or Founder only if no better contact exists

Rules:
- Prefer people from the company itself.
- Prefer people involved in events, exhibitions, trade shows, marketing, partnerships, or brand.
- Do not return generic support, careers, privacy, HR, sales-only, or technical contacts.
- If no individual person is found, return canceled true.
- Do not invent emails.
- Only include an email if it appears in the source content.
- Return one contact only.
`;
}