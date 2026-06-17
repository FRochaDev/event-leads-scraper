Created: 2026-06-17
Author: Flávio Rocha

Purpose:
Document the complete Event Leads Scraping and Enrichment pipeline
implemented in Railway + Glide.

PROJECT: Event Leads Scraper + Contact Enrichment

GOAL

Build a Railway API that automates the prospecting workflow for international trade fairs and exhibitions.

The workflow must:

1. Receive an Event from Glide
2. Scrape Exhibitors using Apify
3. Store Exhibitors as Leads in Glide
4. Enrich Leads with real human contacts using Anthropic Claude
5. Store contact details back in Glide
6. Track status and results on the Event record

--------------------------------------------------
GLIDE APPS
--------------------------------------------------

EVENTS APP
App ID:
4emgJAe0tdBbNwo2rEeq

Tables:

Events
- Stores event information
- Stores scraping status
- Stores API responses

Prospecting Leads
- Stores exhibitors
- Stores enriched contacts

--------------------------------------------------
ENDPOINT
--------------------------------------------------

POST /scrape-event

BODY

{
  "eventId": "...",
  "eventName": "...",
  "start_url": "...",
  "result_limit": 20,
  "enrich_limit": 5
}

--------------------------------------------------
STEP 1
SCRAPE EXHIBITORS
--------------------------------------------------

Use Apify Actor:

skython/exhibitor-list-scraper

Input:

{
  "start_url": "...",
  "result_limit": ...
}

Extract:

- companyName
- website
- email
- sourceUrl
- country

Normalize all results.

Ignore invalid entries such as:

- "Given URL is not supported"
- empty company names
- informational messages

--------------------------------------------------
STEP 2
CREATE LEADS
--------------------------------------------------

For each exhibitor create a row in:

Prospecting Leads

Store:

eventId
companyName
website
email
country
sourceUrl

Set:

selected = true
contacted = false

--------------------------------------------------
STEP 3
ENRICH CONTACTS
--------------------------------------------------

Only enrich first N leads.

N is controlled by:

enrich_limit

Example:

const leadsToEnrich =
createdLeads.slice(0, enrichLimit);

--------------------------------------------------
STEP 4
FIND CONTACTS
--------------------------------------------------

Use Anthropic Claude Sonnet.

Provide:

Company Name
Website
Event Name

Prompt objective:

Find the BEST contact for:

- Events
- Exhibitions
- Trade Shows
- Marketing
- Partnerships
- Business Development

Priority:

1 Event Manager
2 Exhibition Manager
3 Trade Show Manager
4 Marketing Manager
5 Brand Manager
6 Partnerships Manager
7 Business Development Manager
8 Marketing Director
9 CEO / Founder

Only return:

{
  "company":"",
  "contact_first_name":"",
  "contact_last_name":"",
  "contact_email":"",
  "contact_role":"",
  "source_url":"",
  "confidence":0,
  "canceled":"No"
}

No markdown.
No explanations.
JSON only.

--------------------------------------------------
STEP 5
SAVE CONTACTS
--------------------------------------------------

Update Lead:

contactFirstName
contactLastName
contactRole
contactSourceUrl
emailContact
confidence

IMPORTANT

Do NOT overwrite:

email

The original scraper email must remain untouched.

Store enriched contact emails in:

emailContact

--------------------------------------------------
STEP 6
RATE LIMIT PROTECTION
--------------------------------------------------

If Claude returns:

rate_limit_error

Stop enrichment loop.

Do not fail scraping.

Mark event as completed with partial enrichment.

--------------------------------------------------
STEP 7
UPDATE EVENT
--------------------------------------------------

Status values:

Running
Completed
Failed

Update:

leadsScrappingStatus
leadsLeadsFound
leadsLastScrapped
leadsResponseBodyStatus
leadsResponseBody

Store summary:

{
  exhibitorsFound,
  leadsCreated,
  contactsProcessed
}

--------------------------------------------------
EXPECTED RESULT
--------------------------------------------------

User clicks ONE button in Glide.

Railway:

Event
↓
Apify
↓
Exhibitors
↓
Leads
↓
Claude
↓
Contacts
↓
Update Event

Everything managed through Railway + Glide.