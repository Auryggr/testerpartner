export async function onRequestGet(context) {
    const url = new URL(context.request.url);
  
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
  
    if (oauthError) {
      return Response.json(
        {
          success: false,
          error: oauthError
        },
        { status: 400 }
      );
    }
  
    if (!code) {
      return Response.json(
        {
          success: false,
          error: "Missing authorization code."
        },
        { status: 400 }
      );
    }
  
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    } = context.env;
  
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code"
        })
      }
    );
  
    const tokens = await tokenResponse.json();
  
    if (!tokenResponse.ok) {
      console.error("Google token error:", tokens);
  
      return Response.json(
        {
          success: false,
          error:
            tokens.error_description ||
            tokens.error ||
            "Unable to exchange authorization code."
        },
        { status: tokenResponse.status }
      );
    }
  
  
    return Response.json({
  success: true,
  connected: Boolean(tokens.refresh_token),
  refreshToken: tokens.refresh_token || null,
  message: "Google Calendar connected successfully."
});
    }