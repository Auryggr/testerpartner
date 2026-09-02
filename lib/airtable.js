function getAirtableConfig(
  env
) {
  const {
    AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID,
    AIRTABLE_TABLE_NAME
  } = env;

  if (!AIRTABLE_TOKEN) {
    throw new Error(
      "AIRTABLE_TOKEN is missing."
    );
  }

  if (!AIRTABLE_BASE_ID) {
    throw new Error(
      "AIRTABLE_BASE_ID is missing."
    );
  }

  if (!AIRTABLE_TABLE_NAME) {
    throw new Error(
      "AIRTABLE_TABLE_NAME is missing."
    );
  }

  return {
    token:
      AIRTABLE_TOKEN,
    baseId:
      AIRTABLE_BASE_ID,
    table:
      encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )
  };
}

async function parseAirtableResponse(
  response
) {
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

export async function createOpportunityBrief(
  env,
  fields
) {
  const {
    token,
    baseId,
    table
  } = getAirtableConfig(env);

  const url =
    `https://api.airtable.com/v0/${baseId}/${table}`;

  const response =
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        fields
      })
    });

  return parseAirtableResponse(
    response
  );
}

export async function updateOpportunityBriefByBriefId(
  env,
  briefId,
  fields
) {
  const {
    token,
    baseId,
    table
  } = getAirtableConfig(env);

  if (!briefId) {
    throw new Error(
      "Brief ID is required."
    );
  }

  const formula =
    encodeURIComponent(
      `{Brief ID}="${briefId}"`
    );

  const searchUrl =
    `https://api.airtable.com/v0/${baseId}/${table}?filterByFormula=${formula}&maxRecords=1`;

  const searchResponse =
    await fetch(
      searchUrl,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );

  const searchData =
    await parseAirtableResponse(
      searchResponse
    );

  const record =
    searchData?.records?.[0];

  if (!record) {
    throw new Error(
      `Opportunity Brief not found: ${briefId}`
    );
  }

  return updateOpportunityBriefByRecordId(
    env,
    record.id,
    fields
  );
}

export async function getPendingOpportunityBriefs(
  env
) {
  const {
    token,
    baseId,
    table
  } = getAirtableConfig(env);

  const formula =
    encodeURIComponent(
      `AND(
        NOT({Meeting Time}=""),
        OR(
          {Transcript Status}="Pending",
          {Transcript Status}="Needs Review",
          {Transcript Status}="Discovered",

          AND(
            {Transcript Status}="Ready",
            {Transcript}=""
          ),

          {Transcript Status}="",

          AND(
            NOT({Transcript}=""),
            OR(
              {Transcript Source}="",
              {Laxis Note ID}="",
              {Laxis URL}=""
            )
          ),

          AND(
            {Transcript Source}="Laxis",
            OR(
              {Laxis Note ID}="",
              {Laxis URL}=""
            )
          )
        )
      )`
    );

  const url =
    `https://api.airtable.com/v0/${baseId}/${table}?filterByFormula=${formula}`;

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    });

  const data =
    await parseAirtableResponse(
      response
    );

  return (
    data?.records || []
  ).map(record => ({
    recordId:
      record.id,

    briefId:
      record.fields[
        "Brief ID"
      ],

    meetingTime:
      record.fields[
        "Meeting Time"
      ],

    name:
      record.fields[
        "Name"
      ],

    website:
      record.fields[
        "Website"
      ],

    transcript:
      record.fields[
        "Transcript"
      ] || "",

    transcriptSource:
      record.fields[
        "Transcript Source"
      ] || "",

    transcriptStatus:
      record.fields[
        "Transcript Status"
      ] || "",

    candidateLaxisNoteId:
      record.fields[
        "Candidate Laxis Note ID"
      ] || "",

    candidateLaxisUrl:
      record.fields[
        "Candidate Laxis URL"
      ] || "",

    candidateLaxisTitle:
      record.fields[
        "Candidate Laxis Title"
      ] || "",

    laxisNoteId:
      record.fields[
        "Laxis Note ID"
      ] || "",

    laxisUrl:
      record.fields[
        "Laxis URL"
      ] || ""
  }));
}

export async function getAssignedLaxisMeetings(
  env
) {
  const {
    token,
    baseId,
    table
  } = getAirtableConfig(env);

  const formula =
    encodeURIComponent(
      `NOT({Laxis Note ID}="")`
    );

  const url =
    `https://api.airtable.com/v0/${baseId}/${table}?filterByFormula=${formula}`;

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    });

  const data =
    await parseAirtableResponse(
      response
    );

  return (
    data?.records || []
  ).map(record => ({
    recordId:
      record.id,

    briefId:
      record.fields[
        "Brief ID"
      ],

    laxisNoteId:
      record.fields[
        "Laxis Note ID"
      ]
  }));
}

export async function updateOpportunityBriefByRecordId(
  env,
  recordId,
  fields
) {
  const {
    token,
    baseId,
    table
  } = getAirtableConfig(env);

  if (!recordId) {
    throw new Error(
      "Airtable record ID is required."
    );
  }

  const url =
    `https://api.airtable.com/v0/${baseId}/${table}/${recordId}`;

  const response =
    await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization:
          `Bearer ${token}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        fields
      })
    });

  return parseAirtableResponse(
    response
  );
}