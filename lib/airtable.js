export async function createOpportunityBrief(env, fields) {
    const {
      AIRTABLE_TOKEN,
      AIRTABLE_BASE_ID,
      AIRTABLE_TABLE_NAME
    } = env;
  
    if (
      !AIRTABLE_TOKEN ||
      !AIRTABLE_BASE_ID ||
      !AIRTABLE_TABLE_NAME
    ) {
      throw new Error("Missing Airtable configuration.");
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
  
    const data = await response.json();
  
    if (!response.ok) {
      console.error(
        "Airtable error:",
        JSON.stringify(data)
      );
  
      throw new Error(
        data?.error?.message ||
        "Unable to create Airtable record."
      );
    }
  
    return data.records[0];
  }