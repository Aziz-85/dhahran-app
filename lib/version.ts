/** Single source of truth: package.json version (injected at build via next.config env). */
export const APP_VERSION = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_VERSION
  ? process.env.NEXT_PUBLIC_APP_VERSION
  : '1.0.0';

