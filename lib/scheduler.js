export function createMeeting(booking){

const meetingAt=

`${booking.day}T${booking.time}:00`;

return{

meetingAt,

duration:30,

status:"Booked"

};

}