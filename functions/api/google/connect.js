export async function onRequestGet(context) {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_REDIRECT_URI
    } = context.env;
  
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
      return Response.json(
        {
          success: false,
          error: "Missing Google OAuth configuration."
        },
        { status: 500 }
      );
    }
  
    const scope =
      "https://www.googleapis.com/auth/calendar";
  
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true"
    });
  
    return Response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      302
    );
  }