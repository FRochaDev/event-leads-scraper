export function extractEmails(markdown, companyDomain = "") {
  if (!markdown) return [];

  const regex =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

  const emails = [...new Set(markdown.match(regex) || [])]
    .map(email => email.toLowerCase().trim());

  return emails.filter(email => {
    if (
      email.startsWith("noreply") ||
      email.startsWith("no-reply") ||
      email.startsWith("donotreply") ||
      email.startsWith("do-not-reply")
    ) {
      return false;
    }

    if (
      email.includes("example.com") ||
      email.includes("yourdomain")
    ) {
      return false;
    }

    if (companyDomain) {
      return email.endsWith(companyDomain);
    }

    return true;
  });
}

export function rankEmails(emails) {
  if (!Array.isArray(emails) || !emails.length) {
    return "";
  }

  const priority = [
    "events",
    "event",
    "marketing",
    "partnerships",
    "partners",
    "business",
    "commercial",
    "sales",
    "hello",
    "contact",
    "info",
    "office"
  ];

  const badPrefixes = [
    "privacy",
    "gdpr",
    "legal",
    "support",
    "press",
    "media",
    "careers",
    "jobs",
    "hr",
    "admin",
    "webmaster",
    "abuse",
    "security"
  ];

  return [...emails].sort((a, b) => {
    return scoreEmail(b, priority, badPrefixes) -
      scoreEmail(a, priority, badPrefixes);
  })[0];
}

function scoreEmail(email, priority, badPrefixes) {
  const local = email.split("@")[0];

  let score = 0;

  if (/^[a-z]+[._-][a-z]+$/.test(local)) {
  score += 120;
}

  if (local.includes(".")) score += 50;

  const exactPriorityIndex = priority.indexOf(local);
  if (exactPriorityIndex !== -1) {
    score += 100 - exactPriorityIndex * 5;
  }

  for (const token of priority) {
    if (local.includes(token)) {
      score += 40;
    }
  }

  for (const bad of badPrefixes) {
    if (local.includes(bad)) {
      score -= 100;
    }
  }

  if (local.length <= 2) score -= 50;

  return score;
}