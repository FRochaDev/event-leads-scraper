import { table } from "@glideapps/tables";

const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const APP_ID = "4emgJAe0tdBbNwo2rEeq";

if (!GLIDE_TOKEN) {
  console.warn("Missing GLIDE_TOKEN environment variable");
}

const leadsTable = table({
  token: GLIDE_TOKEN,
  app: APP_ID,
  table: "native-table-2q2iGRqESIW68SLykDwf",
columns: {
        eventId: { type: "string", name: "wqqEw" },
        prospectName: { type: "string", name: "Zd1GL" },
        website: { type: "uri", name: "oSm1A" },
        websiteFound: { type: "boolean", name: "ltsRJ" },
        prospectEmail: { type: "email-address", name: "Xz7P9" },
        contactInProspect: { type: "email-address", name: "mzBFs" },
        emailFound: { type: "boolean", name: "GxyYQ" },
        contactFirstName: { type: "string", name: "gZOTI" },
        contactLastName: { type: "string", name: "bozIA" },
        contactRole: { type: "string", name: "YNPib" },
        contactPage: { type: "uri", name: "Trypw" },
        sourceUrl: { type: "uri", name: "py9X9" },
        contactSourceUrl: { type: "uri", name: "vpvOh" },
        country: { type: "string", name: "h1fz0" },
        selected: { type: "boolean", name: "8XjYu" },
        contacted: { type: "boolean", name: "Jz3lG" },
        notes: { type: "string", name: "0LE4i" },
        confidence: { type: "number", name: "CsRyg" },
        createdAt: { type: "date-time", name: "5Jee0" }
  }
});

const eventsTable = table({
  token: GLIDE_TOKEN,
  app: APP_ID,
  table: "native-table-t2HyWYJua4PKB9CHCRBZ",
  columns: {
    evento: { type: "string", name: "7A8nT" },
    site: { type: "uri", name: "FCRaw" },

    leadsScrappingStatus: { type: "string", name: "Xfaf7" },
    leadsLeadsFound: { type: "number", name: "H5xem" },
    leadsLastScrapped: { type: "date-time", name: "Cesvc" },
    leadsResponseBody: { type: "string", name: "Z05gt" },
    leadsResponseBodyStatus: { type: "string", name: "Ha9z9" }
  }
});

export async function updateEventStatus(eventId, values) {
  return eventsTable.update(eventId, values);
}

export async function createLeadRows(exhibitors) {
  const createdLeads = [];

  for (const exhibitor of exhibitors) {
    const rowId = await leadsTable.add({
      eventId: exhibitor.eventId,
      companyName: exhibitor.companyName,
      website: exhibitor.website,
      websiteFound: !!exhibitor.website,

      email: exhibitor.email,
      emailFound: !!exhibitor.email,

      emailContact: "",
      contactFirstName: "",
      contactLastName: "",
      contactRole: "",
      contactSourceUrl: "",

      contactPage: "",
      sourceUrl: exhibitor.sourceUrl,
      country: exhibitor.country,
      selected: true,
      contacted: false,
      notes: "",
      confidence: exhibitor.email ? 90 : 50,
      createdAt: new Date()
    });

    createdLeads.push({
      rowId,
      ...exhibitor
    });
  }

  console.log("LEADS CREATED:", createdLeads.length);

  return createdLeads;
}

export async function updateLeadContact(rowId, contact) {
  return leadsTable.update(rowId, {
    email: contact.companyEmail || "",
    emailFound: !!contact.companyEmail,

    emailContact: contact.personEmail || "",

    contactFirstName: contact.contactFirstName || "",
    contactLastName: contact.contactLastName || "",
    contactRole: contact.contactRole || "",
    contactSourceUrl: contact.sourceUrl || "",
    confidence: contact.confidence || 0
  });
}