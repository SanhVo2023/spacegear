export type Publication = { mode: string; origin: string; contactEmail?: string; policiesApproved?: boolean };
export function validatePublication(config: Publication, routes: string[]): string[] {
  const errors: string[] = [];
  if (new Set(routes).size !== routes.length) errors.push("duplicate published route");
  if (routes.some((route) => !route.startsWith("/") || !route.endsWith("/") || route.includes("//"))) errors.push("invalid canonical route");
  if (!["preview", "production"].includes(config.mode)) errors.push("invalid publication mode");
  if (config.mode === "production") {
    try {
      const url = new URL(config.origin);
      const placeholder = /(^localhost$|^127\.|example\.(com|org|net)$|\.example$|\.test$|\.invalid$|\.vercel\.app$)/i.test(url.hostname);
      if (url.protocol !== "https:" || placeholder || url.origin !== config.origin || url.username || url.password) errors.push("confirmed HTTPS origin required");
    } catch { errors.push("valid origin required"); }
    if (!config.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail) || /@example\./i.test(config.contactEmail)) errors.push("verified contact email required");
    if (!config.policiesApproved) errors.push("policies must be approved before publication");
  }
  return errors;
}
