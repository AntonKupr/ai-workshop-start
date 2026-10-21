// The web view for tests/web.spec.ts: the built page, with GitHub answering as in tests/helpers.ts.
import { startServer } from '../src/web/server.ts';
import { open, openOrganization } from './helpers.ts';

const server = await startServer({ port: Number(process.argv[2]), open, openOrganization });
console.log(`Skill Atlas at ${server.url}`);
