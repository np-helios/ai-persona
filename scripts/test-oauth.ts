import "./load-env";
import { google } from "googleapis";

async function main() {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN"
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")}`);
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  try {
    const token = await auth.getAccessToken();
    console.log(
      JSON.stringify(
        {
          ok: Boolean(token.token),
          message: "OAuth refresh token is valid for this client."
        },
        null,
        2
      )
    );
  } catch (error: any) {
    const message =
      error?.response?.data?.error_description ??
      error?.response?.data?.error ??
      error?.message ??
      "OAuth validation failed";
    console.error(
      JSON.stringify(
        {
          ok: false,
          message,
          likelyFix:
            "Regenerate the refresh token in OAuth Playground using the exact same GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET currently in .env.local."
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

main();
