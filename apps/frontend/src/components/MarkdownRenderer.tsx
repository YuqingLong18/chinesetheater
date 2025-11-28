import { useMemo } from 'react';
import clsx from 'clsx';

type InlineNode = string | { type: 'strong' | 'em' | 'code' | 'del'; content: InlineNode[] };

type BlockNode =
  | { type: 'paragraph'; content: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'heading'; level: number; content: InlineNode[] }
  | { type: 'code'; content: string }
  | { type: 'blockquote'; content: InlineNode[] }
  | { type: 'hr' };

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`|~~[^~]+~~)/;

const parseInline = (text: string): InlineNode[] => {
  const result: InlineNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const match = remaining.match(inlinePattern);
    if (!match || match.index === undefined) {
      result.push(remaining);
      break;
    }

    const [token] = match;
    const index = match.index;
    if (index > 0) {
      result.push(remaining.slice(0, index));
    }

    const inner = token.slice(2, -2);
    if (token.startsWith('**') || token.startsWith('__')) {
      result.push({ type: 'strong', content: parseInline(inner) });
    } else if (token.startsWith('~~')) {
      result.push({ type: 'del', content: parseInline(inner) });
    } else if (token.startsWith('*') || token.startsWith('_')) {
      const singleInner = token.slice(1, -1);
      result.push({ type: 'em', content: parseInline(singleInner) });
    } else if (token.startsWith('`')) {
      result.push({ type: 'code', content: [token.slice(1, -1)] });
    }

    remaining = remaining.slice(index + token.length);
  }

  return result;
};

const parseMarkdown = (markdown: string): BlockNode[] => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;
  let inCode = false;
  let codeBuffer: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', content: codeBuffer.join('\n') });
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      i += 1;
      continue;
    }

    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({ type: 'heading', level, content: parseInline(headingMatch[2]) });
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].startsWith('>')) {
        quoteLines.push(lines[j].replace(/^>\s?/, ''));
        j += 1;
      }
      blocks.push({ type: 'blockquote', content: parseInline(quoteLines.join('\n')) });
      i = j;
      continue;
    }

    if (/^\d+\.\s+/.test(line) || /^[-*+]\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: InlineNode[][] = [];
      let j = i;
      while (j < lines.length && (/^\d+\.\s+/.test(lines[j]) || /^[-*+]\s+/.test(lines[j]))) {
        const itemText = lines[j].replace(/^\d+\.\s+|^[-*+]\s+/, '');
        items.push(parseInline(itemText));
        j += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      i = j;
      continue;
    }

    const paragraphLines: string[] = [];
    let j = i;
    while (j < lines.length && !/^\s*$/.test(lines[j]) && !/^```/.test(lines[j]) && !/^[-*+]\s+/.test(lines[j]) && !/^\d+\.\s+/.test(lines[j])) {
      paragraphLines.push(lines[j]);
      j += 1;
    }
    blocks.push({ type: 'paragraph', content: parseInline(paragraphLines.join(' ')) });
    i = j;
  }

  if (codeBuffer.length > 0) {
    blocks.push({ type: 'code', content: codeBuffer.join('\n') });
  }

  return blocks;
};

const renderInline = (nodes: InlineNode[], keyPrefix: string) =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (typeof node === 'string') {
      return <span key={key}>{node}</span>;
    }
    const children = renderInline(node.content, `${keyPrefix}-${index}`);
    if (node.type === 'strong') {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {children}
        </strong>
      );
    }
    if (node.type === 'em') {
      return (
        <em key={key} className="text-gray-700">
          {children}
        </em>
      );
    }
    if (node.type === 'del') {
      return (
        <del key={key} className="text-gray-500">
          {children}
        </del>
      );
    }
    if (node.type === 'code') {
      return (
        <code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-xs text-lavender-600">
          {children}
        </code>
      );
    }
    return <span key={key}>{children}</span>;
  });

const MarkdownRenderer = ({ content, className }: { content: string; className?: string }) => {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={clsx('space-y-3 text-sm leading-relaxed text-gray-800', className)}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={key} className="whitespace-pre-wrap">
                {renderInline(block.content, key)}
              </p>
            );
          case 'list':
            if (block.ordered) {
              return (
                <ol key={key} className="list-decimal space-y-1 pl-5">
                  {block.items.map((item, itemIndex) => (
                    <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={key} className="list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'heading':
            if (block.level === 1) {
              return (
                <h1 key={key} className="text-lg font-semibold text-gray-900">
                  {renderInline(block.content, key)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={key} className="text-base font-semibold text-gray-900">
                  {renderInline(block.content, key)}
                </h2>
              );
            }
            return (
              <h3 key={key} className="text-sm font-semibold text-gray-900">
                {renderInline(block.content, key)}
              </h3>
            );
          case 'code':
            return (
              <pre key={key} className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                <code>{block.content}</code>
              </pre>
            );
          case 'blockquote':
            return (
              <blockquote key={key} className="border-l-4 border-lavender-200 bg-lavender-50 px-4 py-2 text-gray-700">
                {renderInline(block.content, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="border-t border-dashed border-gray-200" />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;
