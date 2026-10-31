import { CanonicalStory, NewsSource, HourlyPulseBriefing, PerspectiveAnalysis, VocabularyEntry } from '../types/index.js';

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const INITIAL_NEWS_SOURCES: NewsSource[] = [
  {
    id: 'src-pib-india',
    slug: 'pib-india',
    name: 'Press Information Bureau (PIB)',
    url: 'https://pib.gov.in',
    rssUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1',
    geographicScope: 'national',
    country: 'IN',
    category: 'governance',
    isEnabled: true,
    isOfficial: true,
    trustTier: 'official_govt',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-the-hindu',
    slug: 'the-hindu',
    name: 'The Hindu',
    url: 'https://www.thehindu.com',
    rssUrl: 'https://www.thehindu.com/news/national/feeder/default.rss',
    geographicScope: 'national',
    country: 'IN',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-indian-express',
    slug: 'indian-express',
    name: 'The Indian Express',
    url: 'https://indianexpress.com',
    rssUrl: 'https://indianexpress.com/section/india/feed/',
    geographicScope: 'national',
    country: 'IN',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-bbc-world',
    slug: 'bbc-world',
    name: 'BBC News — World',
    url: 'https://www.bbc.com/news/world',
    rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    geographicScope: 'international',
    country: 'GB',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-reuters',
    slug: 'reuters',
    name: 'Reuters World Wire',
    url: 'https://www.reuters.com',
    geographicScope: 'international',
    country: 'US',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'wire_agency',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-telangana-today',
    slug: 'telangana-today',
    name: 'Telangana State Information Bureau',
    url: 'https://telangana.gov.in',
    geographicScope: 'state',
    country: 'IN',
    state: 'Telangana',
    category: 'governance',
    isEnabled: true,
    isOfficial: true,
    trustTier: 'official_govt',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-hindu-telangana',
    slug: 'hindu-telangana',
    name: 'The Hindu (Telangana & Hyderabad)',
    url: 'https://www.thehindu.com/news/national/telangana/',
    rssUrl: 'https://www.thehindu.com/news/national/telangana/feeder/default.rss',
    geographicScope: 'state',
    country: 'IN',
    state: 'Telangana',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-hindu-karnataka',
    slug: 'hindu-karnataka',
    name: 'The Hindu (Karnataka)',
    url: 'https://www.thehindu.com/news/national/karnataka/',
    rssUrl: 'https://www.thehindu.com/news/national/karnataka/feeder/default.rss',
    geographicScope: 'state',
    country: 'IN',
    state: 'Karnataka',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-express-delhi',
    slug: 'express-delhi',
    name: 'The Indian Express (Delhi NCR)',
    url: 'https://indianexpress.com/section/cities/delhi/',
    rssUrl: 'https://indianexpress.com/section/cities/delhi/feed/',
    geographicScope: 'state',
    country: 'IN',
    state: 'Delhi',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-livemint',
    slug: 'livemint',
    name: 'Mint (National Economy & Policy)',
    url: 'https://www.livemint.com',
    rssUrl: 'https://www.livemint.com/rss/news',
    geographicScope: 'national',
    country: 'IN',
    category: 'economy',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-hindu-ap',
    slug: 'hindu-andhra-pradesh',
    name: 'The Hindu (Andhra Pradesh)',
    url: 'https://www.thehindu.com/news/national/andhra-pradesh/',
    rssUrl: 'https://www.thehindu.com/news/national/andhra-pradesh/feeder/default.rss',
    geographicScope: 'state',
    country: 'IN',
    state: 'Andhra Pradesh',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-express-mumbai',
    slug: 'express-mumbai-maharashtra',
    name: 'The Indian Express (Mumbai & Maharashtra)',
    url: 'https://indianexpress.com/section/cities/mumbai/',
    rssUrl: 'https://indianexpress.com/section/cities/mumbai/feed/',
    geographicScope: 'state',
    country: 'IN',
    state: 'Maharashtra',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-hindu-tn',
    slug: 'hindu-tamil-nadu',
    name: 'The Hindu (Tamil Nadu)',
    url: 'https://www.thehindu.com/news/national/tamil-nadu/',
    rssUrl: 'https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss',
    geographicScope: 'state',
    country: 'IN',
    state: 'Tamil Nadu',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-hindu-kerala',
    slug: 'hindu-kerala',
    name: 'The Hindu (Kerala)',
    url: 'https://www.thehindu.com/news/national/kerala/',
    rssUrl: 'https://www.thehindu.com/news/national/kerala/feeder/default.rss',
    geographicScope: 'state',
    country: 'IN',
    state: 'Kerala',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-express-kolkata',
    slug: 'express-kolkata-bengal',
    name: 'The Indian Express (West Bengal & Kolkata)',
    url: 'https://indianexpress.com/section/cities/kolkata/',
    rssUrl: 'https://indianexpress.com/section/cities/kolkata/feed/',
    geographicScope: 'state',
    country: 'IN',
    state: 'West Bengal',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-express-gujarat',
    slug: 'express-gujarat',
    name: 'The Indian Express (Gujarat & Ahmedabad)',
    url: 'https://indianexpress.com/section/cities/ahmedabad/',
    rssUrl: 'https://indianexpress.com/section/cities/ahmedabad/feed/',
    geographicScope: 'state',
    country: 'IN',
    state: 'Gujarat',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-mint-economy',
    slug: 'mint-national-economy',
    name: 'Mint (National Economy Analysis)',
    url: 'https://www.livemint.com/economy',
    rssUrl: 'https://www.livemint.com/rss/economy',
    geographicScope: 'national',
    country: 'IN',
    category: 'economy',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  },
  {
    id: 'src-aljazeera-world',
    slug: 'aljazeera-world',
    name: 'Al Jazeera (International News)',
    url: 'https://www.aljazeera.com',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    geographicScope: 'international',
    country: 'QA',
    category: 'general',
    isEnabled: true,
    isOfficial: false,
    trustTier: 'verified_media',
    fetchFrequencyMinutes: 30,
  }
];

