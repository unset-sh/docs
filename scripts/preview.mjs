import { cp, mkdir } from 'node:fs/promises';

// Explicitly opt into examples after prepare.mjs. Never called by publication.
// Keep fixtures out of root content and out of source repository sections.
await mkdir('.build/content', { recursive: true });
await cp('tests/fixtures/preview', '.build/content', { recursive: true });
console.log('Added documentation preview fixtures; these are not source exports.');
