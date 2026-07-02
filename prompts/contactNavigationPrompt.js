export function buildContactNavigationPrompt({ companyName, website }) {
  return `
You are researching the official website of this company:

Company: ${companyName}
Website: ${website}

Goal:
Find the best page inside this same website/domain that may contain relevant people or contact information.

Navigate only inside this company's own domain.

Look for pages such as:
- About
- About us
- Team
- People
- Leadership
- Management
- Contact
- Contact us
- Marketing
- Partnerships
- Events
- Newsroom

Do not leave this domain.
Do not use LinkedIn, event websites, sponsor pages, directories, news websites, partner websites, or social media.

Stop when you find the most useful page for extracting a business contact related to marketing, events, exhibitions, partnerships, or leadership.
`;
}