export async function createOpportunityBrief(env, fields) {
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

  const table = encodeURIComponent(AIRTABLE_TABLE_NAME);

  const url =
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      records: [
        {
          fields
        }
      ]
    })
  });

  const responseText = await response.text();

  console.log("Airtable status:", response.status);
  console.log("Airtable response:", responseText);

  let data;

  try {
    data = JSON.parse(responseText);
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

  if (!data?.records?.[0]) {
    throw new Error(
      "Airtable responded successfully but no record was returned."
    );
  }

  return data.records[0];
}
export async function updateOpportunityBriefByBriefId(
  env,
  briefId,
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

  const formula =
    encodeURIComponent(
      `{Brief ID}="${briefId}"`
    );

  const searchUrl =
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}?filterByFormula=${formula}&maxRecords=1`;

  const searchResponse =
    await fetch(searchUrl, {
      headers: {
        Authorization:
          `Bearer ${AIRTABLE_TOKEN}`
      }
    });

  const searchText =
    await searchResponse.text();

  let searchData;

  try {
    searchData =
      JSON.parse(searchText);
  } catch {
    searchData = null;
  }

  if (!searchResponse.ok) {
    const airtableMessage =
      searchData?.error?.message ||
      searchData?.error?.type ||
      searchText ||
      `Airtable returned HTTP ${searchResponse.status}`;

    throw new Error(
      `Airtable ${searchResponse.status}: ${airtableMessage}`
    );
  }

  const record =
    searchData?.records?.[0];

  if (!record) {
    throw new Error(
      `Opportunity Brief not found: ${briefId}`
    );
  }

  const updateUrl =
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${record.id}`;

  const updateResponse =
    await fetch(updateUrl, {
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

  const updateText =
    await updateResponse.text();

  let updateData;

  try {
    updateData =
      JSON.parse(updateText);
  } catch {
    updateData = null;
  }

  if (!updateResponse.ok) {
    const airtableMessage =
      updateData?.error?.message ||
      updateData?.error?.type ||
      updateText ||
      `Airtable returned HTTP ${updateResponse.status}`;

    throw new Error(
      `Airtable ${updateResponse.status}: ${airtableMessage}`
    );
  }

  return updateData;
}
export async function getPendingOpportunityBriefs(env) {
  const formula =
    encodeURIComponent(
      `{Transcript Status}="Pending"`
    );

  const url =
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}?filterByFormula=${formula}`;

  const response = await fetch(url, {
    headers: {
      Authorization:
        `Bearer ${env.AIRTABLE_API_KEY}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Unable to load pending Opportunity Briefs."
    );
  }

  return data.records.map(record => ({
    recordId: record.id,
    briefId:
      record.fields["Brief ID"],
    meetingTime:
      record.fields["Meeting Time"],
    name:
      record.fields["Name"],
    website:
      record.fields["Website"],
    transcriptStatus:
      record.fields["Transcript Status"]
  }));
}