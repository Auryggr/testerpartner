import { ok } from "../lib/response.js";

export const onRequestGet=async()=>{

return ok({

status:"ok",

service:"TesterPartner API",

version:"1.0.0"

});

};