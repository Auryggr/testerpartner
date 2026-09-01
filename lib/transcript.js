function normalizeLineBreaks(
  value = ""
) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function isSrtTimestamp(
  value = ""
) {
  return /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}$/.test(
    value.trim()
  );
}

function cleanSrtText(
  text = ""
) {
  const lines =
    normalizeLineBreaks(
      text
    ).split("\n");

  const cleaned = [];

  for (const line of lines) {
    const trimmed =
      line.trim();

    if (!trimmed) {
      continue;
    }

    if (
      /^\d+$/.test(trimmed)
    ) {
      continue;
    }

    if (
      isSrtTimestamp(trimmed)
    ) {
      continue;
    }

    cleaned.push(trimmed);
  }

  return cleaned.join("\n");
}

function detectFormat(
  text = ""
) {
  const normalized =
    normalizeLineBreaks(
      text
    );

  if (
    normalized.includes("-->") &&
    /\d{2}:\d{2}:\d{2},\d{3}/.test(
      normalized
    )
  ) {
    return "srt";
  }

  return "txt";
}

function extractSection(
  text,
  headings
) {
  const normalized =
    normalizeLineBreaks(
      text
    );

  const lines =
    normalized.split("\n");

  const normalizedHeadings =
    headings.map(
      heading =>
        heading.toLowerCase()
    );

  let startIndex = -1;

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index]
        .trim()
        .toLowerCase();

    if (
      normalizedHeadings.some(
        heading =>
          line === heading ||
          line.startsWith(
            `${heading}:`
          )
      )
    ) {
      startIndex = index;
      break;
    }
  }

  if (startIndex === -1) {
    return "";
  }

  const collected = [];

  for (
    let index =
      startIndex + 1;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index].trim();

    if (!line) {
      if (collected.length) {
        break;
      }

      continue;
    }

    const lower =
      line.toLowerCase();

    const looksLikeHeading =
      /^(summary|overview|action items?|topics?|transcript|key points?|next steps?):?\s*$/.test(
        lower
      );

    if (
      looksLikeHeading &&
      collected.length
    ) {
      break;
    }

    collected.push(line);
  }

  return collected.join("\n");
}

function extractTimestampedUtterances(
  text = ""
) {
  const normalized =
    normalizeLineBreaks(
      text
    );

  const lines =
    normalized.split("\n");

  const utterances = [];

  const timestampPattern =
    /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/;

  for (const line of lines) {
    const trimmed =
      line.trim();

    if (!trimmed) {
      continue;
    }

    const match =
      trimmed.match(
        timestampPattern
      );

    if (!match) {
      continue;
    }

    const timestamp =
      match[1];

    const transcript =
      match[2].trim();

    if (!transcript) {
      continue;
    }

    utterances.push({
      timestamp,
      transcript
    });
  }

  return utterances;
}

export function normalizeLaxisTranscript(
  rawText,
  source = "Laxis"
) {
  if (
    typeof rawText !==
      "string" ||
    !rawText.trim()
  ) {
    throw new Error(
      "Transcript text is required."
    );
  }

  const format =
    detectFormat(rawText);

  const normalized =
    normalizeLineBreaks(
      rawText
    );

  const plainText =
    format === "srt"
      ? cleanSrtText(
          normalized
        )
      : normalized.trim();

  const summary =
    extractSection(
      plainText,
      [
        "summary",
        "meeting summary"
      ]
    );

  const overview =
    extractSection(
      plainText,
      [
        "overview",
        "meeting overview"
      ]
    );

  const actionItems =
    extractSection(
      plainText,
      [
        "action items",
        "action item",
        "next steps"
      ]
    );

  const topics =
    extractSection(
      plainText,
      [
        "topics",
        "key topics"
      ]
    );

  const utterances =
    extractTimestampedUtterances(
      plainText
    );

  return {
    source,
    format,
    summary,
    overview,
    actionItems,
    topics,
    utterances,
    plainText,
    rawText:
      normalized
  };
}

export async function fetchLaxisTranscript(
  noteId
) {
  if (!noteId) {
    throw new Error(
      "Laxis Note ID is required."
    );
  }

  const url =
    `https://app.laxis.tech/api/v1/public-access/speeches/${noteId}`;

  const response =
    await fetch(url);

  const responseText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    throw new Error(
      "Laxis returned an invalid JSON response."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Laxis returned HTTP ${response.status}`
    );
  }

  const formattedTranscripts =
    data?.formattedTranscripts ||
    data?.speech
      ?.formattedTranscripts ||
    [];

  if (
    Array.isArray(
      formattedTranscripts
    ) &&
    formattedTranscripts.length
  ) {
    const transcript =
      formattedTranscripts
        .map(item => {
          const speaker =
            item.speakerTag ||
            item.speakerId ||
            "";

          const text =
            item.transcript ||
            item.translatedTranscript ||
            "";

          if (!text) {
            return "";
          }

          return speaker
            ? `${speaker}: ${text}`
            : text;
        })
        .filter(Boolean)
        .join("\n\n");

    if (!transcript) {
      throw new Error(
        `No transcript found for Laxis note ${noteId}.`
      );
    }

    return {
      noteId,
      transcript,
      raw: data
    };
  }

  const transcript =
    data?.transcript ||
    data?.speech?.transcript ||
    "";

  if (!transcript) {
    throw new Error(
      `No transcript found for Laxis note ${noteId}.`
    );
  }

  return {
    noteId,
    transcript:
      typeof transcript ===
      "string"
        ? transcript
        : JSON.stringify(
            transcript
          ),
    raw: data
  };
}