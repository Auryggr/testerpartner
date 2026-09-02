import {
  getPendingOpportunityBriefs,
  getAssignedLaxisMeetings,
  updateOpportunityBriefByRecordId
} from "../../lib/airtable.js";

import {
  fetchLaxisTranscript
} from "../../lib/transcript.js";

const AUTO_MATCH_WINDOW_MINUTES =
  60;

const REVIEW_WINDOW_MINUTES =
  24 * 60;

const MEETING_DURATION_MINUTES =
  30;

const PROVISIONAL_GRACE_MINUTES =
  20;

function normalizeName(
  value = ""
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function minutesBetween(
  first,
  second
) {
  const firstDate =
    new Date(first);

  const secondDate =
    new Date(second);

  if (
    Number.isNaN(
      firstDate.getTime()
    ) ||
    Number.isNaN(
      secondDate.getTime()
    )
  ) {
    return Infinity;
  }

  return Math.abs(
    firstDate.getTime() -
      secondDate.getTime()
  ) / 60000;
}

function parseLaxisMeetingDateFromTitle(
  title = ""
) {
  const match =
    title.match(
      /^Meeting_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/i
    );

  if (!match) {
    return null;
  }

  return {
    year:
      Number(match[1]),
    month:
      Number(match[2]),
    day:
      Number(match[3]),
    hour:
      Number(match[4]),
    minute:
      Number(match[5])
  };
}

function getLocalMeetingParts(
  meetingTime
) {
  const date =
    new Date(meetingTime);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Argentina/Buenos_Aires",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const map = {};

  for (const part of parts) {
    map[part.type] =
      part.value;
  }

  return {
    year:
      Number(map.year),
    month:
      Number(map.month),
    day:
      Number(map.day),
    hour:
      Number(map.hour),
    minute:
      Number(map.minute)
  };
}

function compareMeetingTitleTime(
  title,
  meetingTime
) {
  const titleParts =
    parseLaxisMeetingDateFromTitle(
      title
    );

  const meetingParts =
    getLocalMeetingParts(
      meetingTime
    );

  if (
    !titleParts ||
    !meetingParts
  ) {
    return {
      matchesDate: false,
      differenceMinutes:
        Infinity
    };
  }

  const matchesDate =
    titleParts.year ===
      meetingParts.year &&
    titleParts.month ===
      meetingParts.month &&
    titleParts.day ===
      meetingParts.day;

  if (!matchesDate) {
    return {
      matchesDate: false,
      differenceMinutes:
        Infinity
    };
  }

  const titleMinutes =
    titleParts.hour * 60 +
    titleParts.minute;

  const meetingMinutes =
    meetingParts.hour * 60 +
    meetingParts.minute;

  return {
    matchesDate: true,
    differenceMinutes:
      Math.abs(
        titleMinutes -
          meetingMinutes
      )
  };
}

function isGenericMeetingTitle(
  title = ""
) {
  return Boolean(
    parseLaxisMeetingDateFromTitle(
      title
    )
  );
}

function isCanonicalTitleMatch(
  brief,
  meeting
) {
  const briefName =
    normalizeName(
      brief.name
    );

  const title =
    normalizeName(
      meeting.title
    );

  if (
    !briefName ||
    !title
  ) {
    return false;
  }

  return (
    title.includes(
      "testerpartner"
    ) &&
    title.includes(
      briefName
    )
  );
}

function getExpectedFallbackTime(
  meetingTime
) {
  const start =
    new Date(meetingTime);

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    start.getTime() +
      (
        MEETING_DURATION_MINUTES +
        PROVISIONAL_GRACE_MINUTES
      ) *
        60000
  );
}

function provisionalGraceExpired(
  meetingTime
) {
  const fallbackTime =
    getExpectedFallbackTime(
      meetingTime
    );

  if (!fallbackTime) {
    return false;
  }

  return (
    Date.now() >=
    fallbackTime.getTime()
  );
}

