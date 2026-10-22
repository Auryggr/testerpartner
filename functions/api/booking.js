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

// NUEVO: disparo del motor de research.
import {
  triggerResearchSafe
} from "../../lib/research-dispatch.js";


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


function createBriefId() {
  return `TP-${crypto
    .randomUUID()
    .split("-")[0]
    .toUpperCase()}`;
}


function normalizeCompanyType(value) {
  if (!value) return null;

  const v = String(value)
    .trim()
    .toLowerCase();

  const map = {
    devtool: "DevTool",
    developer: "DevTool",
    "developer tool": "DevTool",
    api: "DevTool",
    sdk: "DevTool",

    consumer: "Consumer",
    "consumer product": "Consumer",
    physical: "Consumer",
    ecommerce: "Consumer",
    "e-commerce": "Consumer",

    saas: "SaaS",
    "b2b saas": "SaaS",
    software: "SaaS",
    platform: "SaaS",

    service: "Service",
    "local service": "Service",
    agency: "Service",
    consulting: "Service"
  };

  return map[v] || null;
}

function deriveBrandFromWebsite(website) {
  if (!website) return null;

  try {
    const host = new URL(
      website.startsWith("http")
        ? website
        : `https://${website}`
    ).hostname;

    return (
      host
        .replace(/^www\./, "")
        .split(".")[0] || null
    );
  } catch {
    return null;
  }
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
      website = "",
      clientWebsite = "",
      companyType = ""   
    } = body;


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


    await assertSlotStillAvailable(
      context.env,
      start,
      end
    );


    const briefId =
      createBriefId();

    const normalizedType =
      normalizeCompanyType(
        companyType
      );


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


    const fields = {
      "Brief ID":
        briefId,

      "Status":
        "New",

      "Transcript Status":
        "Pending",

      "Research Status":
        "Pending",

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
        clientWebsite ? `Client type: ${future}; Client website: ${clientWebsite}` : `Client type: ${future}`;
    }

    if (normalizedType) {
      fields["Company Type"] =
        normalizedType;
    }


    airtableRecord =
      await createOpportunityBrief(
        context.env,
        fields
      );


    let researchResult = {
      dispatched: false,
      error: null
    };

    try {
      researchResult =
        await triggerResearchSafe(
          context.env,
          {
            briefId,

            website:
              (clientWebsite || website).trim(),

            companyType:
              normalizedType,

            brand:
              deriveBrandFromWebsite(
                website.trim()
              )
          }
        );

    } catch (researchError) {
      // Defensa extra: triggerResearchSafe ya no lanza, pero por las dudas
      // no dejamos que nada acá tumbe la reserva.
      console.error(
        "Research dispatch error:",
        researchError
      );

      researchResult = {
        dispatched: false,
        error:
          researchError.message ||
          "Unable to dispatch research."
      };
    }


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
          emailResult,

     
        research:
          researchResult
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