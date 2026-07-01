export function normalizeFirecrawlExhibitor(item, eventId, startUrl) {
  return {
    eventId,

    companyName:
      item.companyName ||
      item.company_name ||
      item.name ||
      item.exhibitorName ||
      item.sponsorName ||
      "",

    website:
      item.website ||
      item.url ||
      item.companyWebsite ||
      "",

    email:
      item.email ||
      item.contactEmail ||
      "",

    sourceUrl:
      item.sourceUrl ||
      item.source_url ||
      item.profileUrl ||
      item.profile_url ||
      startUrl,

    country:
      item.country ||
      ""
  };
}