"use dom";
// Card text is HTML (bold, lists, cloze highlights, imported decks), so it is
// shown in a small web view with the website's own sanitizing CardHtml component.
import CardHtml from "@/components/flashcards/CardHtml";

const CSS = `
  html, body { height: 100%; margin: 0; background: transparent; color: #eeeef0; font: 20px/1.45 -apple-system, system-ui, Roboto, sans-serif; text-align: center; -webkit-text-size-adjust: 100%; }
  .wrap { width: 100vw; min-height: 100vh; box-sizing: border-box; padding: 24px; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .wrap > div { width: 100%; }
  .card-html { overflow-wrap: anywhere; }
  .card-html img { max-width: 100%; height: auto; }
  .card-html ul, .card-html ol { text-align: left; padding-left: 1.25rem; }
  hr { border: 0; border-top: 1px solid #292b30; margin: 18px 0; }
  .cloze-blank, .cloze-answer { color: #5ed8a9; font-weight: 700; }
  code, pre { font-size: 16px; }
`;

export default function CardFace({ front, back, onTap }: { front: string; back?: string; onTap?: () => Promise<void>; dom?: import("expo/dom").DOMProps }) {
  return (
    <div className="wrap" onClick={() => onTap?.()}>
      <style>{CSS}</style>
      <CardHtml html={front} testId="review-front" />
      {back !== undefined && (<><hr /><CardHtml html={back} testId="review-back" /></>)}
    </div>
  );
}
