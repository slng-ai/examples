"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

type CodeBlockProps = {
  code: string;
  language: string;
  title?: string;
  wide?: boolean;
};

export function CodeBlock({ code, language, title, wide }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`overflow-hidden rounded-md border border-border bg-secondary p-3 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        {title && (
          <h3 className="m-0 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        )}
        <button
          type="button"
          className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="m-0 overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed"
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
