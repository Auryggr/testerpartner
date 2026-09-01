import {
  getPendingOpportunityBriefs
} from "../../lib/airtable.js";

const ALLOWED_ORIGIN =
  "https://app.laxis.tech";

const AUTO_MATCH_WINDOW_MINUTES = 60;
const REVIEW_WINDOW_MINUTES = 24 * 60;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN
        ? ALLOWED_ORIGIN
        : "null",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type"
  };
}

function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasNameMatch(brief, meeting) {
  const name =
    normalizeText(brief.name);

  const title =
    normalizeText(meeting.title);

  if (!name || !title) {
    return false;
  }

  return title.includes(name);
}

function getTimeDifferenceMinutes(
  brief,
  meeting
) {
  if (
    !brief.meetingTime ||
    !meeting.createdTime
  ) {
    return null;
  }

  const briefTime =
    new Date(brief.meetingTime).getTime();

  const meetingTime =
    new Date(meeting.createdTime).getTime();

  if (
    Number.isNaN(briefTime) ||
    Number.isNaN(meetingTime)
  ) {
    return null;
  }

  return Math.round(
    Math.abs(
      briefTime - meetingTime
    ) / 60000
  );
}

function evaluateCandidate(
  brief,
  meeting
) {
  const nameMatch =
    hasNameMatch(brief, meeting);

  const timeDifferenceMinutes =
    getTimeDifferenceMinutes(
      brief,
      meeting
    );

  const timeMatch =
    timeDifferenceMinutes !== null &&
    timeDifferenceMinutes <=
      AUTO_MATCH_WINDOW_MINUTES;

  let score = 0;

  if (nameMatch) {
    score += 100;
  }

  if (timeDifferenceMinutes !== null) {
    score += Math.max(
      0,
      REVIEW_WINDOW_MINUTES -
        timeDifferenceMinutes
    );
  }

  return {
    laxisId: meeting.id,
    title: meeting.title,
    createdTime:
      meeting.createdTime,
    noteUrl:
      meeting.noteUrl,
    nameMatch,
    timeMatch,
    timeDifferenceMinutes,
    score
  };
}

function evaluateBrief(
  brief,
  meetings
) {
  if (
    !brief.briefId ||
    !brief.meetingTime
  ) {
    return {
      briefId:
        brief.briefId || null,
      recordId:
        brief.recordId,
      status: "Pending",
      autoMatch: false,
      reason:
        "Brief does not have enough data for matching.",
      candidate: null
    };
  }

  const candidates =
    meetings
      .map(meeting =>
        evaluateCandidate(
          brief,
          meeting
        )
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );

  const candidate =
    candidates[0];

  if (!candidate) {
    return {
      briefId:
        brief.briefId,
      recordId:
        brief.recordId,
      status: "Pending",
      autoMatch: false,
      reason:
        "No transcribed Laxis meetings found.",
      candidate: null
    };
  }

  if (
    candidate.nameMatch &&
    candidate.timeMatch
  ) {
    return {
      briefId:
        brief.briefId,
      recordId:
        brief.recordId,
      status: "Discovered",
      autoMatch: true,
      reason:
        "Name and meeting time matched.",
      candidate
    };
  }

  const plausibleCandidate =
    candidate.nameMatch ||
    (
      candidate.timeDifferenceMinutes !==
        null &&
      candidate.timeDifferenceMinutes <=
        REVIEW_WINDOW_MINUTES
    );

  if (plausibleCandidate) {
    return {
      briefId:
        brief.briefId,
      recordId:
        brief.recordId,
      status: "Needs Review",
      autoMatch: false,
      reason:
        candidate.nameMatch
          ? "Name matched, but meeting time did not."
          : "Meeting time is close, but name did not match.",
      candidate
    };
  }

  return {
    briefId:
      brief.briefId,
    recordId:
      brief.recordId,
    status: "Pending",
    autoMatch: false,
    reason:
      "No plausible Laxis candidate found yet.",
    candidate: null
  };
}

export async function onRequestOptions(
  context
) {
  const origin =
    context.request.headers.get(
      "Origin"
    );

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin)
  });
}

export async function onRequestPost(
  context
) {
  const origin =
    context.request.headers.get(
      "Origin"
    );

  try {
    const body =
      await context.request.json();

    if (
      !Array.isArray(
        body.meetings
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "meetings must be an array."
        },
        {
          status: 400,
          headers:
            corsHeaders(origin)
        }
      );
    }

    const meetings =
      body.meetings
        .filter(
          meeting =>
            meeting.id &&
            meeting.createdTime
        )
        .map(meeting => ({
          id: meeting.id,
          title:
            meeting.title || "",
          createdTime:
            meeting.createdTime,
          noteUrl:
            meeting.noteUrl ||
            `https://app.laxis.tech/notes/${meeting.id}`
        }));

    const pendingBriefs =
      await getPendingOpportunityBriefs(
        context.env
      );

    const evaluations =
      pendingBriefs.map(brief =>
        evaluateBrief(
          brief,
          meetings
        )
      );

    console.log(
      "[Laxis Discovery]",
      {
        meetings,
        pendingBriefs,
        evaluations
      }
    );

    return Response.json(
      {
        success: true,
        received:
          meetings.length,
        pendingBriefs:
          pendingBriefs.length,
        evaluations
      },
      {
        status: 200,
        headers:
          corsHeaders(origin)
      }
    );
  } catch (error) {
    console.error(
      "Laxis discovery error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to process Laxis discovery."
      },
      {
        status: 500,
        headers:
          corsHeaders(origin)
      }
    );
  }
}