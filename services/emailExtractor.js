export function extractEmails(markdown, companyDomain = "") {
  if (!markdown) return [];

  const regex =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

  const emails = [...new Set(markdown.match(regex) || [])]
    .map(e => e.toLowerCase());

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