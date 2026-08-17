const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

export function appendUtmParams(originalUrl, utm = {}) {
  if (!originalUrl) return originalUrl;
  const url = new URL(originalUrl);
  const map = {
    utm_source: utm.utmSource ?? utm.utm_source,
    utm_medium: utm.utmMedium ?? utm.utm_medium,
    utm_campaign: utm.utmCampaign ?? utm.utm_campaign,
    utm_term: utm.utmTerm ?? utm.utm_term,
    utm_content: utm.utmContent ?? utm.utm_content,
  };
  for (const key of UTM_KEYS) {
    const value = map[key];
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value).trim().slice(0, 200));
  }
  return url.toString();
}

export function normalizeUtmInput(body = {}) {
  const pick = (a, b) => {
    const value = body[a] ?? body[b];
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") return { error: `${a} must be a string` };
    return value.trim().slice(0, 200);
  };
  const utmSource = pick("utmSource", "utm_source");
  if (utmSource?.error) return utmSource;
  const utmMedium = pick("utmMedium", "utm_medium");
  if (utmMedium?.error) return utmMedium;
  const utmCampaign = pick("utmCampaign", "utm_campaign");
  if (utmCampaign?.error) return utmCampaign;
  const utmTerm = pick("utmTerm", "utm_term");
  if (utmTerm?.error) return utmTerm;
  const utmContent = pick("utmContent", "utm_content");
  if (utmContent?.error) return utmContent;
  return { utmSource, utmMedium, utmCampaign, utmTerm, utmContent };
}
