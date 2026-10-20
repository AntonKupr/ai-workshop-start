import { AtlasError, RateLimitError } from './errors.ts';
import { findSkills, type SkillFile } from './find.ts';
import { sortSkills, type Organization, type Repository, type Skill } from './model.ts';
import { parseSkill } from './parse.ts';

/** A repository to scan: its files, and how to read them. */
export type Source = {
  repository: Repository;
  /** Every file path, relative to the repository root. */
  paths: string[];
  /** What listing the files had to leave out. */
  warnings: string[];
  /** The file's bytes, or undefined if it is not there. */
  read(path: string): Promise<Uint8Array | undefined>;
};

export type ScanResult = { repository: Repository; skills: Skill[]; warnings: string[] };

/** An organization to scan: its repositories, and how to open each one. */
export type OrganizationSource = {
  organization: Organization;
  /** Every repository, `owner/name`. */
  repositories: string[];
  /** What listing the repositories had to leave out. */
  warnings: string[];
  /** The repository, or undefined when it is known to have no skills. */
  open(name: string): Promise<Source | undefined>;
};

export type OrganizationScan = {
  organization: Organization;
  /** How many repositories were scanned. */
  repositories: number;
  /** Each repository with skills, by id. */
  results: ScanResult[];
  /** Each one starts with its repository's id. */
  warnings: string[];
};

/** At most this many repositories are scanned at the same time. */
const PARALLEL = 8;

/**
 * Every repository, each one as `scan` does it. A repository that cannot be scanned is a
 * warning and the scan goes on; the rate limit would fail every other one, so it stops it.
 */
export async function scanOrganization(source: OrganizationSource): Promise<OrganizationScan> {
  const names = [...source.repositories].sort(compare);
  const outcomes: { result?: ScanResult; warnings: string[] }[] = [];
  let next = 0;
  async function worker() {
    while (next < names.length) {
      const index = next++;
      try {
        outcomes[index] = await scanOne(source, names[index]);
      } catch (error) {
        next = names.length; // the other workers stop too
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, names.length) }, worker));
  const results = outcomes.flatMap(({ result }) => (result && result.skills.length > 0 ? [result] : []));
  return {
    organization: source.organization,
    repositories: names.length,
    results: results.sort((a, b) => compare(a.repository.id, b.repository.id)),
    warnings: [...source.warnings, ...outcomes.flatMap((outcome) => outcome.warnings)],
  };
}

async function scanOne(source: OrganizationSource, name: string): Promise<{ result?: ScanResult; warnings: string[] }> {
  try {
    const repository = await source.open(name);
    if (!repository) return { warnings: [] };
    const result = await scan(repository);
    return { result, warnings: result.warnings.map((warning) => `${result.repository.id}: ${warning}`) };
  } catch (error) {
    if (!(error instanceof AtlasError) || error instanceof RateLimitError) throw error;
    return { warnings: [`${name}: ${error.message}`] };
  }
}

/** The same order everywhere, whatever the locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** fetch → find → parse. Nothing is stored: the result is all there is. */
export async function scan(source: Source): Promise<ScanResult> {
  const files = findSkills(source.paths, source.repository.name);
  // The files are read at the same time: on GitHub, each one is a request.
  const results = await Promise.all(files.map((file) => readSkill(source, file)));
  return {
    repository: source.repository,
    skills: sortSkills(results.flatMap((result) => (result.skill ? [result.skill] : []))),
    warnings: [...source.warnings, ...results.flatMap((result) => (result.warning ? [result.warning] : []))],
  };
}

async function readSkill(source: Source, file: SkillFile): Promise<{ skill?: Skill; warning?: string }> {
  const bytes = await source.read(file.path);
  if (!bytes) return { warning: `${file.path}: listed, but not found at the scanned commit; skipped` };
  const parsed = parseSkill(new TextDecoder().decode(bytes));
  const skill: Skill = {
    id: `${source.repository.id}:${file.path}`,
    repository: source.repository.id,
    path: file.path,
    name: parsed.name ?? file.name,
    description: parsed.description,
    commit: source.repository.commit,
    copies: file.copies,
    properties: parsed.properties,
    body: parsed.body,
  };
  return { skill, warning: parsed.warning && `${file.path}: ${parsed.warning}` };
}
