export async function updateOpportunityBriefByRecordId(
  env,
  recordId,
  fields
) {
  const {
    AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID,
    AIRTABLE_TABLE_NAME
  } = env;

  if (!AIRTABLE_TOKEN) {
    throw new Error("AIRTABLE_TOKEN is missing.");
  }

  if (!AIRTABLE_BASE_ID) {
    throw new Error("AIRTABLE_BASE_ID is missing.");
  }

  if (!AIRTABLE_TABLE_NAME) {
    throw new Error("AIRTABLE_TABLE_NAME is missing.");
  }

  const table =
    encodeURIComponent(
      AIRTABLE_TABLE_NAME
    );

  const url =
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${recordId}`;

  const response =
    await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization:
          `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        fields
      })
    });

  const responseText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    data = null;
  }

  if (!response.ok) {
    const airtableMessage =
      data?.error?.message ||
      data?.error?.type ||
      responseText ||
      `Airtable returned HTTP ${response.status}`;

    throw new Error(
      `Airtable ${response.status}: ${airtableMessage}`
    );
  }

  return data;
}