function evaluateMeeting(
  brief,
  meeting
) {
  const canonicalNameMatch =
    isCanonicalTitleMatch(
      brief,
      meeting
    );

  const createdDifference =
    minutesBetween(
      brief.meetingTime,
      meeting.createdTime
    );

  const titleTime =
    compareMeetingTitleTime(
      meeting.title,
      brief.meetingTime
    );

  const genericTitle =
    isGenericMeetingTitle(
      meeting.title
    );

  let score = 0;

  if (canonicalNameMatch) {
    score += 100;
  }

  if (
    createdDifference <=
    AUTO_MATCH_WINDOW_MINUTES
  ) {
    score += 40;
  }

  if (
    titleTime.matchesDate &&
    titleTime.differenceMinutes <=
      AUTO_MATCH_WINDOW_MINUTES
  ) {
    score += 60;
  }

  if (
    meeting.status ===
    "transcribed"
  ) {
    score += 20;
  }

  if (
    Number(meeting.duration) >
    60
  ) {
    score += 10;
  }

  let status =
    "Pending";

  let reason =
    "No reliable Laxis match found.";

  let autoMatch =
    false;

  if (
    canonicalNameMatch &&
    createdDifference <=
      AUTO_MATCH_WINDOW_MINUTES
  ) {
    status =
      "Discovered";

    autoMatch =
      true;

    reason =
      "Canonical meeting title matched the Brief name and meeting time.";
  } else if (
    genericTitle &&
    titleTime.matchesDate &&
    titleTime.differenceMinutes <=
      AUTO_MATCH_WINDOW_MINUTES
  ) {
    if (
      provisionalGraceExpired(
        brief.meetingTime
      )
    ) {
      status =
        "Discovered";

      autoMatch =
        true;

      reason =
        "Generic Laxis meeting matched the scheduled date/time and the provisional grace period expired.";
    } else {
      status =
        "Needs Review";

      reason =
        "Generic Laxis meeting matched the scheduled date/time but is still inside the provisional grace period.";
    }
  } else if (
    canonicalNameMatch
  ) {
    status =
      "Needs Review";

    reason =
      "Meeting name matched, but the time was outside the automatic match window.";
  } else if (
    createdDifference <=
      REVIEW_WINDOW_MINUTES
  ) {
    status =
      "Needs Review";

    reason =
      "Meeting time is close, but the name did not match.";
  }

  return {
    brief,
    meeting,
    status,
    reason,
    autoMatch,
    score,
    canonicalNameMatch,
    genericTitle,
    createdDifference,
    titleTimeDifference:
      titleTime.differenceMinutes
  };
}

function compareEvaluations(
  first,
  second
) {
  const statusPriority = {
    Discovered: 3,
    "Needs Review": 2,
    Pending: 1
  };

  const firstPriority =
    statusPriority[
      first.status
    ] || 0;

  const secondPriority =
    statusPriority[
      second.status
    ] || 0;

  if (
    firstPriority !==
    secondPriority
  ) {
    return (
      secondPriority -
      firstPriority
    );
  }

  if (
    first.canonicalNameMatch !==
    second.canonicalNameMatch
  ) {
    return first
      .canonicalNameMatch
      ? -1
      : 1;
  }

  if (
    first.genericTitle !==
    second.genericTitle
  ) {
    return first.genericTitle
      ? 1
      : -1;
  }

  const firstTime =
    Math.min(
      first.createdDifference,
      first.titleTimeDifference
    );

  const secondTime =
    Math.min(
      second.createdDifference,
      second.titleTimeDifference
    );

  if (
    firstTime !==
    secondTime
  ) {
    return (
      firstTime -
      secondTime
    );
  }

  return (
    second.score -
    first.score
  );
}

function chooseBestEvaluation(
  evaluations
) {
  if (
    !evaluations.length
  ) {
    return null;
  }

  return [
    ...evaluations
  ].sort(
    compareEvaluations
  )[0];
}

function resolveDuplicateMeetings(
  evaluations
) {
  const grouped =
    new Map();

  for (
    const evaluation
    of evaluations
  ) {
    if (
      !evaluation.meeting?.id
    ) {
      continue;
    }

    const meetingId =
      evaluation.meeting.id;

    if (
      !grouped.has(
        meetingId
      )
    ) {
      grouped.set(
        meetingId,
        []
      );
    }

    grouped
      .get(meetingId)
      .push(
        evaluation
      );
  }

  for (
    const group
    of grouped.values()
  ) {
    if (
      group.length <= 1
    ) {
      continue;
    }

    const sorted =
      [
        ...group
      ].sort(
        compareEvaluations
      );

    const winner =
      sorted[0];

    for (
      const loser
      of sorted.slice(1)
    ) {
      loser.status =
        "Pending";

      loser.autoMatch =
        false;

      loser.reason =
        `Meeting already assigned to ${winner.brief.briefId}.`;
    }
  }

  return evaluations;
}

