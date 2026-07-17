export function generateBriefId(){

const now=new Date();

const year=String(now.getFullYear()).slice(-2);

const month=String(

now.getMonth()+1

).padStart(2,"0");

const day=String(

now.getDate()

).padStart(2,"0");

const random=Math.floor(

100+Math.random()*900

);

return `TP-${year}${month}${day}-${random}`;

}