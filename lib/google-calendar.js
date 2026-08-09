export async function getGoogleAccessToken(
  env
) {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN
  } = env;


  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      "Missing Google Calendar OAuth configuration."
    );
  }


  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          new URLSearchParams({
            client_id:
              GOOGLE_CLIENT_ID,

            client_secret:
              GOOGLE_CLIENT_SECRET,

            refresh_token:
              GOOGLE_REFRESH_TOKEN,

            grant_type:
              "refresh_token"
          })
      }
    );


  const data =
    await response.json();


  if (!response.ok) {
    console.error(
      "Google token error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error_description ||
      data?.error ||
      "Unable to authenticate with Google Calendar."
    );
  }


  return data.access_token;
}



export async function getBusyPeriods(
  env,
  timeMin,
  timeMax
) {
  const accessToken =
    await getGoogleAccessToken(
      env
    );


  const calendarId =
    env.GOOGLE_CALENDAR_ID ||
    "primary";


  const response =
    await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            timeMin,
            timeMax,

            timeZone:
              env.TIMEZONE ||
              "America/Argentina/Buenos_Aires",

            items: [
              {
                id:
                  calendarId
              }
            ]
          })
      }
    );


  const data =
    await response.json();


  if (!response.ok) {
    console.error(
      "Google freeBusy error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message ||
      "Unable to read Google Calendar availability."
    );
  }


  const calendar =
    data.calendars?.[
      calendarId
    ];


  if (!calendar) {
    throw new Error(
      `Calendar "${calendarId}" was not returned by Google.`
    );
  }


  if (
    calendar.errors?.length
  ) {
    console.error(
      "Google Calendar errors:",
      JSON.stringify(
        calendar.errors
      )
    );

    throw new Error(
      calendar.errors[0]
        ?.reason ||
      "Unable to read Google Calendar."
    );
  }


  return calendar.busy || [];
}



export async function createCalendarEvent(
  env,
  {
    start,
    end,
    briefId,
    decision,
    whyStuck = "",
    desiredOutcome = "",
    future = "",
    attendeeName = "",
    attendeeEmail = "",
    website = ""
  }
) {
  const accessToken =
    await getGoogleAccessToken(
      env
    );


  const calendarId =
    encodeURIComponent(
      env.GOOGLE_CALENDAR_ID ||
      "primary"
    );


  const description = [
    attendeeName
      ? `Name: ${attendeeName}`
      : "",

    attendeeEmail
      ? `Email: ${attendeeEmail}`
      : "",

    website
      ? `Website: ${website}`
      : "",

    briefId
      ? `Opportunity Brief: ${briefId}`
      : "",

    decision
      ? `Decision:\n${decision}`
      : "",

    whyStuck
      ? `Why they're stuck:\n${whyStuck}`
      : "",

    desiredOutcome
      ? `Desired outcome:\n${desiredOutcome}`
      : "",

    future
      ? `What would change next:\n${future}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");


  const event = {
    summary:
      attendeeName
        ? `TesterPartner — ${attendeeName} — Positioning Breakdown`
        : "TesterPartner — Positioning Breakdown",

    description,

    start: {
      dateTime:
        start,

      timeZone:
        env.TIMEZONE ||
        "America/Argentina/Buenos_Aires"
    },

    end: {
      dateTime:
        end,

      timeZone:
        env.TIMEZONE ||
        "America/Argentina/Buenos_Aires"
    },

    conferenceData: {
      createRequest: {
        requestId:
          crypto.randomUUID(),

        conferenceSolutionKey: {
          type:
            "hangoutsMeet"
        }
      }
    }
  };


  const attendees = [];

if (attendeeEmail) {
  attendees.push({
    email: attendeeEmail,

    ...(attendeeName
      ? {
          displayName: attendeeName
        }
      : {})
  });
}

const testerPartnerEmail =
  env.TESTERPARTNER_EMAIL ||
  "hello@testerpartner.com";

if (
  testerPartnerEmail &&
  testerPartnerEmail !== attendeeEmail
) {
  attendees.push({
    email: testerPartnerEmail,
    displayName: "TesterPartner"
  });
}

if (attendees.length) {
  event.attendees = attendees;
}


  const query =
    new URLSearchParams({
      conferenceDataVersion:
        "1",

      sendUpdates:
        attendeeEmail
          ? "all"
          : "none"
    });


  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${query.toString()}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            event
          )
      }
    );


  const data =
    await response.json();


  if (!response.ok) {
    console.error(
      "Google Calendar event error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message ||
      "Unable to create Google Calendar event."
    );
  }


  const meetEntryPoint =
    data.conferenceData
      ?.entryPoints
      ?.find(
        (entryPoint) =>
          entryPoint
            .entryPointType ===
          "video"
      );


  const meetLink =
    data.hangoutLink ||
    meetEntryPoint?.uri ||
    "";


  return {
    id:
      data.id,

    htmlLink:
      data.htmlLink,

    meetLink,

    start:
      data.start
        ?.dateTime ||
      start,

    end:
      data.end
        ?.dateTime ||
      end,

    attendeeEmail
  };
}



export async function deleteCalendarEvent(
  env,
  eventId
) {
  if (!eventId) {
    return;
  }


  const accessToken =
    await getGoogleAccessToken(
      env
    );


  const calendarId =
    encodeURIComponent(
      env.GOOGLE_CALENDAR_ID ||
      "primary"
    );


  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );


  if (
    !response.ok &&
    response.status !== 410
  ) {
    const text =
      await response.text();

    console.error(
      "Google Calendar delete error:",
      text
    );

    throw new Error(
      "Unable to roll back Google Calendar event."
    );
  }
}