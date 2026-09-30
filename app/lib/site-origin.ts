/** Explicit production origin keeps previews and custom domains canonical. */
export function siteOrigin(): string {
  const configured=process.env.SITE_URL?.trim();
  const automatic=process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value=configured || (automatic?`https://${automatic}`:"https://hub-studio.herestay-4226.chatgpt.site");
  const url=new URL(value);
  if(!["https:","http:"].includes(url.protocol))throw new Error("SITE_URL must be an http(s) URL");
  return url.origin;
}
