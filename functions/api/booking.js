import {
  createCalendarEvent,
  deleteCalendarEvent,
  getBusyPeriods
} from "../../lib/google-calendar.js";

import {
  createOpportunityBrief
} from "../../lib/airtable.js";

import {
  sendBookingConfirmation
} from "../../lib/email.js";


function addMinutes(
  date,
  minutes
) {
  return new Date(
    date.getTime() +
      minutes * 60 * 1000
  );
}


function localSlotToDate(
  dateString,
  timeString
) {
  return new Date(
    `${dateString}T${timeString}:00-03:00`
  );
}


function overlaps(
  startA,
  endA,
  startB,
  endB
) {
  return (
    startA < endB &&
    endA > startB
  );
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


async function assertSlotStillAvailable(
  env,
  start,
  end
) {
  const bufferMinutes =
    Number(
      env.BUFFER_MINUTES || 15
    );


  const bufferedStart =
    addMinutes(
      start,
      -bufferMinutes
    );


  const bufferedEnd =
    addMinutes(
      end,
      bufferMinutes
    );


  const busy =
    await getBusyPeriods(
      env,
      bufferedStart.toISOString(),
      bufferedEnd.toISOString()
    );


  const conflict =
    busy.some(
      (period) => {
        const busyStart =
          new Date(
            period.start
          );

        const busyEnd =
          new Date(
            period.end
          );

        return overlaps(
          bufferedStart,
          bufferedEnd,
          busyStart,
          busyEnd
        );
      }
    );


  if (conflict) {
    const error =
      new Error(
        "That time is no longer available. Please choose another slot."
      );

    error.status = 409;

    throw error;
  }
}


export async function onRequestPost(
  context
) {
  let calendarEvent = null;
  let airtableRecord = null;

  try {
    const body =
      await context.request.json();


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


    /* ===============================
       VALIDATION
       =============================== */

    if (!conversation?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Conversation is required."
        },
        {
          status: 400
        }
      );
    }


    if (!name?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Name is required."
        },
        {
          status: 400
        }
      );
    }


    if (!email?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Email is required."
        },
        {
          status: 400
        }
      );
    }


    if (
      !isValidEmail(
        email.trim()
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "A valid email is required."
        },
        {
          status: 400
        }
      );
    }


    if (!website?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Website is required."
        },
        {
          status: 400
        }
      );
    }


    if (
      !meetingDay ||
      !meetingTime
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Meeting day and time are required."
        },
        {
          status: 400
        }
      );
    }


    /* ===============================
       MEETING TIME
       =============================== */

    const duration =
      Number(
        context.env
          .SESSION_DURATION ||
          30
      );


    const start =
      localSlotToDate(
        meetingDay,
        meetingTime
      );


    if (
      Number.isNaN(
        start.getTime()
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid meeting date or time."
        },
        {
          status: 400
        }
      );
    }


    if (
      start <= new Date()
    ) {
      return Response.json(
        {
          success: false,
          error:
            "This meeting time is in the past."
        },
        {
          status: 400
        }
      );
    }


    const end =
      addMinutes(
        start,
        duration
      );


    /*
     * Re-check Google Calendar immediately
     * before creating anything.
     */
    await assertSlotStillAvailable(
      context.env,
      start,
      end
    );


    const briefId =
      crypto.randomUUID();


    /* ===============================
       1. GOOGLE CALENDAR
       =============================== */

    calendarEvent =
      await createCalendarEvent(
        context.env,
        {
          start:
            start.toISOString(),

          end:
            end.toISOString(),

          briefId,

          decision:
            conversation.trim(),

          whyStuck:
            difficulty || "",

          desiredOutcome:
            outcome || "",

          future:
            future || "",

          attendeeName:
            name.trim(),

          attendeeEmail:
            email.trim(),

          website:
            website.trim()
        }
      );


    /* ===============================
       2. AIRTABLE
       =============================== */

    const fields = {
      "Brief ID":
        briefId,

      "Status":
        "New",

      "Decision":
        conversation.trim(),

      "Why Stuck":
        difficulty || "",

      "Desired Outcome":
        outcome || "",

      "Meeting Time":
        start.toISOString(),

      "Calendar Event ID":
        calendarEvent.id,

      "Calendar Event URL":
        calendarEvent.htmlLink || "",

      "Name":
        name.trim(),

      "Email":
        email.trim(),

      "Website":
        website.trim()
    };


    if (future) {
      fields["Next Step"] =
        future;
    }


    /*
     * If you create this Airtable column later:
     *
     * fields["Google Meet URL"] =
     *   calendarEvent.meetLink || "";
     */


    airtableRecord =
      await createOpportunityBrief(
        context.env,
        fields
      );


    /* ===============================
       3. CONFIRMATION EMAIL
       =============================== */

    let emailResult = {
      sent: false,
      id: null,
      error: null
    };


    try {
      const result =
        await sendBookingConfirmation(
          context.env,
          {
            briefId,

            name:
              name.trim(),

            email:
              email.trim(),

            website:
              website.trim(),

            decision:
              conversation.trim(),

            start:
              calendarEvent.start,

            meetLink:
              calendarEvent.meetLink ||
              "",

            calendarEventUrl:
              calendarEvent.htmlLink ||
              ""
          }
        );


      emailResult = {
        sent: true,
        id:
          result.id,
        error:
          null
      };

    } catch (emailError) {
      /*
       * IMPORTANT:
       *
       * Calendar + Airtable already succeeded.
       *
       * We DO NOT throw here because otherwise
       * the frontend may retry the booking and
       * create duplicate bookings.
       */
      console.error(
        "Booking confirmation email error:",
        emailError
      );


      emailResult = {
        sent: false,
        id: null,
        error:
          emailError.message ||
          "Unable to send confirmation email."
      };
    }


    /* ===============================
       SUCCESS
       =============================== */

    return Response.json(
      {
        success: true,

        briefId,

        recordId:
          airtableRecord.id,

        meeting: {
          start:
            calendarEvent.start,

          end:
            calendarEvent.end,

          calendarEventId:
            calendarEvent.id,

          calendarEventUrl:
            calendarEvent.htmlLink,

          meetLink:
            calendarEvent.meetLink ||
            null
        },

        email:
          emailResult
      },
      {
        status: 201
      }
    );

  } catch (error) {
    console.error(
      "Booking error:",
      error
    );


    /*
     * Calendar succeeded but Airtable failed:
     * rollback the Calendar event.
     *
     * If Airtable succeeded and only Resend failed,
     * execution never reaches this block.
     */
    if (
      calendarEvent?.id &&
      !airtableRecord
    ) {
      try {
        await deleteCalendarEvent(
          context.env,
          calendarEvent.id
        );

      } catch (
        rollbackError
      ) {
        console.error(
          "Calendar rollback error:",
          rollbackError
        );
      }
    }


    return Response.json(
      {
        success: false,

        error:
          error.message ||
          "Unable to complete booking."
      },
      {
        status:
          error.status ||
          500
      }
    );
  }
}