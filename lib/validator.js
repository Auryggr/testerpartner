const VALID_DIFFICULTIES=[
"Evidence",
"Alignment",
"Priority",
"Testing"
];

const VALID_OUTCOMES=[
"Confidence",
"Experiment",
"Alignment",
"Next Step"
];

const VALID_FUTURES=[
"Move",
"Learn",
"Prioritize",
"Validate"
];

export function validateBrief(brief){

const errors=[];

if(!brief){

errors.push("Missing brief.");

return errors;

}

if(!brief.conversation?.trim()){

errors.push("Conversation is required.");

}

if(!VALID_DIFFICULTIES.includes(brief.difficulty)){

errors.push("Invalid difficulty.");

}

if(!VALID_OUTCOMES.includes(brief.outcome)){

errors.push("Invalid outcome.");

}

if(!VALID_FUTURES.includes(brief.future)){

errors.push("Invalid future.");

}

return errors;

}

export function validateBooking(booking){

const errors=[];

if(!booking){

errors.push("Missing booking.");

return errors;

}

if(!booking.day){

errors.push("Booking day is required.");

}

if(!booking.time){

errors.push("Booking time is required.");

}

return errors;

}