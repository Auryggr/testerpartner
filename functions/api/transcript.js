import {
  normalizeLaxisTranscript
} from "../../lib/transcript.js";

import {
  updateOpportunityBriefByBriefId
} from "../../lib/airtable.js";

export async function onRequestPost(context) {
  try {
    const briefId =
      context.request.headers.get("X-Brief-ID");

    if (!briefId) {
      return Response.json(
        {
          success: false,
          error: "Brief ID is required."
        },
        {
          status: 400
        }
      );
    }

    const content =
      await context.request.text();

    if (!content.trim()) {
      return Response.json(
        {
          success: false,
          error: "Transcript content is required."
        },
        {
          status: 400
        }
      );
    }

    const transcript =
      normalizeLaxisTranscript(content);

    const record =
      await updateOpportunityBriefByBriefId(
        context.env,
        briefId,
        {
          Transcript:
            transcript.plainText,
          "Transcript Source":
            transcript.source,
          "Transcript Status":
            "Ready"
        }
      );

    return Response.json(
      {
        success: true,
        briefId,
        recordId: record.id,
        transcript
      },
      {
        status: 200
      }
    );
  } catch (error) {
    console.error(
      "Transcript error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to process transcript."
      },
      {
        status: 500
      }
    );
  }
}