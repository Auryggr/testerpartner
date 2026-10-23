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

import {
  minNoticeMinutes
} from "../../lib/qa-mode.js";


/*
 * Version of the Privacy Policy the visitor accepted.
 * Update it whenever the policy's effective date changes.
 */
const PRIVACY_POLICY_VERSION = "2026-10-23";


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


/*
 * utm_* tags sent by the form -> Airtable fields.
 * Only short, plain values are kept; anything else is dropped.
 */
const CAMPAIGN_FIELDS = {
  source: "UTM Source",
  medium: "UTM Medium",
  campaign: "UTM Campaign",
  content: "UTM Content",
  term: "UTM Term",
  ref: "Ref"
};

function campaignToFields(campaign) {
  const fields = {};
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) {
    return fields;
  }
  for (const [key, fieldName] of Object.entries(CAMPAIGN_FIELDS)) {
    const value = campaign[key];
    if (typeof value !== "string") continue;
    const clean = value.trim().slice(0, 100);
    if (clean && /^[\p{L}\p{N} ._+\-|/:]+$/u.test(clean)) {
      fields[fieldName] = clean;
    }
  }
  return fields;
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
      meetingDay,
      meetingTime,
      name = "",
      email = "",
      website = "",
      partnerType = "",
      clientWebsite = "",
      privacyAccepted = false,
      recordingConsent = false,
      marketingOptIn = false,
      campaign = {}
    } = body;

    const campaignFields =
      campaignToFields(campaign);


    if (privacyAccepted !== true) {
      return Response.json(
        {
          success: false,
          error:
            "Please accept the Privacy Policy to book your session."
        },
        {
          status: 400
        }
      );
    }

    const consentTimestamp =
      new Date().toISOString();


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


    if (!["Agency", "DTC / Ecommerce Brand"].includes(partnerType)) {
      return Response.json({success:false,error:"Select Agency or DTC / Ecommerce Brand."},{status:400});
    }
    if (partnerType === "Agency" && !clientWebsite?.trim()) {
      return Response.json({success:false,error:"Selected client website is required for agencies."},{status:400});
    }
    const targetWebsite = partnerType === "Agency" ? clientWebsite.trim() : website.trim();
    const validUrl = value => { try { const url = new URL(value); return ["http:","https:"].includes(url.protocol) && url.hostname.includes("."); } catch { return false; } };
    if (!validUrl(targetWebsite) || !validUrl(website.trim())) {
      return Response.json({success:false,error:"Enter valid website URLs."},{status:400});
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
          15
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


    /*
     * Same minimum notice as /api/availability (48 h for visitors,
     * none in QA mode), so it can't be skipped by calling the API directly.
     */
    const noticeMinutes =
      minNoticeMinutes(
        context.request,
        context.env
      );

    if (
      start <
      addMinutes(
        new Date(),
        noticeMinutes
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "That time is no longer available. Please choose another slot."
        },
        {
          status: 409
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

          attendeeName:
            name.trim(),

          attendeeEmail:
            email.trim(),

          website:
            website.trim(),

          recordingConsent:
            recordingConsent === true
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
        targetWebsite,

      "Partner Type": partnerType,

      // Consent record (create these fields in Airtable first).
      "Privacy Accepted":
        true,

      "Privacy Policy Version":
        PRIVACY_POLICY_VERSION,

      "Recording Consent":
        recordingConsent === true,

      "Marketing Opt-in":
        marketingOptIn === true,

      "Consent Timestamp":
        consentTimestamp,

      // Where the visitor came from (utm_* tags of the link), if any.
      ...campaignFields,

      ...(partnerType === "Agency" ? {
        "Agency Website": website.trim(),
        "Client Website": targetWebsite
      } : {})
    };


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
              targetWebsite,

            // Company Type is classified by the research workflow, not guessed at booking.
            companyType: null,

            brand:
              deriveBrandFromWebsite(
                targetWebsite
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
              targetWebsite,

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


    /*
     * Expected problems (e.g. 409 slot taken) keep their message.
     * Internal errors (Google, Airtable…) stay in the logs and the
     * visitor sees a friendly message instead of technical details.
     */
    const status =
      error.status ||
      500;

    return Response.json(
      {
        success: false,
        error:
          status < 500 && error.message
            ? error.message
            : "We couldn’t complete your booking right now. Please try again in a few minutes or email hello@testerpartner.com."
      },
      {
        status
      }
    );
  }
}