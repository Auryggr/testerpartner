function cleanText(value = "") {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectFormat(content = "") {
  const trimmed = content.trim();

  const looksLikeSrt =
    /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/m.test(
      trimmed
    );

  if (looksLikeSrt) {
    return "srt";
  }

  return "txt";
}

function parseLaxisSrt(content) {
  const blocks = content
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const utterances = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      continue;
    }

    const timeLine = lines[1];

    const timeMatch = timeLine.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})$/
    );

    if (!timeMatch) {
      continue;
    }

    const text = cleanText(
      lines.slice(2).join(" ")
    );

    if (!text) {
      continue;
    }

    utterances.push({
      start: timeMatch[1],
      end: timeMatch[2],
      timestamp:
        timeMatch[1]
          .replace(",", ".")
          .replace(/^00:/, ""),
      speaker: null,
      text
    });
  }

  return {
    source: "laxis",
    format: "srt",
    summary: {
      overview: null,
      actionItems: [],
      topics: []
    },
    utterances,
    plainText: utterances
      .map(item => item.text)
      .join("\n"),
    rawText: content
  };
}

function parseLaxisTxt(content) {
  const lines = content
    .replace(/\r/g, "")
    .split("\n");

  const result = {
    source: "laxis",
    format: "txt",
    summary: {
      overview: null,
      actionItems: [],
      topics: []
    },
    utterances: [],
    plainText: "",
    rawText: content
  };

  let section = null;
  let overviewLines = [];
  let topicLines = [];
  let actionItems = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const lower = line.toLowerCase();

    if (lower === "summary:") {
      section = "summary";
      continue;
    }

    if (lower === "overview") {
      section = "overview";
      continue;
    }

    if (lower === "action items") {
      section = "actionItems";
      continue;
    }

    if (lower === "topics") {
      section = "topics";
      continue;
    }

    const transcriptMatch = line.match(
      /^\((\d{2}:\d{2})\)\s+(.+)$/
    );

    if (transcriptMatch) {
      result.utterances.push({
        timestamp: transcriptMatch[1],
        speaker: null,
        text: cleanText(
          transcriptMatch[2]
        )
      });

      section = "transcript";
      continue;
    }

    if (section === "overview") {
      overviewLines.push(line);
      continue;
    }

    if (section === "actionItems") {
      const item = line.replace(
        /^[-•]\s*/,
        ""
      );

      if (item) {
        actionItems.push(item);
      }

      continue;
    }

    if (section === "topics") {
      topicLines.push(line);
      continue;
    }
  }

  result.summary.overview =
    overviewLines.length
      ? cleanText(
          overviewLines.join(" ")
        )
      : null;

  result.summary.actionItems =
    actionItems;

  result.summary.topics =
    topicLines;

  result.plainText =
    result.utterances
      .map(item => item.text)
      .join("\n");

  return result;
}

export function normalizeLaxisTranscript(
  content
) {
  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Transcript content is required."
    );
  }

  const format =
    detectFormat(content);

  if (format === "srt") {
    return parseLaxisSrt(
      content
    );
  }

  return parseLaxisTxt(
    content
  );
}