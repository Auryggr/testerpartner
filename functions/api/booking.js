import { createOpportunityBrief } from "../../lib/airtable.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const {
      conversation,
      difficulty,
      outcome,
      future,
      meetingDay,
      meetingTime
    } = body;

    if (!conversation) {
      return Response.json(
        {
          ok: false,
          error: "Conversation is required."
        },
        {
          status: 400
        }
      );
    }

    const briefId = crypto.randomUUID();

    const record = await createOpportunityBrief(
      context.env,
      {
        "Brief ID": briefId,
        "Status": "Booked",
        "Conversation": conversation,
        "Difficulty": difficulty || "",
        "Desired Outcome": outcome || "",
        "Future Change": future || "",
        "Meeting Date": meetingDay || "",
        "Meeting Time": meetingTime || ""
      }
    );

    return Response.json({
      ok: true,
      briefId,
      recordId: record.id
    });
  } catch (error) {
    console.error("Booking error:", error);

    return Response.json(
      {
        ok: false,
        error: "Unable to create the Opportunity Brief."
      },
      {
        status: 500
      }
    );
  }
}