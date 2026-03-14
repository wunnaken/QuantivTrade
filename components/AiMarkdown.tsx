"use client";

import React from "react";

/**
 * Renders AI message content with basic markdown: bold, italic, code blocks, lists.
 * Outputs only React elements (no raw HTML) for safety.
 */
export function AiMarkdown({ content }: { content: string }) {
  const out: React.ReactNode[] = [];
  let key = 0;

  // Split by code blocks to preserve ```...```
  const segments = content.split(/(```\w*\n?[\s\S]*?```)/g);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith("```")) {
      const match = seg.match(/^```\w*\n?([\s\S]*?)```$/);
      const code = match ? match[1].trim() : seg.replace(/^```\w*\n?|```$/g, "").trim();
      out.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-sm"
        >
          <code>{code}</code>
        </pre>
      );
      continue;
    }
    // Non-code: split into lines and handle lists / paragraphs
    const lines = seg.split(/\n/);
    let j = 0;
    while (j < lines.length) {
      const line = lines[j];
      if (/^[\-\*]\s+/.test(line)) {
        const items: string[] = [];
        while (j < lines.length && /^[\-\*]\s+/.test(lines[j])) {
          items.push(lines[j].replace(/^[\-\*]\s+/, ""));
          j++;
        }
        out.push(
          <ul key={key++} className="my-1 list-disc pl-5 space-y-0.5">
            {items.map((item, idx) => (
              <li key={idx}>{formatInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (j < lines.length && /^\d+\.\s+/.test(lines[j])) {
          items.push(lines[j].replace(/^\d+\.\s+/, ""));
          j++;
        }
        out.push(
          <ol key={key++} className="my-1 list-decimal pl-5 space-y-0.5">
            {items.map((item, idx) => (
              <li key={idx}>{formatInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }
      if (line.trim() === "") {
        out.push(<br key={key++} />);
        j++;
        continue;
      }
      out.push(
        <span key={key++}>
          {formatInline(line)}
          {j < lines.length - 1 ? <br /> : null}
        </span>
      );
      j++;
    }
  }

  return <div className="whitespace-pre-wrap break-words">{out}</div>;
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastEnd) {
      parts.push(<React.Fragment key={k++}>{text.slice(lastEnd, match.index)}</React.Fragment>);
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={k++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={k++}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      parts.push(<code key={k++} className="rounded bg-white/10 px-1 py-0.5 text-sm">{match[3]}</code>);
    }
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < text.length) {
    parts.push(<React.Fragment key={k++}>{text.slice(lastEnd)}</React.Fragment>);
  }
  return parts.length ? <>{parts}</> : text;
}
