import { stripHtml } from "../lib/translate";

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export function JobDescription({ value }: { value: string }) {
  const blocks = parseDescription(value);

  if (!blocks.length) {
    return <p className="text-sm leading-7 text-ink/75">No description available yet.</p>;
  }

  return (
    <div className="space-y-5 text-sm leading-7 text-ink/75">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="pt-2 text-base font-bold text-ink">
              {block.text}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

function parseDescription(value: string): Block[] {
  const lines = stripHtml(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    if (isHeading(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line });
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function isHeading(line: string): boolean {
  const normalized = line.toLowerCase();
  const known = new Set([
    "aufgaben",
    "qualifikation",
    "qualifikationen",
    "benefits",
    "deine mission",
    "dein profil",
    "deine aufgaben",
    "responsibilities",
    "qualifications",
    "your mission",
    "your profile",
    "your responsibilities"
  ]);

  return known.has(normalized) || (line.length <= 70 && !/[.!?:;]$/.test(line) && /^[A-ZÄÖÜ]/.test(line));
}
