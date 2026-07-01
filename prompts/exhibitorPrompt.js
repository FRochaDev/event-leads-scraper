export function buildExhibitorPrompt({ eventName, startUrl, resultLimit }) {
  return `
Extract exhibitors, sponsors, partners, startups, brands, or participating companies from this event website.

Event: ${eventName}
Source URL: ${startUrl}

Rules:
- Return only real company names.
- Ignore menu items, speakers, agenda sessions, ticket links, venue information, generic calls to action, and navigation text.
- Prefer companies listed under sections like Sponsors, Exhibitors, Partners, Aussteller, Sponsoren, Start-Up Zone, Marketplace, or Brand list.
- Include website if visible.
- Include email if visible.
- Include country if visible.
- Include sourceUrl if a company profile URL is visible.
- Return maximum ${resultLimit} companies.
- Do not invent companies.
- Do not include the event organizer unless it is explicitly listed as an exhibitor, sponsor, or partner.
`;
}