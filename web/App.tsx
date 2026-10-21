// The web view: a field for the repository and one for an organization, the skills found, and the
// selected SKILL.md.
import Banner from '@jetbrains/ring-ui-built/components/banner/banner';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import Input, { Size } from '@jetbrains/ring-ui-built/components/input/input';
import Island, { Content, Header } from '@jetbrains/ring-ui-built/components/island/island';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Toggle from '@jetbrains/ring-ui-built/components/toggle/toggle';
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Repository } from '../src/core/model.ts';
import { scanOrganization, scanRepository, type WebSkill } from './api.ts';
import { matching } from './filter.ts';
import { groups } from './group.ts';
import { SkillView } from './SkillView.tsx';

/** What a scan shows: a repository's skills, or those of each repository in an organization. */
type Shown = {
  header: ReactNode;
  repositories: Listed[];
  /** An organization's skills are listed under their repository. */
  organization: boolean;
  warnings: string[];
};

type Listed = { repository: Repository; skills: WebSkill[] };

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
    repositories: [{ repository, skills }],
    organization: false,
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
    repositories: results,
    organization: true,
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
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);
  // The collapsed groups, `<repository>:<word>`; Other's word is ''.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  async function show(event: FormEvent, scanned: () => Promise<Shown>) {
    event.preventDefault();
    setScanning(true);
    setError(undefined);
    try {
      const shown = await scanned();
      setResult(shown);
      setFilter('');
      setCollapsed(new Set());
      setSelected(inOrder(shown.repositories)[0]?.id);
    } catch (failure) {
      setResult(undefined);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setScanning(false);
    }
  }

  // The skills in the order the list shows them, so that "the first" is the first row.
  function inOrder(repositories: Listed[]): WebSkill[] {
    return repositories.flatMap(({ skills }) => (grouped ? groups(skills).flatMap((group) => group.skills) : skills));
  }

  // A skill the filter hides is no longer selected: the first match is.
  function changeFilter(value: string) {
    setFilter(value);
    const matches = (result?.repositories ?? []).map((listed) => ({ ...listed, skills: matching(listed.skills, value) }));
    if (!matches.some(({ skills }) => skills.some((candidate) => candidate.id === selected))) {
      setSelected(inOrder(matches)[0]?.id);
    }
  }

  function toggleGroup(key: string) {
    const next = new Set(collapsed);
    if (!next.delete(key)) next.add(key);
    setCollapsed(next);
  }

  // The list fits the window from where it starts: under the header before the page scrolls,
  // at its sticky top after. page.css reads that top from --atlas-list-top.
  const columns = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = columns.current;
    if (!element) return;
    const fit = () => element.style.setProperty('--atlas-list-top', `${element.getBoundingClientRect().top}px`);
    fit();
    window.addEventListener('scroll', fit, { passive: true });
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
    };
  }, [result]);

  // Each repository's skills, and those the filter matches.
  const lists = (result?.repositories ?? []).map((listed) => ({ ...listed, matches: matching(listed.skills, filter) }));
  const shown = lists.flatMap(({ matches }) => matches);
  const total = lists.reduce((sum, { skills }) => sum + skills.length, 0);
  const skill = shown.find((candidate) => candidate.id === selected);

  // A repository's list, grouped or not.
  function list({ repository, skills, matches }: (typeof lists)[number]) {
    if (!grouped) return <SkillList skills={matches} selected={selected} select={setSelected} />;
    // Grouped over every skill, so that the groups stay put while filtering; a group with no match is hidden.
    const shownGroups = groups(skills)
      .map((group) => ({ ...group, skills: group.skills.filter((item) => matches.includes(item)) }))
      .filter((group) => group.skills.length > 0);
    return (
      <ul data-test="groups">
        {shownGroups.map((group) => {
          const key = `${repository.id}:${group.word ?? ''}`;
          const expanded = !collapsed.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                className="atlas-group"
                aria-expanded={expanded}
                onClick={() => toggleGroup(key)}
                data-test="group"
              >
                {group.word ?? 'Other'} · {group.skills.length}
              </button>
              {expanded && <SkillList skills={group.skills} selected={selected} select={setSelected} />}
            </li>
          );
        })}
      </ul>
    );
  }

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
          <div className="atlas-columns" ref={columns}>
            <Island className="atlas-list">
              <Header border>Skills</Header>
              {/* No fade, even though the list scrolls: Ring UI may leave it stale, its islands share one frame scheduler */}
              <Content fade={false}>
                <Input
                  label="Filter"
                  placeholder="Name or description"
                  value={filter}
                  onChange={(event) => changeFilter(event.target.value)}
                  onClear={() => changeFilter('')}
                  data-test="filter"
                  size={Size.FULL}
                  className="atlas-filter"
                />
                {shown.length === 0 && total > 0 && (
                  <Text info data-test="no-match">
                    No skills match “{filter.trim()}”
                  </Text>
                )}
                <div className="atlas-group-toggle">
                  <Toggle checked={grouped} onChange={(event) => setGrouped(event.target.checked)} data-test="group-toggle">
                    Group by shared words
                  </Toggle>
                </div>
                {result.organization ? (
                  // A repository with no match is hidden.
                  <ul data-test="repositories">
                    {lists
                      .filter(({ matches }) => matches.length > 0)
                      .map((listed) => (
                        <li key={listed.repository.id}>
                          <div className="atlas-repository" data-test="repository-group">
                            <Link href={listed.repository.url}>{listed.repository.id}</Link>
                          </div>
                          {list(listed)}
                        </li>
                      ))}
                  </ul>
                ) : (
                  lists[0] && list(lists[0])
                )}
              </Content>
            </Island>
            {skill && <SkillView skill={skill} />}
          </div>
        </>
      )}
    </main>
  );
}

function SkillList({ skills, selected, select }: { skills: WebSkill[]; selected?: string; select: (id: string) => void }) {
  return (
    <ul data-test="skills">
      {skills.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={item.id === selected ? 'atlas-skill atlas-skill_selected' : 'atlas-skill'}
            aria-pressed={item.id === selected}
            onClick={() => select(item.id)}
            data-test="skill"
          >
            <span className="atlas-skill-name">{item.name}</span>
            {item.summary && (
              <Text info className="atlas-skill-summary">
                {item.summary}
              </Text>
            )}
            {item.copies.length > 0 && <Text info size={Text.Size.S}>also in {item.copies.join(', ')}</Text>}
          </button>
        </li>
      ))}
    </ul>
  );
}