export const SEED_STORIES: CanonicalStory[] = [
  {
    id: 'story-telangana-metro-expansion',
    title: 'Telangana Cabinet Sanctions Phase 2 Metro Rail Network Covering 76 Kilometers',
    summary: 'The Government of Telangana has approved the revised Detailed Project Report (DPR) for Hyderabad Metro Phase 2, spanning five corridors to connect key commercial and residential transit hubs.',
    whyItMatters: 'Reduces severe arterial traffic congestion, accelerates clean transit infrastructure across the Hyderabad metropolitan region, and expands public connectivity to airport corridors.',
    generalTake: 'Infrastructure expansion of this magnitude signals long-term civic planning, though fiscal execution and joint Union-State funding clearances remain the primary determinants of project velocity.',
    geographicScope: 'state',
    country: 'IN',
    state: 'Telangana',
    category: 'infrastructure',
    leadImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'official_documentation',
    importanceLevel: 'high',
    firstReportedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-tg-metro-1',
        sourceId: 'src-telangana-today',
        sourceName: 'Telangana State Information Bureau',
        title: 'Cabinet Approves Detailed Project Report for Metro Rail Phase 2',
        summary: 'Official notification detailing 5 corridors spanning 76 km at an estimated cost of ₹24,269 crore with joint Central-State equity structure.',
        content: 'The Telangana Cabinet presided by the Chief Minister approved Phase 2 of Hyderabad Metro. The corridors include Nagole to Shamshabad RGIA Airport (36.4 km), Raidurg to Kokapet Neopolis (11.6 km), MGBS to Chandrayangutta (7.5 km), and Miyapur to Patancheru (13.4 km). The proposal has been submitted to the Union Ministry of Housing and Urban Affairs for formal equity participation.',
        url: 'https://telangana.gov.in/notifications/metro-phase-2-cabinet-approval',
        publishedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        geographicScope: 'state',
        country: 'IN',
        state: 'Telangana',
        category: 'infrastructure',
        language: 'en',
        evidenceLabel: 'official_documentation',
        isOpinion: false,
      },
      {
        id: 'art-tg-metro-2',
        sourceId: 'src-the-hindu',
        sourceName: 'The Hindu',
        title: 'Hyderabad Metro Phase 2 DPR cleared; Old City and Airport links prioritized',
        summary: 'Civil society organizations and commuters welcome the inclusion of the Old City link, while urban planners emphasize multi-modal feeder bus integration.',
        content: 'Urban transport analysts noted that connecting Chandrayangutta in the Old City satisfies a longstanding civic demand. Commuter forums have urged the administration to establish dedicated electric feeder bus routes to prevent last-mile bottlenecks around major transfer nodes.',
        url: 'https://www.thehindu.com/news/cities/Hyderabad/hyderabad-metro-phase-2-dpr-cabinet/article681234.ece',
        publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
        geographicScope: 'state',
        country: 'IN',
        state: 'Telangana',
        category: 'infrastructure',
        language: 'en',
        evidenceLabel: 'corroborated_by_sources',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-tg-1',
        storyId: 'story-telangana-metro-expansion',
        eventTimestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        title: 'State Cabinet Approval',
        description: 'Cabinet formally sanctions revised DPR comprising five distinct corridors.',
        whatChanged: 'Phase 2 alignment finalized from previously debated routes.',
        sourceName: 'Telangana State Information Bureau',
        sourceUrl: 'https://telangana.gov.in/notifications/metro-phase-2-cabinet-approval',
        evidenceStatus: 'official_documentation',
      },
      {
        id: 'tl-tg-2',
        storyId: 'story-telangana-metro-expansion',
        eventTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        title: 'Submission to Union Ministry',
        description: 'Formal DPR dispatched to Ministry of Housing and Urban Affairs requesting 50:50 joint venture equity.',
        whatChanged: 'Procedural ball transferred to Union government appraisal committees.',
        sourceName: 'The Hindu',
        sourceUrl: 'https://www.thehindu.com/news/cities/Hyderabad/hyderabad-metro-phase-2-dpr-cabinet/article681234.ece',
        evidenceStatus: 'corroborated_by_sources',
      }
    ]
  },
  {
    id: 'story-india-semiconductor-mission',
    title: 'Union Cabinet Approves Fifth Commercial Semiconductor Fabrication Facility Under ISM',
    summary: 'India Semiconductor Mission expands its production capacity with a ₹3,300 crore testing and assembly facility in Sanand, Gujarat, partnering with global fabrication specialists.',
    whyItMatters: 'Strengthens domestic electronic supply chain resilience, reduces reliance on imported integrated circuits, and fosters specialized engineering jobs.',
    generalTake: 'A decisive strategic push toward hardware self-reliance. While assembly and testing units scale faster than front-end fabs, sustaining raw material inputs and clean-power grids remains critical.',
    geographicScope: 'national',
    country: 'IN',
    category: 'technology',
    leadImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'official_documentation',
    importanceLevel: 'high',
    firstReportedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-semi-1',
        sourceId: 'src-pib-india',
        sourceName: 'Press Information Bureau (PIB)',
        title: 'Cabinet approves establishment of 5th Semiconductor unit under India Semiconductor Mission',
        summary: 'Union Minister Ashwini Vaishnaw announces official sanction with 50% capital subsidy from Central Government under Modified Scheme for Semiconductor Fabs.',
        content: 'The Union Cabinet chaired by Prime Minister approved the proposal of Kaynes Semicon to set up a semiconductor unit in Sanand, Gujarat with an investment of ₹3,300 crore. The capacity of this unit will be 60 lakh chips per day. Chips produced will cater to industrial, automotive, electric vehicles, and power electronics segments.',
        url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=2051234',
        publishedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        geographicScope: 'national',
        country: 'IN',
        category: 'technology',
        language: 'en',
        evidenceLabel: 'official_documentation',
        isOpinion: false,
      },
      {
        id: 'art-semi-2',
        sourceId: 'src-indian-express',
        sourceName: 'The Indian Express',
        title: 'India Semiconductor push: Inside the talent and water supply equations',
        summary: 'Industry experts evaluate the workforce upskilling required for cleanroom technicians and the high-purity water supply contracts signed with state utilities.',
        content: 'While fiscal incentives have mobilized capital, industry leaders emphasize that precision manufacturing demands round-the-clock uninterrupted power and millions of liters of ultra-pure water daily. Indian institutes of technology have launched specialized post-graduate degrees to bridge the talent shortage.',
        url: 'https://indianexpress.com/article/technology/tech-news-technology/semiconductor-mission-sanand-talent-supply-9531234/',
        publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
        geographicScope: 'national',
        country: 'IN',
        category: 'technology',
        language: 'en',
        evidenceLabel: 'corroborated_by_sources',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-semi-1',
        eventTimestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        storyId: 'story-india-semiconductor-mission',
        title: 'Cabinet Clearance Announced',
        description: 'Formal announcement made following Union Cabinet briefing.',
        whatChanged: 'Official financial approval granted under Modified Programme for Development of Semiconductors.',
        sourceName: 'PIB India',
        sourceUrl: 'https://pib.gov.in/PressReleasePage.aspx?PRID=2051234',
        evidenceStatus: 'official_documentation',
      }
    ]
  },
  {
    id: 'story-rbi-monetary-policy-inflation',
    title: 'Reserve Bank of India Keeps Repo Rate Unchanged at 6.5%, Maintains Balanced Stance',
    summary: 'The Monetary Policy Committee voted to keep the policy benchmark rate steady, noting stable domestic growth while monitoring food price indices.',
    whyItMatters: 'Dictates home loan EMIs, corporate borrowing costs, and savings deposit rates across the banking ecosystem.',
    generalTake: 'A prudent pause balancing strong capital expenditure momentum against erratic seasonal vegetable prices that occasionally breach target bands.',
    geographicScope: 'national',
    country: 'IN',
    category: 'economy',
    leadImageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'official_documentation',
    importanceLevel: 'normal',
    firstReportedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-rbi-1',
        sourceId: 'src-the-hindu',
        sourceName: 'The Hindu',
        title: 'RBI MPC holds repo rate at 6.5%; projects GDP growth at 7.2% for FY25',
        summary: 'Governor notes headline inflation remains within acceptable tolerances, but persistent food inflation warrants vigil.',
        content: 'The Reserve Bank of India’s rate-setting panel decided by a 4:2 majority to keep the benchmark repo rate unchanged at 6.50% for the ninth consecutive meeting. Real GDP growth for 2024-25 is projected at 7.2%, reflecting strong investment activity and rural recovery.',
        url: 'https://www.thehindu.com/business/Economy/rbi-monetary-policy-committee-repo-rate-decision/article684567.ece',
        publishedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
        geographicScope: 'national',
        country: 'IN',
        category: 'economy',
        language: 'en',
        evidenceLabel: 'official_documentation',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-rbi-1',
        eventTimestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        storyId: 'story-rbi-monetary-policy-inflation',
        title: 'Monetary Policy Resolution Released',
        description: 'RBI MPC announces status quo on rates and liquidity posture.',
        sourceName: 'The Hindu',
        sourceUrl: 'https://www.thehindu.com/business/Economy/rbi-monetary-policy-committee-repo-rate-decision/article684567.ece',
        evidenceStatus: 'official_documentation',
      }
    ]
  },
  {
    id: 'story-global-un-climate-finance-summit',
    title: 'UN Climate Delegates Negotiate New Collective Quantified Goal for Climate Finance',
    summary: 'Representatives from 190 nations gather in Bonn and Baku to formulate a replacement for the $100 billion annual climate adaptation fund for developing economies.',
    whyItMatters: 'Determines financial transfers from historic carbon emitters to vulnerable nations transitioning toward clean grids and flood-resistant infrastructure.',
    generalTake: 'A recurring diplomatic friction between high-income industrial economies emphasizing private market co-financing and developing nations demanding direct non-debt grants.',
    geographicScope: 'international',
    country: 'UN',
    category: 'climate',
    leadImageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'corroborated_by_sources',
    importanceLevel: 'high',
    firstReportedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    indiaImplication: 'India and the Like-Minded Developing Countries (LMDC) bloc are advocating for at least $1 trillion annually in public grant finance to prevent debt distress in global south transitions.',
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-un-climate-1',
        sourceId: 'src-bbc-world',
        sourceName: 'BBC News — World',
        title: 'Climate finance talks stall as nations clash over trillion-dollar funding target',
        summary: 'Negotiators remain divided over contributor base and whether emerging economies should contribute to the collective pool.',
        content: 'Negotiations over the New Collective Quantified Goal (NCQG) exposed familiar fault lines. Developing states emphasized historical emissions responsibility, while donor nations argued that the donor base must be expanded to include wealthier emerging economies.',
        url: 'https://www.bbc.com/news/science-environment-6891234',
        publishedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        geographicScope: 'international',
        country: 'UN',
        category: 'climate',
        language: 'en',
        evidenceLabel: 'corroborated_by_sources',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-un-1',
        eventTimestamp: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        storyId: 'story-global-un-climate-finance-summit',
        title: 'Draft Negotiating Text Circulated',
        description: 'Co-chairs release revised options paper reflecting divergent donor definitions.',
        sourceName: 'BBC News',
        sourceUrl: 'https://www.bbc.com/news/science-environment-6891234',
        evidenceStatus: 'corroborated_by_sources',
      }
    ]
  },
  {
    id: 'story-ai-frontier-safety-standards',
    title: 'International Consortium Finalizes Shared Safety Benchmarks for Frontier AI Models',
    summary: 'AI safety institutes from the US, UK, Japan, and India release unified technical testing standards for autonomous model capabilities and cyber defense risks.',
    whyItMatters: 'Harmonizes pre-deployment red-teaming protocols across leading model labs, preventing fragmented national compliance regimes.',
    generalTake: 'A milestone in multilateral technological coordination, though the voluntary nature of testing compliance leaves enforcement questions unresolved.',
    geographicScope: 'international',
    country: 'Global',
    category: 'technology',
    leadImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'corroborated_by_sources',
    importanceLevel: 'normal',
    firstReportedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    indiaImplication: 'India AI Safety Institute under MeitY will adapt these benchmarks for multilingual Indian language models to prevent linguistic hallucinations.',
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-ai-1',
        sourceId: 'src-reuters',
        sourceName: 'Reuters World Wire',
        title: 'Global AI safety institutes establish joint model evaluation guidelines',
        summary: 'Agreement focuses on evaluating dangerous capability thresholds including biological risk synthesis and automated cyber-exploitation.',
        content: 'The network of state-backed AI Safety Institutes concluded a joint summit outlining common evaluation criteria. Major developers including Anthropic, Google DeepMind, OpenAI, and Meta have committed to pre-release testing under the unified guidelines.',
        url: 'https://www.reuters.com/technology/global-ai-safety-benchmarks-2024/',
        publishedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
        geographicScope: 'international',
        country: 'Global',
        category: 'technology',
        language: 'en',
        evidenceLabel: 'corroborated_by_sources',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-ai-1',
        eventTimestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        storyId: 'story-ai-frontier-safety-standards',
        title: 'Safety Guidelines Ratified',
        description: 'Signatory delegates publish joint framework paper.',
        sourceName: 'Reuters',
        sourceUrl: 'https://www.reuters.com/technology/global-ai-safety-benchmarks-2024/',
        evidenceStatus: 'corroborated_by_sources',
      }
    ]
  },
  {
    id: 'story-karnataka-bengaluru-suburban-rail',
    title: 'Karnataka Expedites Bengaluru Suburban Rail Corridor-2 Construction With New Tenders',
    summary: 'K-RIDE awards contracts for civil construction on the 25.2 km Baiyappanahalli-Chikkabanavara stretch to de-congest IT corridor commute arteries.',
    whyItMatters: 'Long-delayed regional rail link promises to carry over 9 lakh commuters daily, bridging residential suburbs with industrial tech zones.',
    generalTake: 'A critical suburban transport milestone that will test inter-agency land acquisition speed between Indian Railways and the state urban development ministry.',
    geographicScope: 'state',
    country: 'IN',
    state: 'Karnataka',
    category: 'infrastructure',
    leadImageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'official_documentation',
    importanceLevel: 'normal',
    firstReportedAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-ka-rail-1',
        sourceId: 'src-the-hindu',
        sourceName: 'The Hindu',
        title: 'Bengaluru Suburban Railway Corridor-2 works gather pace as K-RIDE signs package',
        summary: 'Tenders finalized with 24-month completion target across 14 elevated and at-grade stations.',
        content: 'Rail Infrastructure Development Company (Karnataka) Limited confirmed that Corridor 2 (Kanaka Line) civil works have been awarded. The corridor covers major interchanges including Yeshwantpur and Hebbal, providing direct relief to outer ring road bottlenecks.',
        url: 'https://www.thehindu.com/news/cities/bangalore/bengaluru-suburban-rail-corridor-2-progress/article683109.ece',
        publishedAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
        geographicScope: 'state',
        country: 'IN',
        state: 'Karnataka',
        category: 'infrastructure',
        language: 'en',
        evidenceLabel: 'official_documentation',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-ka-1',
        eventTimestamp: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
        storyId: 'story-karnataka-bengaluru-suburban-rail',
        title: 'Contract Package Signed',
        description: 'K-RIDE issues letter of acceptance to civil engineering consortium.',
        sourceName: 'The Hindu',
        sourceUrl: 'https://www.thehindu.com/news/cities/bangalore/bengaluru-suburban-rail-corridor-2-progress/article683109.ece',
        evidenceStatus: 'official_documentation',
      }
    ]
  },
  {
    id: 'story-upsc-examination-digital-reforms',
    title: 'UPSC Evaluates Biometric and Facial Recognition Upgrades for Civil Services Examination',
    summary: 'The Union Public Service Commission initiates procurement for real-time Aadhaar-based biometric authentication and digital surveillance at examination venues nationwide.',
    whyItMatters: 'Aims to eliminate candidate impersonation, preserve integrity of premier recruitment processes, and restore public trust in competitive public sector tests.',
    generalTake: 'A standard technological fortification response following high-profile identity scrutiny cases, though implementation at thousands of tier-2 exam centers requires strict network redundancy.',
    geographicScope: 'national',
    country: 'IN',
    category: 'education',
    leadImageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    evidenceStatus: 'official_documentation',
    importanceLevel: 'normal',
    firstReportedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    isPerspectiveAvailable: true,
    articles: [
      {
        id: 'art-upsc-1',
        sourceId: 'src-pib-india',
        sourceName: 'Press Information Bureau (PIB)',
        title: 'UPSC invites Expression of Interest for Biometric and Facial Verification Solutions',
        summary: 'Tender specification mandates biometric matching before hall entry and during examination sessions.',
        content: 'The Union Public Service Commission has invited expressions of interest from experienced technology vendors to provide digital authentication, facial matching, and AI-enabled attendance scanning for all competitive examinations conducted across the country.',
        url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=2049876',
        publishedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        ingestedAt: new Date(Date.now() - 19 * 3600 * 1000).toISOString(),
        geographicScope: 'national',
        country: 'IN',
        category: 'education',
        language: 'en',
        evidenceLabel: 'official_documentation',
        isOpinion: false,
      }
    ],
    timeline: [
      {
        id: 'tl-upsc-1',
        eventTimestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        storyId: 'story-upsc-examination-digital-reforms',
        title: 'EOI Tender Issued',
        description: 'Notice published on central public procurement portal.',
        sourceName: 'PIB India',
        sourceUrl: 'https://pib.gov.in/PressReleasePage.aspx?PRID=2049876',
        evidenceStatus: 'official_documentation',
      }
    ]
  }
];

