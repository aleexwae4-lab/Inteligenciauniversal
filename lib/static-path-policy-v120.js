import { extname } from 'node:path';

// The repository root contains runtime source, credentials/configuration and UI assets.
// Serve only public asset types and never expose server-side implementation directories.
const PRIVATE_DIRS = new Set([
  'api', 'lib', 'backend-v73', 'node_modules', 'supabase', 'tests', 'test',
  'scripts', 'docs', 'coverage', 'config', '.git', '.github',
]);
const PRIVATE_ROOT_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'yarn.lock',
  'pnpm-lock.yaml', 'render.yaml', 'vercel.json', 'readme.md',
  'startup-guard-v23.js',
]);
const PUBLIC_EXTENSIONS = new Set([
  '.html', '.js', '.css', '.webmanifest', '.svg', '.png', '.jpg',
  '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.avif',
]);

export function staticPathPolicy(pathname, uiEntry) {
  const invalid = (status=404) => ({ allowed: false, status });
  const raw = String(pathname || '');
  // Reject encoded separators before decoding to avoid ambiguous routing.
  if (/%2f|%5c/i.test(raw)) return invalid(400);
  let decoded;
  try { decoded = decodeURIComponent(raw); }
  catch { return invalid(400); }
  if (!decoded.startsWith('/') || /[\\\u0000]/.test(decoded)) return invalid(400);
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) return invalid();
  if (segments.some(segment => segment.startsWith('.'))) return invalid();
  if (segments.some(segment => PRIVATE_DIRS.has(segment.toLowerCase()))) return invalid();
  if (segments.length === 1 && PRIVATE_ROOT_FILES.has(segments[0].toLowerCase())) return invalid();

  const requested = segments.length === 0 || decoded === '/index.html'
    ? uiEntry : segments.join('/');
  if (typeof requested !== 'string' || !requested) return invalid();
  const ext = extname(requested).toLowerCase();
  if (ext && !PUBLIC_EXTENSIONS.has(ext)) return invalid();
  return { allowed: true, path: requested, isAsset: Boolean(ext) };
}
