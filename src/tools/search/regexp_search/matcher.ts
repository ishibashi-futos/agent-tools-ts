import type { RegexpSearchItem } from "./types";

const normalizeContent = (content: string): string => {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
};

const toGlobalFlags = (flags: string): string => {
  return flags.includes("g") ? flags : `${flags}g`;
};

export const collectRegexpMatches = (
  path: string,
  pattern: string,
  flags: string,
  content: string,
): RegexpSearchItem[] => {
  const regex = new RegExp(pattern, toGlobalFlags(flags));
  const normalizedContent = normalizeContent(content);
  const lines = normalizedContent.split("\n");
  const items: RegexpSearchItem[] = [];

  for (const [index, lineText] of lines.entries()) {
    regex.lastIndex = 0;

    let match = regex.exec(lineText);
    while (match !== null) {
      items.push({
        path,
        line: index + 1,
        column: match.index + 1,
        match: match[0] ?? "",
        line_text: lineText,
      });

      if (match[0] === "") {
        regex.lastIndex += 1;
      }

      match = regex.exec(lineText);
    }
  }

  return items;
};
