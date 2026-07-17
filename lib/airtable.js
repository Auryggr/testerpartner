const API="https://api.airtable.com/v0";

function headers(env){

return{

Authorization:`Bearer ${env.AIRTABLE_TOKEN}`,

"Content-Type":"application/json"

};

}

function endpoint(env){

return `${API}/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}`;

}

export async function createBrief(env,brief,meeting){

const body={

records:[

{

fields:{

"Brief ID":brief.briefId,

Status:brief.status,

Conversation:brief.conversation,

Difficulty:brief.difficulty,

Outcome:brief.outcome,

Future:brief.future,

"Meeting Date":meeting.meetingDate,

"Meeting Time":meeting.meetingTime,

"Meeting At":meeting.meetingAt,

Duration:meeting.duration

}

}

]

};

const response=await fetch(

endpoint(env),

{

method:"POST",

headers:headers(env),

body:JSON.stringify(body)

}

);

if(!response.ok){

throw new Error(

"Airtable create failed."

);

}

const data=await response.json();

return data.records[0];

}