import { generateBriefId } from "./ids.js";

export function createBrief(data){

return{

briefId:generateBriefId(),

status:"Booked",

createdAt:new Date().toISOString(),

conversation:data.conversation.trim(),

difficulty:data.difficulty,

outcome:data.outcome,

future:data.future

};

}