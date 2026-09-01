const ALLOWED_ORIGIN = "https://app.laxis.tech";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN
        ? ALLOWED_ORIGIN
        : "null",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type"
  };
}

export async function onRequestOptions(context) {
  const origin =
    context.request.headers.get("Origin");

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin)
  });
}

export async function onRequestPost(context) {
  const origin =
    context.request.headers.get("Origin");

  try {
    const body =
      await context.request.json();

    if (!Array.isArray(body.meetings)) {
      return Response.json(
        {
          success: false,
          error:
            "meetings must be an array."
        },
        {
          status: 400,
          headers: corsHeaders(origin)
        }
      );
    }

    const meetings =
      body.meetings.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        createdTime:
          meeting.createdTime,
        noteUrl:
          meeting.noteUrl
      }));

    console.log(
      "[Laxis Discovery]",
      meetings
    );

    return Response.json(
      {
        success: true,
        received: meetings.length,
        meetings
      },
      {
        status: 200,
        headers: corsHeaders(origin)
      }
    );
  } catch (error) {
    console.error(
      "Laxis discovery error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to process Laxis discovery."
      },
      {
        status: 500,
        headers: corsHeaders(origin)
      }
    );
  }
}