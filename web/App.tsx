// The web view: a field for the repository and one for an organization, the skills found, and the
// selected SKILL.md.
import Banner from '@jetbrains/ring-ui-built/components/banner/banner';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import Input from '@jetbrains/ring-ui-built/components/input/input';
import Island, { Content, Header } from '@jetbrains/ring-ui-built/components/island/island';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import type { Repository } from '../src/core/model.ts';
import { scanOrganization, scanRepository, type WebSkill } from './api.ts';
import { SkillView } from './SkillView.tsx';

/** What a scan shows: a repository's skills, or those of each repository in an organization. */
type Shown = {
  header: ReactNode;
  groups: { repository: Repository; skills: WebSkill[] }[];
  /** An organization's skills are listed under their repository. */
  grouped: boolean;
  warnings: string[];
};

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function showRepository(input: string): Promise<Shown> {
  const { repository, skills, warnings } = await scanRepository(input);
  return {
    header: (
      <>
        <Link href={repository.url}>{repository.id}</Link> · {count(skills.length, 'skill', 'skills')}
      </>
    ),
    groups: [{ repository, skills }],
    grouped: false,
    warnings,
  };
}

async function showOrganization(input: string): Promise<Shown> {
  const { organization, repositories, results, warnings } = await scanOrganization(input);
  const skills = results.reduce((sum, result) => sum + result.skills.length, 0);
  return {
    header: (
      <>
        <Link href={organization.url}>{organization.id}</Link> · {count(repositories, 'repository', 'repositories')} ·{' '}
        {count(skills, 'skill', 'skills')}
      </>
    ),
    groups: results,
    grouped: true,
    warnings,
  };
}

export function App() {
  const [input, setInput] = useState('');
  const [organization, setOrganization] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Shown>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();

  async function show(event: FormEvent, scanned: () => Promise<Shown>) {
    event.preventDefault();
    setScanning(true);
    setError(undefined);
    try {
      const shown = await scanned();
      setResult(shown);
      setSelected(shown.groups[0]?.skills[0]?.id);
    } catch (failure) {
      setResult(undefined);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setScanning(false);
    }
  }

  const skill = result?.groups.flatMap((group) => group.skills).find((candidate) => candidate.id === selected);

  return (
    <main className="atlas">
      <Heading level={1}>Skill Atlas</Heading>
      <form className="atlas-form" onSubmit={(event) => show(event, () => showRepository(input))}>
        <Input
          label="Repository"
          placeholder="https://github.com/JetBrains/kotlin or a local directory"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onClear={() => setInput('')}
          data-test="repository"
          className="atlas-input"
        />
        <Button primary type="submit" disabled={scanning} data-test="scan">
          Scan
        </Button>
        {scanning && <LoaderInline data-test="scanning" />}
      </form>
      <form className="atlas-form" onSubmit={(event) => show(event, () => showOrganization(organization))}>
        <Input
          label="Organization"
          placeholder="JetBrains or https://github.com/JetBrains: every repository in it"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          onClear={() => setOrganization('')}
          data-test="organization"
          className="atlas-input"
        />
        <Button type="submit" disabled={scanning} data-test="look-up">
          Look up
        </Button>
      </form>

      {error && (
        <Banner mode="error" title="Cannot scan" data-test="error">
          {error}
        </Banner>
      )}

      {result && (
        <>
          <Heading level={2} data-test="header">
            {result.header}
          </Heading>
          {result.warnings.length > 0 && (
            <Banner mode="warning" title="Warnings" data-test="warnings">
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Banner>
          )}
          <div className="atlas-columns">
            <Island className="atlas-list">
              <Header border>Skills</Header>
              <Content>
                <ul data-test="skills">
                  {result.groups.map(({ repository, skills }) => (
                    <Fragment key={repository.id}>
                      {result.grouped && (
                        <li className="atlas-group" data-test="group">
                          <Link href={repository.url}>{repository.id}</Link>
                        </li>
                      )}
                      {skills.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={item.id === selected ? 'atlas-skill atlas-skill_selected' : 'atlas-skill'}
                            aria-pressed={item.id === selected}
                            onClick={() => setSelected(item.id)}
                            data-test="skill"
                          >
                            <span className="atlas-skill-name">{item.name}</span>
                            {item.summary && <Text info>{item.summary}</Text>}
                            {item.copies.length > 0 && <Text info size={Text.Size.S}>also in {item.copies.join(', ')}</Text>}
                          </button>
                        </li>
                      ))}
                    </Fragment>
                  ))}
                </ul>
              </Content>
            </Island>
            {skill && <SkillView skill={skill} />}
          </div>
        </>
      )}
    </main>
  );
}
