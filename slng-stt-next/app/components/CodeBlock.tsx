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
    <div className={`code-card ${wide ? "wide" : ""}`}>
      <div className="code-card-header">
        {title && <h3>{title}</h3>}
        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={{ ...style, margin: 0, padding: "12px", borderRadius: "var(--radius)", fontSize: "0.75rem", lineHeight: 1.5, overflowX: "auto" }}>
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
