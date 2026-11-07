// Services Plan A ④-1 names as supported. The URL is only checked locally and never fetched.
const SUPPORTED_HOSTS = ['instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com'];

/**
 * Whether the text looks like a post on a supported service: an optional http(s) scheme,
 * a supported host or subdomain, and a non-empty path. Anything else shows ④-E.
 */
export function isSupportedPostUrl(text: string) {
  const host = /^(?:https?:\/\/)?([^/?#\s]+)\/\S+$/i.exec(text.trim())?.[1]?.toLowerCase();
  if (!host) {
    return false;
  }
  return SUPPORTED_HOSTS.some((supported) => host === supported || host.endsWith(`.${supported}`));
}