export const SEED_PERSPECTIVES: Record<string, PerspectiveAnalysis> = {
  'story-telangana-metro-expansion': {
    id: 'persp-tg-metro',
    storyId: 'story-telangana-metro-expansion',
    whatHappened: 'The Government of Telangana approved the revised Detailed Project Report for Hyderabad Metro Phase 2, approving 76 km across 5 corridors at an estimated outlay of ₹24,269 crore with joint Central-State financing.',
    generalTake: 'AI-Generated Editorial Analysis: Rapid suburban sprawl and gridlock along Hyderabad’s Financial District and Old City have necessitated mass transit expansion. The revised alignment reflects a balanced synthesis of airport connectivity and historic civic inclusivity, though actual execution hinges on Union Cabinet funding clearance.',
    whyItMatters: 'Commuters along the IT corridor and airport highway will experience substantial commute time reductions. Small merchants along the Old City route stand to gain increased footfall, while state public transit ridership will transition from personal fossil-fuel vehicles to electrified transit.',
    perspectivesInFavor: [
      {
        argument: 'Expands mass rapid transit to underserved Southern Hyderabad and ensures equitable infrastructure distribution across all zones of the city.',
        citedSource: 'Telangana Municipal Administration & Urban Development Department',
        affectedGroup: 'Commuters & Old City Residents'
      },
      {
        argument: 'Direct metro connectivity to Rajiv Gandhi International Airport reduces road taxi congestion on the PVNR Expressway and outer ring road.',
        citedSource: 'Hyderabad Airport Transit Consortium',
        affectedGroup: 'Frequent Business Travelers & Logistics Operators'
      }
    ],
    perspectivesAgainst: [
      {
        argument: 'Substantial debt burden on state fiscal headroom unless Central equity contribution of 50% is approved in the upcoming Union budget cycle.',
        citedSource: 'Public Finance & State Expenditure Analysts',
        affectedGroup: 'Taxpayers & State Budget Auditors'
      },
      {
        argument: 'Concerns over construction disruption, road narrowing, and business loss along dense commercial corridors during the 48-month construction cycle.',
        citedSource: 'Hyderabad Traders Federation',
        affectedGroup: 'Retail Shop Owners'
      }
    ],
    affectedGroupsConcerns: [
      {
        group: 'Daily Suburban Commuters',
        concern: 'Delays between project sanction and physical ground-breaking could extend traffic misery.',
        evidence: 'Phase 1 experienced a 3-year gestation delay due to right-of-way disputes.'
      },
      {
        group: 'Urban Pedestrians',
        concern: 'Metro pillars without integrated pedestrian footpaths and skywalks make station access hazardous.',
        evidence: 'Independent audit of Phase 1 stations by Hyderabad Urban Lab.'
      }
    ],
    expertInstitutionalViews: [
      {
        institution: 'Institute for Transportation and Development Policy (ITDP)',
        position: 'Metro lines must be paired with synchronized high-frequency feeder electric buses; otherwise, car reliance persists.',
        source: 'Sustainable Urban Mobility Review 2024'
      }
    ],
    evidenceWellEstablished: [
      'Cabinet sanction formally passed on official records.',
      'Corridor routes and distance breakdown (76 km total) verified in published gazette.',
      'Estimated project cost pegged at ₹24,269 crore.'
    ],
    evidencePreliminary: [
      'Projected daily ridership of 800,000 passengers upon full Phase 2 commissioning.',
      'Union Government’s 50% equity commitment (proposal submitted, awaiting formal approval).'
    ],
    evidenceDisputed: [
      'Optimal station spacing along the Chandrayangutta link (merchants advocate for denser stops, engineers recommend express spacing).'
    ],
    evidenceMissing: [
      'Comprehensive environmental impact assessment and green tree-translocation audit for the airport corridor stretch.'
    ],
    possibleConsequencesPositive: [
      'Estimated reduction of 150,000 metric tons of vehicular carbon emissions annually.',
      'Significant appreciation of property values and job growth around transit-oriented development hubs.'
    ],
    possibleConsequencesNegative: [
      'Temporary arterial traffic bottlenecks during viaduct and pier construction over the next 3 to 4 years.',
      'Potential cost escalation if foreign exchange fluctuations affect imported signaling and rolling stock.'
    ],
    whatToWatchNext: [
      {
        eventDescription: 'Union Cabinet evaluation and formal sanction of Central equity share.',
        expectedTimeline: 'Next 60 to 90 days',
        verifiableSource: 'Union Ministry of Housing and Urban Affairs Notification'
      },
      {
        eventDescription: 'Tender release for geotechnical soil testing along Airport corridor.',
        expectedTimeline: 'Q4 2024',
        verifiableSource: 'Hyderabad Metro Rail Limited (HMRL) Portal'
      }
    ],
    perspectiveComparison: [
      {
        topic: 'Central Equity Financing Model',
        positionA: {
          title: 'Joint 50:50 Joint Venture',
          argument: 'Distributes sovereign risk, secures central sovereign loan guarantees, and aligns with national metro rail policy.',
          limitation: 'Requires prolonged inter-ministerial clearances and compliance with central procurement rules.'
        },
        positionB: {
          title: 'State-Led EPC with Multilateral Loans',
          argument: 'Allows Telangana state faster autonomous execution and customized alignment decisions.',
          limitation: 'Places direct debt liability on state budget deficit ceilings.'
        }
      }
    ],
    aiProvider: 'Pulse Orchestrator (Multi-Model Synthesis)',
    updatedAt: new Date().toISOString()
  },
  'story-india-semiconductor-mission': {
    id: 'persp-semi',
    storyId: 'story-india-semiconductor-mission',
    whatHappened: 'The Union Cabinet sanctioned the fifth major semiconductor assembly and testing facility in Sanand, Gujarat with ₹3,300 crore in capital investment under the India Semiconductor Mission.',
    generalTake: 'AI-Generated Editorial Analysis: India is executing a staged semiconductor strategy, starting with Outsourced Semiconductor Assembly and Test (OSAT) and compound fabs before progressing to sub-7nm commercial logic manufacturing. This establishes domestic cleanroom supply chains and attracts specialized materials suppliers.',
    whyItMatters: 'Critical integrated circuits for automotive, industrial power switches, and smart meters will now be packaged domestically, insulating Indian manufacturers from geopolitical shipping disruptions.',
    perspectivesInFavor: [
      {
        argument: 'Accelerates India’s electronic hardware sovereignty and positions the nation as an indispensable node in the global semiconductor China+1 diversification.',
        citedSource: 'Ministry of Electronics and Information Technology (MeitY)',
        affectedGroup: 'Automotive and Electronics Manufacturers'
      }
    ],
    perspectivesAgainst: [
      {
        argument: 'Capital subsidies of 50% absorb significant public revenue that critics argue could yield higher direct employment if channeled toward broader SME manufacturing.',
        citedSource: 'Economic Policy Review Forum',
        affectedGroup: 'Fiscal Analysts'
      }
    ],
    affectedGroupsConcerns: [
      {
        group: 'Domestic Hardware Startups',
        concern: 'Need guaranteed access to small-batch pilot fab lines, rather than only high-volume multinational contracts.',
        evidence: 'Submissions to the India Semiconductor Mission Advisory Committee.'
      }
    ],
    expertInstitutionalViews: [
      {
        institution: 'IEEE Electronics Society India',
        position: 'Packaging and testing is the correct entry point; training cleanroom specialists takes 3-5 years of continuous operational cycles.',
        source: 'Semiconductor Roadmap 2030'
      }
    ],
    evidenceWellEstablished: [
      'Official Cabinet clearance with gazetted financial outlays.',
      'Land allocation in Sanand GIDC industrial estate completed.',
      'Target production volume of 60 lakh chips daily.'
    ],
    evidencePreliminary: [
      'Projected direct and indirect job creation of 12,000 positions.',
      'Supply chain vendor localization within a 50 km radius.'
    ],
    evidenceDisputed: [
      'Whether state electricity utilities can sustain 99.999% power uptime without localized captive gas/solar backup.'
    ],
    evidenceMissing: [
      'Audited breakdown of domestic vs imported raw silicon wafers for the first 24 operating months.'
    ],
    possibleConsequencesPositive: [
      'Curtailment of electronic component import trade deficits.',
      'Spillover creation of precision testing and robotics institutes in western India.'
    ],
    possibleConsequencesNegative: [
      'Intense pressure on local groundwater tables unless zero-liquid-discharge water recycling is strictly monitored.'
    ],
    whatToWatchNext: [
      {
        eventDescription: 'Groundbreaking ceremony and cleanroom construction commencement.',
        expectedTimeline: 'Q1 2025',
        verifiableSource: 'MeitY Press Releases'
      }
    ],
    perspectiveComparison: [
      {
        topic: 'Government Subsidy Justification',
        positionA: {
          title: 'Strategic Security Necessity',
          argument: 'Without state subsidies matching US CHIPS Act and EU incentives, zero fabs will relocate to India.',
          limitation: 'High capital outlay per direct job generated.'
        },
        positionB: {
          title: 'Market-Driven Incentive Alternative',
          argument: 'Subsidies should be tied strictly to export milestones and domestic IP generation rather than upfront capex.',
          limitation: 'May fail to attract tier-1 global players who demand guaranteed initial capex offsets.'
        }
      }
    ],
    aiProvider: 'Pulse Orchestrator (Multi-Model Synthesis)',
    updatedAt: new Date().toISOString()
  }
};

