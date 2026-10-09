import type { Listing } from '../types'

/* The "top companies": a hand-picked list of the tech companies most people
   on this board are hoping to hear back from. Their listings get a red frame,
   and the board can be filtered down to just them.

   It lives here rather than in the database on purpose: it's an opinion, not
   something scraped, so changing it is an edit and a deploy and the scraper
   never has to know.

   A company is matched by the job boards it posts on, written `ats:slug`
   exactly as the scraper stores them (ats_source, company_slug). Workday is
   the exception: its slugs read `tenant.wdN/site` and one company can run
   several sites, so a Workday board is just the tenant. Companies that hire
   through their own careers site (Google, Apple, Meta, Microsoft, Amazon,
   Jane Street, Citadel…) are never scraped, so they have no board to list. */
const TOP_COMPANIES: Record<string, string[]> = {
  // big tech, platforms and consumer
  Adobe: ['workday:adobe'],
  Airbnb: ['greenhouse:airbnb'],
  Autodesk: ['workday:autodesk'],
  Baidu: ['greenhouse:baidu'],
  'Capital One': ['workday:capitalone'],
  Discord: ['greenhouse:discord'],
  DoorDash: ['greenhouse:doordashusa', 'greenhouse:doordashcanada'],
  Duolingo: ['greenhouse:duolingo'],
  eBay: ['workday:ebay'],
  'Epic Games': ['greenhouse:epicgames'],
  Expedia: ['workday:expedia'],
  Grab: ['smartrecruiters:grab'],
  Huawei: [
    'recruitee:huaweicanada',
    'teamtailor:huaweiresearchcentergermanyaustria',
    'teamtailor:huaweidusseldorf-1719303222',
    'teamtailor:huaweiuk',
    'teamtailor:huaweifinlandrnd',
    'teamtailor:huaweitechnologiesitalia',
    'teamtailor:huaweiireland',
    'teamtailor:huaweisweden',
  ],
  Instacart: ['greenhouse:instacart'],
  LinkedIn: ['smartrecruiters:linkedin3'],
  Lyft: ['greenhouse:lyft'],
  Mastercard: ['workday:mastercard'],
  Pinterest: ['greenhouse:pinterest'],
  Quora: ['ashby:quora'],
  Reddit: ['greenhouse:reddit'],
  Roblox: ['greenhouse:roblox'],
  Samsung: ['workday:sec', 'greenhouse:samsungresearchamericainternship'],
  Snap: ['workday:snapchat'],
  Sony: ['workday:sonyglobal', 'greenhouse:sonyinteractiveentertainmentglobal'],
  Spotify: ['lever:spotify'],
  Tencent: ['workday:tencent'],
  Twitch: ['greenhouse:twitch'],
  Visa: ['workday:visa', 'smartrecruiters:visa'],
  Zillow: ['workday:zillow'],

  // software, cloud and security
  AppLovin: ['greenhouse:applovin'],
  Airtable: ['greenhouse:airtable'],
  Asana: ['greenhouse:asana'],
  Celonis: ['greenhouse:celonis'],
  Cloudflare: ['greenhouse:cloudflare'],
  CrowdStrike: ['workday:crowdstrike'],
  Databricks: ['greenhouse:databricks'],
  Datadog: ['greenhouse:datadog'],
  Dropbox: ['greenhouse:dropbox'],
  F5: ['workday:ffive'],
  Figma: ['greenhouse:figma'],
  GitLab: ['greenhouse:gitlab'],
  Glean: ['greenhouse:gleanwork'],
  Grammarly: ['greenhouse:grammarly'],
  Linear: ['ashby:linear'],
  MongoDB: ['greenhouse:mongodb'],
  Notion: ['ashby:notion'],
  Nutanix: ['jobvite:nutanix'],
  Okta: ['greenhouse:okta'],
  Palantir: ['lever:palantir'],
  'Palo Alto Networks': ['workday:paloaltonetworks'],
  'Pure Storage': ['greenhouse:purestorage'],
  Qualtrics: ['greenhouse:qualtrics'],
  'Red Hat': ['workday:redhat'],
  Replit: ['ashby:replit'],
  Retool: ['ashby:retool'],
  Rubrik: ['greenhouse:rubrik'],
  Salesforce: ['workday:salesforce'],
  Samsara: ['greenhouse:samsara'],
  Sentry: ['ashby:sentry'],
  ServiceNow: ['smartrecruiters:servicenow'],
  Snowflake: ['ashby:snowflake'],
  Supabase: ['ashby:supabase'],
  Twilio: ['greenhouse:twilio'],
  Vanta: ['ashby:vanta'],
  Vercel: ['greenhouse:vercel'],
  Verkada: ['greenhouse:verkada'],
  Workday: ['workday:workday'],

  // fintech and crypto
  Affirm: ['greenhouse:affirm'],
  Block: ['greenhouse:block'],
  Brex: ['greenhouse:brex'],
  Chime: ['greenhouse:chime'],
  Coinbase: ['greenhouse:coinbase'],
  Kalshi: ['ashby:kalshi'],
  PayPal: ['workday:paypal'],
  Plaid: ['lever:plaid'],
  Ramp: ['ashby:ramp'],
  Robinhood: ['greenhouse:robinhood'],
  SoFi: ['greenhouse:sofi'],
  Stripe: ['greenhouse:stripe'],

  // people, ops and logistics
  Deel: ['ashby:deel'],
  Faire: ['greenhouse:faire'],
  Flexport: ['greenhouse:flexport'],
  Gusto: ['greenhouse:gusto'],
  Rippling: ['rippling:rippling'],

  // AI labs and AI-first companies
  Abridge: ['ashby:abridge'],
  Anthropic: ['greenhouse:anthropic'],
  'Character.AI': ['ashby:character'],
  Cognition: ['ashby:cognition'],
  Cohere: ['ashby:cohere'],
  CoreWeave: ['greenhouse:coreweave'],
  Cursor: ['ashby:cursor'],
  Decagon: ['ashby:decagon'],
  ElevenLabs: ['ashby:elevenlabs'],
  'Fireworks AI': ['ashby:fireworks'],
  Harvey: ['ashby:harvey'],
  'Hugging Face': ['workable:huggingface'],
  Lambda: ['ashby:lambda'],
  LangChain: ['ashby:langchain'],
  Mercor: ['ashby:mercor'],
  'Mistral AI': ['lever:mistral'],
  Modal: ['ashby:modal'],
  OpenAI: ['ashby:openai'],
  'Periodic Labs': ['ashby:periodic-labs'],
  Perplexity: ['ashby:perplexity'],
  'Scale AI': ['greenhouse:scaleai'],
  Sierra: ['ashby:sierra'],
  'Together AI': ['greenhouse:togetherai'],
  xAI: ['greenhouse:xai'],

  // robotics, autonomy and neurotech
  '1X': ['ashby:1x'],
  'Applied Intuition': ['ashby:applied'],
  Aurora: ['greenhouse:aurorainnovation'],
  Figure: ['greenhouse:figureai'],
  'Intuitive Surgical': ['smartrecruiters:intuitive'],
  Motional: ['greenhouse:motional'],
  Neuralink: ['greenhouse:neuralink'],
  Nuro: ['greenhouse:nuro'],
  'Physical Intelligence': ['ashby:physicalintelligence'],
  'Skild AI': ['greenhouse:skildai-careers'],
  Skydio: ['ashby:skydio'],
  Waymo: ['greenhouse:waymo'],
  Zipline: ['greenhouse:flyzipline'],
  Zoox: ['lever:zoox'],

  // space, defense and energy tech
  Anduril: ['greenhouse:andurilindustries'],
  Astranis: ['greenhouse:astranis'],
  'Blue Origin': ['workday:blueorigin'],
  Helion: ['ashby:helion'],
  'Rocket Lab': ['greenhouse:rocketlab'],
  Saronic: ['ashby:saronic'],
  'Shield AI': ['lever:shieldai'],
  SpaceX: ['greenhouse:spacex'],

  // chips and hardware
  AMD: ['workday:amd'],
  Altera: ['workday:altera'],
  'Analog Devices': ['workday:analogdevices'],
  'Applied Materials': ['workday:amat'],
  Arista: ['smartrecruiters:aristanetworks'],
  Arm: ['workday:arm'],
  'Astera Labs': ['greenhouse:asteralabs'],
  Broadcom: ['workday:broadcom'],
  Cadence: ['workday:cadence'],
  Cerebras: ['ashby:cerebras'],
  Dell: ['workday:dell'],
  Etched: ['ashby:etched'],
  GlobalFoundries: ['workday:globalfoundries'],
  Groq: ['greenhouse:groq'],
  HP: ['workday:hp', 'workday:hpinc', 'greenhouse:hpiq'],
  HPE: ['workday:hpe'],
  Intel: ['workday:intel'],
  KLA: ['workday:kla'],
  'Lam Research': ['workday:lamresearch'],
  Lightmatter: ['greenhouse:lightmatter'],
  Marvell: ['workday:marvell'],
  Micron: ['workday:micron'],
  NVIDIA: ['workday:nvidia'],
  NXP: ['workday:nxp'],
  Qualcomm: ['workday:qualcomm'],
  SiFive: ['workday:sifive'],
  Tenstorrent: ['greenhouse:tenstorrent', 'greenhouse:tenstorrentuniversity'],
  'Western Digital': ['smartrecruiters:westerndigital'],

  // quant trading
  'Akuna Capital': ['greenhouse:akunacapital'],
  Bridgewater: [
    'greenhouse:bridgewater89',
    'greenhouse:bridgewaterassociatescampusrecruitingreferral',
  ],
  DRW: ['greenhouse:drweng'],
  'Five Rings': ['greenhouse:fiveringsllc'],
  'Headlands Technologies': ['greenhouse:headlandstechnologiesllc'],
  'Hudson River Trading': ['greenhouse:wehrtyou'],
  IMC: ['greenhouse:imc'],
  'Jump Trading': ['greenhouse:jumptrading', 'greenhouse:jumpcrypto'],
  Optiver: ['greenhouse:optiverus', 'greenhouse:optiverprivate', 'greenhouse:icml'],
  'PDT Partners': ['greenhouse:pdtpartners'],
  Point72: ['greenhouse:point72'],
  'Qube Research & Technologies': ['greenhouse:quberesearchandtechnologies'],
  'Radix Trading': ['greenhouse:radixuniversity'],
  'Tower Research Capital': ['greenhouse:towerresearchcapital'],
  'Virtu Financial': ['greenhouse:virtu'],
  Voleon: ['ashby:voleon'],
  WorldQuant: ['greenhouse:worldquant'],
}

// ats_source → the slugs (for Workday, the tenants) that count as a top company.
export const TOP_BOARDS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const boards = new Map<string, Set<string>>()
  for (const board of Object.values(TOP_COMPANIES).flat()) {
    const [ats, slug] = board.split(':')
    if (!boards.has(ats)) boards.set(ats, new Set())
    boards.get(ats)!.add(slug)
  }
  return boards
})()

// `nvidia.wd5/nvidiaexternalcareersite` → `nvidia`
const WORKDAY_TENANT = /^(.+?)\.wd\d+\//

/* One listing against the list. The database runs the same test for the
   "top companies only" filter (TOP_COMPANY_FILTER in supabase.ts) —
   change one, change the other. */
export function isTopCompany({ ats_source, company_slug }: Listing): boolean {
  if (!ats_source || !company_slug) return false
  const slugs = TOP_BOARDS.get(ats_source)
  if (!slugs) return false
  if (ats_source !== 'workday') return slugs.has(company_slug)
  const tenant = WORKDAY_TENANT.exec(company_slug)?.[1]
  return tenant !== undefined && slugs.has(tenant)
}
