// One SKILL.md: its front matter, its body rendered as Markdown, and its link at the scanned commit.
import Island, { Content, Header } from '@jetbrains/ring-ui-built/components/island/island';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Tag from '@jetbrains/ring-ui-built/components/tag/tag';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import type { WebSkill } from './api.ts';

export function SkillView({ skill }: { skill: WebSkill }) {
  // A SKILL.md comes from any repository: its HTML is sanitized, so nothing in it runs.
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(skill.body, { async: false })), [skill.body]);
  const properties = Object.entries(skill.properties);
  return (
    <Island className="atlas-skill-view" data-test="skill-view">
      <Header border>{skill.name}</Header>
      <Content>
        {skill.description && <Text data-test="description">{skill.description}</Text>}
        {properties.length > 0 && (
          <div className="atlas-properties" data-test="properties">
            {properties.map(([key, value]) => (
              <Tag key={key} readOnly>
                {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
              </Tag>
            ))}
          </div>
        )}
        <p>
          <Link href={skill.link} target="_blank" rel="noreferrer" data-test="link">
            {skill.path}
          </Link>
        </p>
        <div className="atlas-markdown" data-test="markdown" dangerouslySetInnerHTML={{ __html: html }} />
      </Content>
    </Island>
  );
}
