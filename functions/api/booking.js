import {
  createCalendarEvent,
  deleteCalendarEvent,
  getBusyPeriods
} from "../../lib/google-calendar.js";

import {
  createOpportunityBrief
} from "../../lib/airtable.js";

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function localSlotToDate(dateString, timeString) {
  return new Date(`${dateString}T${timeString}:00-03:00`);
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

async function assertSlotStillAvailable(env, start, end) {
  const bufferMinutes = Number(env.BUFFER_MINUTES || 15);

  const bufferedStart = addMinutes(start, -bufferMinutes);
  const bufferedEnd = addMinutes(end, bufferMinutes);

  const busy = await getBusyPeriods(
    env,
    bufferedStart.toISOString(),
    bufferedEnd.toISOString()
  );

  const conflict = busy.some((period) => {
    const busyStart = new Date(period.start);
    const busyEnd = new Date(period.end);

    return overlaps(
      bufferedStart,
      bufferedEnd,
      busyStart,
      busyEnd
    );
  });

  if (conflict) {
    const error = new Error(
      "That time is no longer available. Please choose another slot."
    );
    error.status = 409;
    throw error;
  }
}

export async function onRequestPost(context) {
  let calendarEvent = null;

  try {
    const body = await context.request.json();

    const {
      conversation,
      difficulty,
      outcome,
      future,
      meetingDay,
      meetingTime,
      name = "",
      email = "",
      website = ""
    } = body;

    if (!conversation) {
      return Response.json(
        {
          success: false,
          error: "Conversation is required."
        },
        { status: 400 }
      );
    }

    if (!meetingDay || !meetingTime) {
      return Response.json(
        {
          success: false,
          error: "Meeting day and time are required."
        },
        { status: 400 }
      );
    }

    const duration = Number(context.env.SESSION_DURATION || 30);
    const start = localSlotToDate(meetingDay, meetingTime);

    if (Number.isNaN(start.getTime())) {
      return Response.json(
        {
          success: false,
          error: "Invalid meeting date or time."
        },
        { status: 400 }
      );
    }

    if (start <= new Date()) {
      return Response.json(
        {
          success: false,
          error: "This meeting time is in the past."
        },
        { status: 400 }
      );
    }

    const end = addMinutes(start, duration);

    await assertSlotStillAvailable(
      context.env,
      start,
      end
    );

    const briefId = crypto.randomUUID();

    calendarEvent = await createCalendarEvent(
      context.env,
      {
        start: start.toISOString(),
        end: end.toISOString(),
        briefId,
        decision: conversation,
        whyStuck: difficulty,
        desiredOutcome: outcome,
        name,
        website
      }
    );

    const fields = {
      "Brief ID": briefId,
      "Status": "New",
      "Decision": conversation,
      "Why Stuck": difficulty || "",
      "Desired Outcome": outcome || "",
      "Meeting Time": start.toISOString(),
      "Calendar Event ID": calendarEvent.id,
      "Calendar Event URL": calendarEvent.htmlLink || ""
    };

    if (name) fields["Name"] = name;
    if (email) fields["Email"] = email;
    if (website) fields["Website"] = website;
    if (future) fields["Next Step"] = future;

    const record = await createOpportunityBrief(
      context.env,
      fields
    );

    return Response.json(
      {
        success: true,
        briefId,
        recordId: record.id,
        meeting: {
          start: calendarEvent.start,
          end: calendarEvent.end,
          calendarEventId: calendarEvent.id,
          calendarEventUrl: calendarEvent.htmlLink
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Booking error:", error);

    if (calendarEvent?.id) {
      try {
        await deleteCalendarEvent(
          context.env,
          calendarEvent.id
        );
      } catch (rollbackError) {
        console.error(
          "Calendar rollback error:",
          rollbackError
        );
      }
    }

    return Response.json(
      {
        success: false,
        error: error.message || "Unable to complete booking."
      },
      {
        status: error.status || 500
      }
    );
  }
}
