import { Request } from 'express';

/**
 * Validates and normalizes application and client URLs, rejecting AI Studio proxy / auth-bridge domains in production.
 */
export const getCanonicalClientUrl = (req?: Request): string => {
  const envUrl = process.env.CLIENT_URL || process.env.APP_URL || process.env.VITE_APP_URL;

  if (envUrl) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    if (!isAiStudioProxyUrl(trimmed)) {
      return trimmed;
    }
  }

  if (req) {
    const host = req.get('host');
    const protocol = req.protocol || 'https';
    if (host && !isAiStudioProxyUrl(`${protocol}://${host}`)) {
      return `${protocol}://${host}`;
    }
  }

  // Safe production/development fallback
  return 'http://localhost:3000';
};

export const isAiStudioProxyUrl = (urlStr: string): boolean => {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname.includes('aistudio.google.com') ||
      hostname.includes('googleusercontent.com') ||
      hostname.includes('applet-auth-bridge') ||
      hostname.includes('cloudworkstations.dev') && hostname.includes('proxy')
    );
  } catch {
    return (
      urlStr.includes('aistudio.google.com') ||
      urlStr.includes('applet-auth-bridge') ||
      urlStr.includes('googleusercontent.com')
    );
  }
};