export const SEED_BRIEFINGS: HourlyPulseBriefing[] = [
  {
    id: 'briefing-latest-global',
    timeWindowStart: new Date(Date.now() - 3600 * 1000).toISOString(),
    timeWindowEnd: new Date().toISOString(),
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    scope: 'global',
    dataFreshnessMinutes: 12,
    summaryOverview: 'The latest hour saw decisive developments in regional transport infrastructure approvals in India, a new semiconductor fabrication sanction under national manufacturing missions, and intensified technical alignment on frontier AI model safety benchmarks.',
    importantDevelopments: [
      {
        storyId: 'story-telangana-metro-expansion',
        headline: 'Telangana clears 76 km Phase 2 Hyderabad Metro across 5 key corridors',
        whatHappened: 'Cabinet sanctioned ₹24,269 crore DPR connecting Old City and Rajiv Gandhi Airport.',
        whyItMatters: 'Transforms urban transit capacity in one of India’s fastest-growing tech metropolises.',
        whatChanged: 'Corridor blueprints finalized and dispatched to Union government for joint equity approval.',
        sources: [
          { name: 'Telangana Govt Portal', url: 'https://telangana.gov.in' },
          { name: 'The Hindu', url: 'https://www.thehindu.com' }
        ],
        evidenceStatus: 'official_documentation'
      },
      {
        storyId: 'story-india-semiconductor-mission',
        headline: 'India Semiconductor Mission expands with fifth sanctioned unit in Sanand',
        whatHappened: 'Union Cabinet approved ₹3,300 crore facility producing 60 lakh chips daily.',
        whyItMatters: 'Reduces semiconductor component import dependencies for industrial and EV hardware.',
        whatChanged: 'Capital subsidy approval formalized by Union Minister Ashwini Vaishnaw.',
        sources: [
          { name: 'PIB India', url: 'https://pib.gov.in' }
        ],
        evidenceStatus: 'official_documentation'
      },
      {
        storyId: 'story-ai-frontier-safety-standards',
        headline: 'Global AI Safety Institutes harmonize frontier model testing benchmarks',
        whatHappened: 'Safety bodies from US, UK, Japan, and India finalized shared cyber and autonomous evaluation criteria.',
        whyItMatters: 'Prevents fragmented regulatory hurdles while setting baseline safety checks.',
        whatChanged: 'Consortium published unified technical framework document.',
        sources: [
          { name: 'Reuters', url: 'https://www.reuters.com' }
        ],
        evidenceStatus: 'corroborated_by_sources'
      }
    ],
    whatChangedSincePrevious: {
      newStoriesCount: 2,
      substantiveUpdatesCount: 1,
      highlights: [
        'Telangana Metro DPR officially dispatched to Union Ministry of Housing and Urban Affairs.',
        'Semiconductor unit sanction officially published on PIB gazette portal.'
      ]
    },
    sourceCount: 5
  }
];