async function tryAttachTranscript(
  env,
  brief,
  noteId
) {
  if (!noteId) {
    return {
      success: false,
      reason:
        "No Laxis Note ID available."
    };
  }

  try {
    const result =
      await fetchLaxisTranscript(
        noteId
      );

    await updateOpportunityBriefByRecordId(
      env,
      brief.recordId,
      {
        Transcript:
          result.transcript,
        "Transcript Source":
          "Laxis",
        "Transcript Status":
          "Ready"
      }
    );

    return {
      success: true,
      noteId,
      transcriptLength:
        result.transcript.length
    };
  } catch (error) {
    return {
      success: false,
      noteId,
      reason:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

export async function onRequestPost(
  context
) {
  try {
    const {
      request,
      env
    } = context;

    const body =
      await request.json();

    const meetings =
      Array.isArray(
        body?.meetings
      )
        ? body.meetings
        : [];

    const pendingBriefs =
      await getPendingOpportunityBriefs(
        env
      );

    const assigned =
      await getAssignedLaxisMeetings(
        env
      );

    const assignedIds =
      new Set(
        assigned.map(
          item =>
            item.laxisNoteId
        )
      );

    const availableMeetings =
      meetings.filter(
        meeting =>
          meeting?.id &&
          !assignedIds.has(
            meeting.id
          )
      );

    const allEvaluations =
      [];

    for (
      const brief
      of pendingBriefs
    ) {
      if (
        brief.transcriptStatus ===
          "Discovered" &&
        brief.laxisNoteId
      ) {
        allEvaluations.push({
          brief,
          meeting: {
            id:
              brief.laxisNoteId,
            noteUrl:
              brief.laxisUrl
          },
          status:
            "Discovered",
          reason:
            "Brief already has a definitive Laxis meeting assigned.",
          autoMatch: true,
          score: 999,
          canonicalNameMatch:
            true,
          genericTitle:
            false,
          createdDifference:
            0,
          titleTimeDifference:
            0,
          alreadyAssigned:
            true
        });

        continue;
      }

      const evaluations =
        availableMeetings.map(
          meeting =>
            evaluateMeeting(
              brief,
              meeting
            )
        );

      const best =
        chooseBestEvaluation(
          evaluations
        );

      if (best) {
        allEvaluations.push(
          best
        );
      } else {
        allEvaluations.push({
          brief,
          meeting: null,
          status:
            "Pending",
          reason:
            "No available Laxis meetings.",
          autoMatch:
            false,
          score: 0,
          canonicalNameMatch:
            false,
          genericTitle:
            false,
          createdDifference:
            Infinity,
          titleTimeDifference:
            Infinity
        });
      }
    }

    resolveDuplicateMeetings(
      allEvaluations.filter(
        item =>
          item.meeting?.id &&
          !item.alreadyAssigned
      )
    );

    const updates = [];

    for (
      const evaluation
      of allEvaluations
    ) {
      const {
        brief,
        meeting,
        status,
        reason,
        alreadyAssigned
      } = evaluation;

      if (
        alreadyAssigned &&
        brief.laxisNoteId
      ) {
        const transcriptResult =
          await tryAttachTranscript(
            env,
            brief,
            brief.laxisNoteId
          );

        updates.push({
          briefId:
            brief.briefId,
          status:
            transcriptResult.success
              ? "Ready"
              : "Discovered",
          laxisNoteId:
            brief.laxisNoteId,
          transcript:
            transcriptResult
        });

        continue;
      }

      if (
        status ===
          "Discovered" &&
        meeting?.id
      ) {
        await updateOpportunityBriefByRecordId(
          env,
          brief.recordId,
          {
            "Transcript Status":
              "Discovered",
            "Transcript Source":
              "Laxis",
            "Laxis Note ID":
              meeting.id,
            "Laxis URL":
              meeting.noteUrl ||
              `https://app.laxis.tech/notes/${meeting.id}`,
            "Candidate Laxis Note ID":
              "",
            "Candidate Laxis URL":
              "",
            "Candidate Laxis Title":
              "",
            "Match Reason":
              reason
          }
        );

        const transcriptResult =
          await tryAttachTranscript(
            env,
            brief,
            meeting.id
          );

        updates.push({
          briefId:
            brief.briefId,
          status:
            transcriptResult.success
              ? "Ready"
              : "Discovered",
          laxisNoteId:
            meeting.id,
          reason,
          transcript:
            transcriptResult
        });

        continue;
      }

      if (
        status ===
          "Needs Review" &&
        meeting?.id
      ) {
        await updateOpportunityBriefByRecordId(
          env,
          brief.recordId,
          {
            "Transcript Status":
              "Needs Review",
            "Transcript Source":
              null,
            "Candidate Laxis Note ID":
              meeting.id,
            "Candidate Laxis URL":
              meeting.noteUrl ||
              `https://app.laxis.tech/notes/${meeting.id}`,
            "Candidate Laxis Title":
              meeting.title ||
              "",
            "Match Reason":
              reason
          }
        );

        updates.push({
          briefId:
            brief.briefId,
          status:
            "Needs Review",
          candidateLaxisNoteId:
            meeting.id,
          reason
        });

        continue;
      }

      await updateOpportunityBriefByRecordId(
        env,
        brief.recordId,
        {
          "Transcript Status":
            "Pending",
          "Candidate Laxis Note ID":
            "",
          "Candidate Laxis URL":
            "",
          "Candidate Laxis Title":
            "",
          "Match Reason":
            reason
        }
      );

      updates.push({
        briefId:
          brief.briefId,
        status:
          "Pending",
        reason
      });
    }

    return Response.json({
      success: true,
      received:
        meetings.length,
      availableMeetings:
        availableMeetings.length,
      pendingBriefs:
        pendingBriefs.length,
      evaluations:
        allEvaluations.map(
          item => ({
            briefId:
              item.brief
                ?.briefId,
            meetingId:
              item.meeting
                ?.id || null,
            meetingTitle:
              item.meeting
                ?.title ||
              null,
            status:
              item.status,
            reason:
              item.reason,
            score:
              item.score
          })
        ),
      updates
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      {
        status: 500
      }
    );
  }
}