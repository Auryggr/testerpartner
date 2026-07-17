const body=

await request.json();

const errors=[

...validateBrief(body.brief),

...validateBooking(body.booking)

];

if(errors.length){

return validation(errors);

}

const brief=

createBrief(body.brief);

const meeting=

createMeeting(body.booking);