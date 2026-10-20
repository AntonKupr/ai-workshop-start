// The web view: a field for the repository, the skills found in it, and the selected SKILL.md.
import Banner from '@jetbrains/ring-ui-built/components/banner/banner';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import Input from '@jetbrains/ring-ui-built/components/input/input';
import Island, { Content, Header } from '@jetbrains/ring-ui-built/components/island/island';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import { useState, type FormEvent } from 'react';
import { scanRepository, type WebScan } from './api.ts';
import { matching } from './filter.ts';
import { SkillView } from './SkillView.tsx';

export function App() {
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<WebScan>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setScanning(true);
    setError(undefined);
    try {
      const scanned = await scanRepository(input);
      setResult(scanned);
      setFilter('');
      setSelected(scanned.skills[0]?.id);
    } catch (failure) {
      setResult(undefined);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setScanning(false);
    }
  }

  // A skill the filter hides is no longer selected: the first match is.
  function changeFilter(value: string) {
    setFilter(value);
    const matches = matching(result?.skills ?? [], value);
    if (!matches.some((candidate) => candidate.id === selected)) setSelected(matches[0]?.id);
  }

  const shown = result ? matching(result.skills, filter) : [];
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
          <div className="atlas-columns">
            <Island className="atlas-list">
              <Header border>Skills</Header>
              {/* Islands grow with their content, nothing scrolls: no fade, which Ring UI may leave stale */}
              <Content fade={false}>
                <Input
                  label="Filter"
                  placeholder="Name or description"
                  value={filter}
                  onChange={(event) => changeFilter(event.target.value)}
                  onClear={() => changeFilter('')}
                  data-test="filter"
                  className="atlas-filter"
                />
                {shown.length === 0 && result.skills.length > 0 && (
                  <Text info data-test="no-match">
                    No skills match “{filter.trim()}”
                  </Text>
                )}
                <ul data-test="skills">
                  {shown.map((item) => (
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
