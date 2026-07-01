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
    companyName: { type: "string", name: "Zd1GL" },
    website: { type: "uri", name: "oSm1A" },
    websiteFound: { type: "boolean", name: "ltsRJ" },

    email: { type: "email-address", name: "Xz7P9" },
    emailFound: { type: "boolean", name: "GxyYQ" },

    emailContact: { type: "email-address", name: "mzBFs" },
    contactFirstName: { type: "string", name: "gZOTI" },
    contactLastName: { type: "string", name: "bozIA" },
    contactRole: { type: "string", name: "YNPib" },
    contactSourceUrl: { type: "uri", name: "vpvOh" },

    contactPage: { type: "uri", name: "Trypw" },
    sourceUrl: { type: "uri", name: "py9X9" },
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