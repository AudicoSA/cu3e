"use client";

// Renders Echo's replies: Markdown (bold, numbered steps, lists, tables) and
// maths via KaTeX. Before this, replies were dumped as plain text, so
// "**bold**" showed literal asterisks, line breaks collapsed into one blob,
// and fractions/equations were unreadable — a big deal for Maths + Science.
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Models sometimes use \( … \) and \[ … \] instead of $ … $ / $$ … $$.
function normaliseMath(src: string): string {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$${m}$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`);
}

function ChatMarkdownImpl({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={{
          // Links from the model open in a new tab and never navigate the app.
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Never load remote images the model might write.
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              <a href={src} target="_blank" rel="noopener noreferrer">{alt || "image"}</a>
            ) : null,
          // Keep headings small — this is a chat bubble, not a document.
          h1: ({ children }) => <p className="chat-md-h">{children}</p>,
          h2: ({ children }) => <p className="chat-md-h">{children}</p>,
          h3: ({ children }) => <p className="chat-md-h">{children}</p>,
          h4: ({ children }) => <p className="chat-md-h">{children}</p>,
        }}
      >
        {normaliseMath(text)}
      </ReactMarkdown>
      <style>{`
        .chat-md { font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
        .chat-md > :first-child { margin-top: 0; }
        .chat-md > :last-child { margin-bottom: 0; }
        .chat-md p { margin: 0 0 0.6em; }
        .chat-md ul, .chat-md ol { margin: 0.2em 0 0.7em; padding-left: 1.4em; }
        .chat-md ol { list-style: decimal; }
        .chat-md ul { list-style: disc; }
        .chat-md li::marker { color: var(--ink-muted); }
        .chat-md li { margin: 0.25em 0; }
        .chat-md li > p { margin: 0; }
        .chat-md strong { color: var(--ink); font-weight: 650; }
        .chat-md .chat-md-h { font-weight: 650; color: var(--ink); margin: 0.6em 0 0.3em; }
        .chat-md code { font-family: var(--font-mono); font-size: 0.9em; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 5px; }
        .chat-md pre { background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 10px; overflow-x: auto; }
        .chat-md pre code { background: none; padding: 0; }
        .chat-md table { border-collapse: collapse; margin: 0.4em 0 0.8em; font-size: 14px; display: block; overflow-x: auto; }
        .chat-md th, .chat-md td { border: 1px solid var(--border-strong); padding: 5px 9px; text-align: left; }
        .chat-md th { background: rgba(255,255,255,0.04); }
        .chat-md blockquote { margin: 0.4em 0; padding-left: 10px; border-left: 3px solid var(--border-strong); color: var(--ink-soft); }
        .chat-md a { color: var(--cyan); text-decoration: underline; }
        .chat-md .katex { font-size: 1.08em; }
        .chat-md .katex-display { margin: 0.5em 0; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
      `}</style>
    </div>
  );
}

// Memoised so streaming updates only re-render the bubble that changed.
const ChatMarkdown = memo(ChatMarkdownImpl);
export default ChatMarkdown;
