"use client";
import { useMemo } from "react";
import DOMPurify from "dompurify";

// Card text can come from imported decks, so it is always cleaned before it is shown.
const ALLOWED = { ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "br", "div", "p", "span", "ul", "ol", "li", "hr", "sub", "sup", "code", "pre", "table", "tr", "td", "th", "tbody", "thead", "font"], ALLOWED_ATTR: ["class", "color"] };

export default function CardHtml({ html, className = "", testId }: { html: string; className?: string; testId?: string }) {
  const clean = useMemo(() => (typeof window === "undefined" ? "" : DOMPurify.sanitize(html, ALLOWED)), [html]);
  return <div data-testid={testId} className={`card-html ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
