function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  
  function formatMeetingDate(dateString, timeZone) {
    const date = new Date(dateString);
  
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }
    ).format(date);
  }
  
  
  export async function sendBookingConfirmation(
    env,
    {
      briefId,
      name,
      email,
      website,
      decision,
      start,
      meetLink,
      calendarEventUrl
    }
  ) {
    if (!env.RESEND_API_KEY) {
      throw new Error(
        "Missing RESEND_API_KEY."
      );
    }
  
    if (!email) {
      throw new Error(
        "Missing booking email."
      );
    }
  
    const timeZone =
      env.TIMEZONE ||
      "America/Argentina/Buenos_Aires";
  
    const meetingDate =
      formatMeetingDate(
        start,
        timeZone
      );
  
    const safeName =
      escapeHtml(name);
  
    const safeWebsite =
      escapeHtml(website);
  
    const safeDecision =
      escapeHtml(decision);
  
    const safeBriefId =
      escapeHtml(briefId);
  
    const subject =
      "Your TesterPartner Positioning Breakdown is booked";
  
    const html = `
  <!doctype html>
  <html>
    <body
      style="
        margin:0;
        padding:0;
        background:#f5f7fb;
        font-family:Arial,Helvetica,sans-serif;
        color:#111827;
      "
    >
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td
            align="center"
            style="padding:40px 20px;"
          >
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                max-width:640px;
                background:#ffffff;
                border-radius:18px;
                overflow:hidden;
              "
            >
              <tr>
                <td
                  style="
                    padding:32px;
                  "
                >
                  <p
                    style="
                      margin:0 0 12px;
                      font-size:12px;
                      font-weight:700;
                      letter-spacing:.08em;
                      color:#0f8a70;
                    "
                  >
                    TESTERPARTNER
                  </p>
  
                  <h1
                    style="
                      margin:0 0 18px;
                      font-size:28px;
                      line-height:1.15;
                    "
                  >
                    You're booked.
                  </h1>
  
                  <p
                    style="
                      margin:0 0 22px;
                      color:#667085;
                      line-height:1.6;
                    "
                  >
                    Hi ${safeName || "there"}, your Positioning Breakdown is confirmed.
                    Before we meet, I'll review the context you shared so we can start with the decision itself.
                  </p>
  
                  <div
                    style="
                      padding:20px;
                      background:#f7f9fc;
                      border:1px solid #e5e7eb;
                      border-radius:14px;
                      margin-bottom:24px;
                    "
                  >
                    <p
                      style="
                        margin:0 0 8px;
                        font-size:13px;
                        color:#667085;
                      "
                    >
                      WHEN
                    </p>
  
                    <p
                      style="
                        margin:0 0 18px;
                        font-size:16px;
                        font-weight:700;
                      "
                    >
                      ${escapeHtml(meetingDate)}
                    </p>
  
                    ${
                      safeWebsite
                        ? `
                          <p
                            style="
                              margin:0 0 8px;
                              font-size:13px;
                              color:#667085;
                            "
                          >
                            WEBSITE
                          </p>
  
                          <p
                            style="
                              margin:0 0 18px;
                            "
                          >
                            ${safeWebsite}
                          </p>
                        `
                        : ""
                    }
  
                    <p
                      style="
                        margin:0 0 8px;
                        font-size:13px;
                        color:#667085;
                      "
                    >
                      YOUR DECISION
                    </p>
  
                    <p
                      style="
                        margin:0;
                        line-height:1.55;
                      "
                    >
                      ${safeDecision}
                    </p>
                  </div>
  
                  ${
                    meetLink
                      ? `
                        <p
                          style="
                            margin:0 0 14px;
                          "
                        >
                          <a
                            href="${meetLink}"
                            style="
                              display:inline-block;
                              background:#111827;
                              color:#ffffff;
                              text-decoration:none;
                              padding:14px 20px;
                              border-radius:10px;
                              font-weight:700;
                            "
                          >
                            Join Google Meet
                          </a>
                        </p>
                      `
                      : ""
                  }
  
                  ${
                    calendarEventUrl
                      ? `
                        <p
                          style="
                            margin:0 0 28px;
                          "
                        >
                          <a
                            href="${calendarEventUrl}"
                            style="
                              color:#0f8a70;
                              text-decoration:none;
                              font-weight:600;
                            "
                          >
                            View calendar event
                          </a>
                        </p>
                      `
                      : ""
                  }
  
                  <p
                    style="
                      margin:0 0 10px;
                      line-height:1.6;
                      color:#475467;
                    "
                  >
                    Your Breakdown includes focused pre-session research,
                    a 30-minute live conversation, observed signals,
                    a positioning hypothesis, and an Opportunity Brief.
                  </p>
  
                  <p
                    style="
                      margin:24px 0 0;
                      font-size:12px;
                      color:#98a2b3;
                    "
                  >
                    Opportunity Brief: ${safeBriefId}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
    `.trim();
  
  
    const text = `
  You're booked.
  
  Hi ${name || "there"},
  
  Your TesterPartner Positioning Breakdown is confirmed.
  
  When:
  ${meetingDate}
  
  Website:
  ${website || "—"}
  
  Your decision:
  ${decision}
  
  ${meetLink ? `Join Google Meet: ${meetLink}` : ""}
  
  ${calendarEventUrl ? `Calendar event: ${calendarEventUrl}` : ""}
  
  Opportunity Brief:
  ${briefId}
  
  Before we meet, I'll review the context you shared so we can start with the decision itself.
    `.trim();
  
  
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
  
          headers: {
            Authorization:
              `Bearer ${env.RESEND_API_KEY}`,
  
            "Content-Type":
              "application/json",
  
            "Idempotency-Key":
              `booking-confirmation-${briefId}`
          },
  
          body:
            JSON.stringify({
              /*
               * For now use an address under the verified
               * Resend sending domain.
               */
              from:
                env.EMAIL_FROM ||
                "TesterPartner <hello@send.testerpartner.com>",
  
              to: [
                email
              ],
  
              /*
               * Replies can still arrive through
               * Cloudflare Email Routing.
               */
              reply_to:
                env.EMAIL_REPLY_TO ||
                "hello@testerpartner.com",
  
              subject,
  
              html,
  
              text
            })
        }
      );
  
  
    const data =
      await response
        .json()
        .catch(() => ({}));
  
  
    if (!response.ok) {
      console.error(
        "Resend error:",
        JSON.stringify(data)
      );
  
      throw new Error(
        data?.message ||
        data?.error?.message ||
        "Unable to send booking confirmation email."
      );
    }
  
  
    return {
      id:
        data.id || null
    };
  }