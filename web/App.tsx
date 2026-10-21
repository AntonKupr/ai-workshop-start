// The web view: a field for the repository, the skills found in it, and the selected SKILL.md.
import Banner from '@jetbrains/ring-ui-built/components/banner/banner';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import Input, { Size } from '@jetbrains/ring-ui-built/components/input/input';
import Island, { Content, Header } from '@jetbrains/ring-ui-built/components/island/island';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Toggle from '@jetbrains/ring-ui-built/components/toggle/toggle';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { scanRepository, type WebScan, type WebSkill } from './api.ts';
import { matching } from './filter.ts';
import { groups } from './group.ts';
import { SkillView } from './SkillView.tsx';

export function App() {
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<WebScan>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);
  // The collapsed groups, by word; Other is ''.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setScanning(true);
    setError(undefined);
    try {
      const scanned = await scanRepository(input);
      setResult(scanned);
      setFilter('');
      setCollapsed(new Set());
      setSelected(inOrder(scanned.skills)[0]?.id);
    } catch (failure) {
      setResult(undefined);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setScanning(false);
    }
  }

  // The skills in the order the list shows them, so that "the first" is the first row.
  function inOrder(skills: WebSkill[]): WebSkill[] {
    return grouped ? groups(skills).flatMap((group) => group.skills) : skills;
  }

  // A skill the filter hides is no longer selected: the first match is.
  function changeFilter(value: string) {
    setFilter(value);
    const matches = matching(result?.skills ?? [], value);
    if (!matches.some((candidate) => candidate.id === selected)) setSelected(inOrder(matches)[0]?.id);
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

  const shown = result ? matching(result.skills, filter) : [];
  // Grouped over every skill, so that the groups stay put while filtering; a group with no match is hidden.
  const shownGroups =
    grouped && result
      ? groups(result.skills)
          .map((group) => ({ ...group, skills: group.skills.filter((item) => shown.includes(item)) }))
          .filter((group) => group.skills.length > 0)
      : [];
  const skill = shown.find((candidate) => candidate.id === selected);
  const count = result && `${result.skills.length} ${result.skills.length === 1 ? 'skill' : 'skills'}`;

  return (
    <main className="atlas">
      <Heading level={1}>Skill Atlas</Heading>
      <form className="atlas-form" onSubmit={submit}>
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

      {error && (
        <Banner mode="error" title="Cannot scan" data-test="error">
          {error}
        </Banner>
      )}

      {result && (
        <>
          <Heading level={2} data-test="header">
            <Link href={result.repository.url}>{result.repository.id}</Link> · {count}
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
              <Content>
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
                {shown.length === 0 && result.skills.length > 0 && (
                  <Text info data-test="no-match">
                    No skills match “{filter.trim()}”
                  </Text>
                )}
                <div className="atlas-group-toggle">
                  <Toggle checked={grouped} onChange={(event) => setGrouped(event.target.checked)} data-test="group-toggle">
                    Group by shared words
                  </Toggle>
                </div>
                {grouped ? (
                  <ul data-test="groups">
                    {shownGroups.map((group) => {
                      const key = group.word ?? '';
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
                ) : (
                  <SkillList skills={shown} selected={selected} select={setSelected} />
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