export const SEED_VOCABULARY: VocabularyEntry[] = [
  {
    id: 'vocab-repercussions',
    userId: 'guest-user-default',
    storyId: 'story-rbi-monetary-policy-inflation',
    storyTitle: 'RBI Keeps Repo Rate Unchanged at 6.5%',
    word: 'repercussions',
    sourceSentence: 'The central bank decision could have far-reaching repercussions for mortgage borrowers and credit markets.',
    originalLanguage: 'en',
    targetLanguage: 'te',
    contextualMeaning: 'పర్యవసానాలు (దుష్పరిణామాలు లేదా ఫలితాలు) — An unintended consequence occurring some time after an event or action.',
    originalDefinition: 'An unintended consequence occurring sometime after an event or action, especially an unwelcome one.',
    pronunciation: '/ˌriː.pəˈkʌʃ.ənz/',
    partOfSpeech: 'noun (plural)',
    exampleSentence: 'The sudden hike in raw material prices had severe repercussions for small manufacturing businesses.',
    synonyms: ['consequences', 'ramifications', 'aftermath', 'outcomes'],
    personalNotes: 'Important economic and legal term seen frequently in monetary policy reporting.',
    masteryLevel: 1,
    nextReviewDue: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'vocab-concomitant',
    userId: 'guest-user-default',
    storyId: 'story-india-semiconductor-mission',
    storyTitle: 'Union Cabinet Approves Fifth Semiconductor Facility',
    word: 'concomitant',
    sourceSentence: 'The semiconductor fab buildout requires a concomitant investment in clean-water filtration and power grid stability.',
    originalLanguage: 'en',
    targetLanguage: 'hi',
    contextualMeaning: 'सहवर्ती (साथ होने वाला) — Naturally accompanying or associated with something else.',
    originalDefinition: 'Naturally accompanying or associated.',
    pronunciation: '/kənˈkɒm.ɪ.tənt/',
    partOfSpeech: 'adjective',
    exampleSentence: 'Economic expansion brought a concomitant rise in municipal energy demand.',
    synonyms: ['accompanying', 'associated', 'concurrent', 'related'],
    personalNotes: 'Used in analytical and formal editorial prose.',
    masteryLevel: 0,
    nextReviewDue: new Date().toISOString(),
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'vocab-recalcitrant',
    userId: 'guest-user-default',
    storyId: 'story-global-un-climate-finance-summit',
    storyTitle: 'UN Climate Delegates Negotiate New Collective Quantified Goal',
    word: 'recalcitrant',
    sourceSentence: 'Negotiators faced recalcitrant delegations unwilling to commit to mandatory public grant targets.',
    originalLanguage: 'en',
    targetLanguage: 'te',
    contextualMeaning: 'మొండిపట్టుదలగల / ఎదురుతిరిగే — Having an obstinately uncooperative attitude toward authority or agreements.',
    originalDefinition: 'Having an obstinately uncooperative attitude toward authority or discipline.',
    pronunciation: '/rɪˈkæl.sɪ.trənt/',
    partOfSpeech: 'adjective',
    exampleSentence: 'The company struggled with recalcitrant suppliers who refused to adjust delivery schedules.',
    synonyms: ['uncooperative', 'intractable', 'obstinate', 'defiant'],
    personalNotes: 'Learned from diplomacy and negotiations section.',
    masteryLevel: 2,
    nextReviewDue: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  }
];
