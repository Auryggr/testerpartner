import {
  normalizeLaxisTranscript
} from "../../lib/transcript.js";

export async function onRequestPost(context) {
  try {
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

    return Response.json(
      {
        success: true,
        transcript
      },
      {
        status: 200
      }
    );
  } catch (error) {
    console.error(
      "Transcript test error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to normalize transcript."
      },
      {
        status: 500
      }
    );
  }
}