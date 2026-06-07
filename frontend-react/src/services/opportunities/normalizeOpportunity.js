/**
 * normalizeOpportunity.js
 * Transforms any raw API response into the unified Opportunity schema.
 * Every source connector calls one of these helpers.
 */

let _idCounter = 0;
const uid = () => `opp_${Date.now()}_${++_idCounter}`;

/** Strip all HTML tags and decode common HTML entities to plain text */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, ' ')          // remove all tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')           // collapse multiple spaces
    .trim();
}

/** Clamp ms-since-epoch dates to a readable ISO string */
function toISO(val) {
  if (!val) return null;
  try { return new Date(val).toISOString(); } catch { return null; }
}

/** Best-effort type detector */
function detectType(title = '', tags = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (t.includes('intern')) return 'Internship';
  if (t.includes('contract') || t.includes('freelance') || t.includes('gig')) return 'Freelance';
  if (t.includes('part-time') || t.includes('part time')) return 'Part-time';
  if (t.includes('full-time') || t.includes('full time')) return 'Full-time';
  return 'Contract';
}

/** Best-effort work mode detector */
function detectMode(location = '', tags = []) {
  const t = (location + ' ' + tags.join(' ')).toLowerCase();
  if (t.includes('remote')) return 'Remote';
  if (t.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

/** Rough category from title + tags */
function detectCategory(title = '', tags = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (t.match(/react|node|javascript|typescript|frontend|backend|fullstack|full.stack|web dev/)) return 'Web Development';
  if (t.match(/android|ios|flutter|react native|mobile/)) return 'Mobile Development';
  if (t.match(/figma|ui.ux|ux.ui|design system|product design/)) return 'UI/UX';
  if (t.match(/graphic|illustrat|brand|logo|visual/)) return 'Graphic Design';
  if (t.match(/market|seo|social media|content market/)) return 'Marketing';
  if (t.match(/content|writ|copy|blog|article/)) return 'Content Writing';
  if (t.match(/ai|machine learn|ml|nlp|llm|gpt/)) return 'AI';
  if (t.match(/data|analytics|sql|python|pandas/)) return 'Data';
  if (t.match(/doctor|physician|mbbs|nurse|nurs|medical|hospital|health|pharma|clinical|paramedic|dentist|radiology/)) return 'Healthcare';
  if (t.match(/agri|farm|horticulture|icar|crop|soil|veterinary|animal husbandry/)) return 'Agriculture';
  if (t.match(/civil|mechanical|electrical|electronics|chemical|aerospace|structural|manufacturing|industrial engineer/)) return 'Engineering';
  if (t.match(/teach|tutor|faculty|lecturer|professor|education|school|college|university|training/)) return 'Education';
  if (t.match(/bank|finance|account|ca|cpa|auditor|fintech|insurance|taxation/)) return 'Finance';
  if (t.match(/government|govt|ias|ips|upsc|ssc|psc|defence|army|navy|air force|police|railway|municipal|public sector/)) return 'Government';
  return 'Other';
}

/**
 * Normalize a Greenhouse job
 * https://api.greenhouse.io/v1/boards/{company}/jobs
 */
export function normalizeGreenhouse(job, companyHandle) {
  const tags = (job.departments || []).map(d => d.name).concat(
    (job.offices || []).map(o => o.name)
  );
  return {
    id:               uid(),
    sourceId:         String(job.id),
    sourceName:       'Greenhouse',
    sourceUrl:        job.absolute_url || `https://jobs.greenhouse.io/${companyHandle}`,
    title:            job.title || 'Untitled',
    companyName:      companyHandle,
    companyLogo:      `https://logo.clearbit.com/${companyHandle}.com`,
    description:      stripHtml(job.content || ''),
    shortDescription: stripHtml(job.content || '').slice(0, 160),
    skills:           tags.slice(0, 5),
    category:         detectCategory(job.title, tags),
    opportunityType:  detectType(job.title, tags),
    workMode:         detectMode(job.location?.name || '', tags),
    experienceLevel:  'Intermediate',
    location:         job.location?.name || 'Remote',
    country:          '',
    city:             job.location?.name || '',
    budgetMin:        null,
    budgetMax:        null,
    stipend:          null,
    currency:         'USD',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.absolute_url || '',
    isVerified:       true,
    isUrgent:         false,
    postedAt:         toISO(job.updated_at),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize a Lever job
 * https://api.lever.co/v0/postings/{company}?mode=json
 */
export function normalizeLever(job, companyHandle) {
  const tags = (job.categories?.allLocations || [])
    .concat(job.tags || [])
    .concat(job.categories?.department ? [job.categories.department] : []);
  return {
    id:               uid(),
    sourceId:         job.id,
    sourceName:       'Lever',
    sourceUrl:        job.hostedUrl || `https://jobs.lever.co/${companyHandle}`,
    title:            job.text || 'Untitled',
    companyName:      companyHandle,
    companyLogo:      `https://logo.clearbit.com/${companyHandle}.com`,
    description:      stripHtml(job.descriptionPlain || job.description || ''),
    shortDescription: stripHtml(job.descriptionPlain || job.description || '').slice(0, 160),
    skills:           (job.tags || []).slice(0, 5),
    category:         detectCategory(job.text, job.tags || []),
    opportunityType:  detectType(job.text, job.tags || []),
    workMode:         detectMode(job.categories?.location || job.categories?.allLocations?.[0] || '', job.tags || []),
    experienceLevel:  'Intermediate',
    location:         job.categories?.location || job.categories?.allLocations?.[0] || 'Remote',
    country:          '',
    city:             job.categories?.location || '',
    budgetMin:        null,
    budgetMax:        null,
    stipend:          null,
    currency:         'USD',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.hostedUrl || job.applyUrl || '',
    isVerified:       true,
    isUrgent:         false,
    postedAt:         toISO(job.createdAt),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize an Arbeitnow job
 * https://www.arbeitnow.com/api/job-board-api
 */
export function normalizeArbeitnow(job) {
  const tags = job.tags || [];
  return {
    id:               uid(),
    sourceId:         String(job.slug || job.url),
    sourceName:       'Arbeitnow',
    sourceUrl:        job.url || 'https://www.arbeitnow.com',
    title:            job.title || 'Untitled',
    companyName:      job.company_name || 'Company',
    companyLogo:      job.company_logo || null,
    description:      stripHtml(job.description || ''),
    shortDescription: stripHtml(job.description || '').slice(0, 160),
    skills:           tags.slice(0, 5),
    category:         detectCategory(job.title, tags),
    opportunityType:  job.job_types?.[0] || detectType(job.title, tags),
    workMode:         job.remote ? 'Remote' : detectMode(job.location || '', tags),
    experienceLevel:  'Intermediate',
    location:         job.location || 'Remote',
    country:          '',
    city:             job.location || '',
    budgetMin:        null,
    budgetMax:        null,
    stipend:          null,
    currency:         'EUR',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.url || '',
    isVerified:       false,
    isUrgent:         false,
    postedAt:         toISO(job.created_at ? job.created_at * 1000 : null),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize a Jobicy remote job
 * https://jobicy.com/api/v2/remote-jobs
 */
export function normalizeJobicy(job) {
  const tags = (job.jobIndustry || []).concat(job.jobType ? [job.jobType] : []);
  return {
    id:               uid(),
    sourceId:         String(job.id),
    sourceName:       'Jobicy',
    sourceUrl:        job.url || 'https://jobicy.com',
    title:            job.jobTitle || 'Untitled',
    companyName:      job.companyName || 'Company',
    companyLogo:      job.companyLogo || null,
    description:      stripHtml(job.jobDescription || ''),
    shortDescription: stripHtml(job.jobExcerpt || job.jobDescription || '').slice(0, 160),
    skills:           (job.jobIndustry || []).slice(0, 5),
    category:         detectCategory(job.jobTitle, job.jobIndustry || []),
    opportunityType:  'Freelance',
    workMode:         'Remote',
    experienceLevel:  job.jobLevel || 'Intermediate',
    location:         'Remote',
    country:          job.jobGeo || '',
    city:             '',
    budgetMin:        job.annualSalaryMin ? Math.round(job.annualSalaryMin / 12) : null,
    budgetMax:        job.annualSalaryMax ? Math.round(job.annualSalaryMax / 12) : null,
    stipend:          null,
    currency:         job.salaryCurrency || 'USD',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.url || '',
    isVerified:       true,
    isUrgent:         false,
    postedAt:         toISO(job.pubDate),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize an Adzuna job (India endpoint)
 * https://api.adzuna.com/v1/api/jobs/in/search/1
 */
export function normalizeAdzuna(job, searchTerm) {
  const tags   = (job.category?.tag ? [job.category.tag] : [])
    .concat(job.contract_type ? [job.contract_type] : []);
  const loc    = job.location?.display_name || job.location?.area?.join(', ') || 'India';
  const city   = job.location?.area?.[3] || job.location?.area?.[2] || '';

  // Detect sector from category label
  const catLabel = (job.category?.label || '').toLowerCase();
  let category = 'Other';
  if (catLabel.match(/it|software|tech|engineer/)) category = 'Web Development';
  else if (catLabel.match(/health|medical|nurs|doctor|pharma/)) category = 'Healthcare';
  else if (catLabel.match(/agri|farm|horticulture/)) category = 'Agriculture';
  else if (catLabel.match(/education|teach|train/)) category = 'Education';
  else if (catLabel.match(/finance|account|bank/)) category = 'Finance';
  else if (catLabel.match(/government|defence|civil service|public sector/)) category = 'Government';
  else if (catLabel.match(/market|advertis/)) category = 'Marketing';
  else if (catLabel.match(/design|creative/)) category = 'UI/UX';
  else if (catLabel.match(/data|analytic/)) category = 'Data';

  // Salary: Adzuna provides min/max in local currency (INR for India)
  const salMin = job.salary_min ? Math.round(job.salary_min / 12) : null; // annual → monthly
  const salMax = job.salary_max ? Math.round(job.salary_max / 12) : null;

  return {
    id:               uid(),
    sourceId:         String(job.id),
    sourceName:       'Adzuna',
    sourceUrl:        job.redirect_url || 'https://www.adzuna.in',
    title:            job.title || 'Untitled',
    companyName:      job.company?.display_name || 'Company',
    companyLogo:      job.company?.display_name
      ? `https://logo.clearbit.com/${job.company.display_name.toLowerCase().replace(/\s+/g, '')}.com`
      : null,
    description:      stripHtml(job.description || ''),
    shortDescription: stripHtml(job.description || '').slice(0, 160),
    skills:           tags.slice(0, 5),
    category,
    opportunityType:  job.contract_type === 'permanent' ? 'Full-time'
                    : job.contract_type === 'contract' ? 'Contract'
                    : job.contract_type === 'part_time' ? 'Part-time'
                    : detectType(job.title, tags),
    workMode:         detectMode(loc, tags),
    experienceLevel:  'Intermediate',
    location:         loc,
    country:          'IN',
    city,
    budgetMin:        salMin,
    budgetMax:        salMax,
    stipend:          null,
    currency:         'INR',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.redirect_url || '',
    isVerified:       false,
    isUrgent:         false,
    postedAt:         toISO(job.created),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize a RemoteOK job
 * https://remoteok.com/api
 */
export function normalizeRemoteOk(job) {
  const tags = (job.tags || []).slice(0, 6);
  return {
    id:               uid(),
    sourceId:         String(job.id || job.slug),
    sourceName:       'RemoteOK',
    sourceUrl:        job.url || 'https://remoteok.com',
    title:            job.position || 'Untitled',
    companyName:      job.company || 'Company',
    companyLogo:      job.company_logo || null,
    description:      stripHtml(job.description || ''),
    shortDescription: stripHtml(job.description || '').slice(0, 160),
    skills:           tags,
    category:         detectCategory(job.position, tags),
    opportunityType:  'Freelance',
    workMode:         'Remote',
    experienceLevel:  'Intermediate',
    location:         'Remote (Worldwide)',
    country:          '',
    city:             '',
    budgetMin:        job.salary_min || null,
    budgetMax:        job.salary_max || null,
    stipend:          null,
    currency:         'USD',
    duration:         null,
    applyType:        'external',
    applyUrl:         job.url || job.apply_url || '',
    isVerified:       !!job.verified,
    isUrgent:         false,
    postedAt:         toISO(job.date),
    deadline:         null,
    employerRating:   null,
    tags,
    isSaved:          false,
    isApplied:        false,
    raw:              job,
  };
}

/**
 * Normalize a Government RSS feed item (via rss2json)
 * Covers UPSC, SSC, NHM, ICAR, Employment News etc.
 */
export function normalizeGovtRss(item, sourceName, sector) {
  const title = stripHtml(item.title || '');
  const desc  = stripHtml(item.description || item.content || '');

  // Detect category from sector + title
  let category = 'Government';
  const t = (title + ' ' + desc).toLowerCase();
  if (sector === 'Healthcare' || t.match(/doctor|nurse|nurs|medical|health|paramedic/)) category = 'Healthcare';
  else if (t.match(/agri|farm|icar|horticulture/)) category = 'Agriculture';
  else if (t.match(/engineer|technical|tech/)) category = 'Engineering';
  else if (t.match(/teach|education|school|college|university/)) category = 'Education';
  else if (t.match(/bank|finance|account/)) category = 'Finance';

  return {
    id:               uid(),
    sourceId:         item.guid || item.link || uid(),
    sourceName,
    sourceUrl:        item.link || '#',
    title,
    companyName:      sourceName,
    companyLogo:      null,
    description:      desc,
    shortDescription: desc.slice(0, 160),
    skills:           [],
    category,
    opportunityType:  'Full-time',
    workMode:         'On-site',
    experienceLevel:  'Intermediate',
    location:         'India',
    country:          'IN',
    city:             '',
    budgetMin:        null,
    budgetMax:        null,
    stipend:          null,
    currency:         'INR',
    duration:         null,
    applyType:        'external',
    applyUrl:         item.link || '',
    isVerified:       true,  // Government sources are verified
    isUrgent:         false,
    postedAt:         toISO(item.pubDate),
    deadline:         null,
    employerRating:   null,
    tags:             ['Government', 'India', category],
    isSaved:          false,
    isApplied:        false,
    raw:              item,
  };
}
