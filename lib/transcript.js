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

function formatSeconds(
  value
) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return "";
  }

  const totalSeconds =
    Math.max(
      0,
      Math.floor(value)
    );

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    totalSeconds % 60;

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function buildTranscriptFromFormatted(
  items
) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    return "";
  }

  return items
    .map(item => {
      const text =
        item?.transcript ||
        item?.translatedTranscript ||
        "";

      if (!text.trim()) {
        return "";
      }

      const start =
        formatSeconds(
          item?.startTime
        );

      const end =
        formatSeconds(
          item?.endTime
        );

      const speaker =
        item?.speakerId ||
        item?.speakerTag;

      const speakerLabel =
        speaker !== null &&
        speaker !== undefined &&
        speaker !== ""
          ? `Speaker ${speaker}`
          : "";

      const timeLabel =
        start && end
          ? `[${start} - ${end}]`
          : "";

      const prefix =
        [
          timeLabel,
          speakerLabel
        ]
          .filter(Boolean)
          .join(" ");

      return prefix
        ? `${prefix}\n${text.trim()}`
        : text.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildTranscriptFromRawResults(
  transcripts
) {
  if (
    !Array.isArray(transcripts) ||
    !transcripts.length
  ) {
    return "";
  }

  return transcripts
    .map(item => {
      const alternative =
        item?.alternatives?.[0];

      return (
        alternative?.transcript ||
        ""
      ).trim();
    })
    .filter(Boolean)
    .join(" ");
}

function buildTranscriptFromParagraphs(
  paragraphs
) {
  if (
    !Array.isArray(paragraphs) ||
    !paragraphs.length
  ) {
    return "";
  }

  return paragraphs
    .map(item =>
      (
        item?.transcript ||
        ""
      ).trim()
    )
    .filter(Boolean)
    .join("\n\n");
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

  const speech =
    data?.speech ||
    data;

  const formattedTranscripts =
    speech?.formattedTranscripts ||
    [];

  const transcripts =
    speech?.transcripts ||
    [];

  const paragraphs =
    speech?.paragraphs ||
    [];

  let transcript =
    buildTranscriptFromFormatted(
      formattedTranscripts
    );

  if (!transcript) {
    transcript =
      buildTranscriptFromRawResults(
        transcripts
      );
  }

  if (!transcript) {
    transcript =
      buildTranscriptFromParagraphs(
        paragraphs
      );
  }

  if (!transcript) {
    const plainTranscript =
      speech?.transcript;

    if (
      typeof plainTranscript ===
        "string"
    ) {
      transcript =
        plainTranscript.trim();
    }
  }

  if (!transcript) {
    throw new Error(
      `No transcript found for Laxis note ${noteId}.`
    );
  }

  return {
    noteId,
    title:
      speech?.title || "",
    status:
      speech?.status || "",
    duration:
      speech?.duration || null,
    createdTime:
      speech?.createdTime || null,
    lastModifiedTime:
      speech?.lastModifiedTime ||
      null,
    transcript,
    raw: data
  };
}