export function ok(data,status=200){

return Response.json(

{

success:true,

data

},

{

status

}

);

}



export function error(

message,

status=500

){

return Response.json(

{

success:false,

error:message

},

{

status

}

);

}



export function validation(

errors

){

return Response.json(

{

success:false,

errors

},

{

status:400

}

);

}