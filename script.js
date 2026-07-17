(() => {

const Events={

events:{},

on(event,callback){

(this.events[event]||(this.events[event]=[]))
.push(callback);

},

emit(event,data){

(this.events[event]||[])
.forEach(callback=>callback(data));

}

};


const State={

step:1,

brief:{

conversation:"",

difficulty:"",

outcome:"",

future:"",

day:null,

time:null,

meeting:null,

briefId:null

},

days:[],

slots:[]

};


const UI={

el:{},

cache(){

this.el.modal=
document.getElementById("breakdownModal");

this.el.screens=[
...document.querySelectorAll(".wizard-screen")
];

this.el.chapters=[
...document.querySelectorAll(".chapter")
];

this.el.nextButtons=[
...document.querySelectorAll(".next-step")
];

this.el.previousButtons=[
...document.querySelectorAll(".previous-step")
];

this.el.challenge=
document.getElementById("challenge");

this.el.dayGrid=
document.getElementById("dayGrid");

this.el.timeGrid=
document.getElementById("timeGrid");

this.el.summaryChallenge=
document.getElementById("summaryChallenge");

this.el.summaryDifficulty=
document.getElementById("summaryDifficulty");

this.el.summaryOutcome=
document.getElementById("summaryOutcome");

this.el.continueDay=
document.getElementById("continueDay");

this.el.confirmBooking=
document.getElementById("confirmBooking");

this.el.closeSuccess=
document.getElementById("closeSuccess");

}

};


const Helpers={

difficultyLabels:{

Alignment:
"We don't agree internally.",

Evidence:
"We don't have enough evidence.",

Customer:
"We're unsure what customers actually care about.",

Direction:
"There are too many possible directions."

},

outcomeLabels:{

Direction:
"One clearer direction.",

Opportunity:
"One positioning opportunity.",

Recommendation:
"A recommendation I trust.",

Confidence:
"More confidence to move forward."

},

futureLabels:{

Move:
"Move forward with confidence.",

"Stop debating":
"Stop debating and start acting.",

Know:
"Know exactly what to test next.",

Align:
"Align around one shared direction."

},

text(value,fallback="Waiting..."){

return value&&value.length
?value
:fallback;

},

set(id,value,fallback="Waiting..."){

const element=document.getElementById(id);

if(!element)return;

element.textContent=this.text(value,fallback);

},

select(card){

card
.parentElement
.querySelectorAll(".selected")
.forEach(item=>
item.classList.remove("selected")
);

card.classList.add("selected");

},

scrollTop(){

window.scrollTo({

top:0,

behavior:"smooth"

});

}

};


const Fields=[
"conversation",
"difficulty",
"outcome",
"future"
];


const BriefSchema={

conversation:{

summary:"summaryChallenge",

preview:"briefConversation",

placeholder:"Waiting for your thoughts...",

format:value=>value||""

},

difficulty:{

summary:"summaryDifficulty",

preview:"briefDifficulty",

placeholder:"Waiting...",

format:value=>
Helpers.difficultyLabels[value]||""

},

outcome:{

summary:"summaryOutcome",

preview:"briefOutcome",

placeholder:"Waiting...",

format:value=>
Helpers.outcomeLabels[value]||""

},

future:{

summary:"summaryFuture",

preview:"briefFuture",

placeholder:"We'll define this together.",

format:value=>
Helpers.futureLabels[value]||""

}

};


const Wizard={

init(){

UI.el.nextButtons.forEach(button=>{

button.addEventListener("click",()=>this.next());

});

UI.el.previousButtons.forEach(button=>{

button.addEventListener("click",()=>this.previous());

});

this.bindConversation();

Fields
.filter(field=>field!=="conversation")
.forEach(field=>this.bindOptions(field));

this.go(1);

},

bindConversation(){

if(!UI.el.challenge)return;

UI.el.challenge.addEventListener("input",event=>{

State.brief.conversation=
event.target.value.trim();

Events.emit("brief:changed");

});

},

bindOptions(field){

document
.querySelectorAll(`input[name="${field}"]`)
.forEach(input=>{

input.addEventListener("change",event=>{

State.brief[field]=event.target.value;

const card=
event.target.closest(".option-card");

if(card){

Helpers.select(card);

}

Events.emit("brief:changed");

});

});

},

move(direction){

const step=
State.step+direction;

if(step<1)return;

if(step>UI.el.screens.length)return;

this.go(step);

},

next(){

this.move(1);

},

previous(){

this.move(-1);

},

go(step){

State.step=step;

UI.el.screens.forEach(screen=>{

screen.classList.toggle(

"active",

Number(screen.dataset.step)===step

);

});

Events.emit("wizard:changed");

Helpers.scrollTop();

}

};


const Brief={

timeout:null,

init(){

Events.on(

"brief:changed",

()=>this.render()

);

Events.on(

"wizard:changed",

()=>{

this.render();

this.renderProgress();

this.renderReflection();

}

);

},

render(){

Fields.forEach(field=>{

const config=
BriefSchema[field];

if(!config)return;

const value=
config.format(
State.brief[field]
);

this.renderSection(
config,
value
);

});

},

renderSection(config,value){

Helpers.set(

config.summary,

value,

config.placeholder

);

Helpers.set(

config.preview,

value,

config.placeholder

);

},

renderProgress(){

UI.el.chapters.forEach((chapter,index)=>{

chapter.classList.toggle(

"completed",

index+1<State.step

);

chapter.classList.toggle(

"active",

index+1===State.step

);

});

},

renderReflection(){

if(State.step!==4)return;

const title=
document.getElementById("reflectionTitle");

const subtitle=
document.getElementById("reflectionSubtitle");

if(!title)return;

title.textContent=
"Reviewing your Opportunity Brief...";

clearTimeout(this.timeout);

this.timeout=
setTimeout(()=>{

title.textContent=
"Take a moment to review your Opportunity Brief.";

if(subtitle){

subtitle.textContent=
"Does it accurately describe the conversation your team needs to have before we meet?";

}

},600);

}

};


const API={

base:"/api",

async request(endpoint,options={}){

const response=

await fetch(

`${this.base}${endpoint}`,

{

headers:{

"Content-Type":"application/json"

},

...options

}

);

if(!response.ok){

throw new Error(

`API Error (${response.status})`

);

}

return await response.json();

},

availability(){

return this.request("/availability");

},

slots(day){

return this.request(

`/availability?day=${encodeURIComponent(day)}`

);

},

book(data){

return this.request(

"/booking",

{

method:"POST",

body:JSON.stringify(data)

}

);

}

};


const Scheduler={

async loadDays(){

State.days=

await API.availability();

Events.emit("calendar:days");

},

async loadSlots(){

if(!State.brief.day)return;

State.slots=

await API.slots(

State.brief.day

);

Events.emit("calendar:slots");

}

};


const Calendar={

init(){

Events.on(

"wizard:changed",

()=>{

if(State.step===6){

Scheduler.loadDays();

}

if(State.step===7){

Scheduler.loadSlots();

}

});

Events.on(

"calendar:days",

()=>this.renderDays()

);

Events.on(

"calendar:slots",

()=>this.renderSlots()

);

},

renderDays(){

if(!UI.el.dayGrid)return;

UI.el.dayGrid.innerHTML="";

State.days.forEach(day=>{

const card=

document.createElement("button");

card.type="button";

card.className="day-card";

card.innerHTML=`

<strong>${day.weekday}</strong>

<span>${day.date}</span>

`;

card.addEventListener(

"click",

()=>{

State.brief.day=

day.value;

UI.el.continueDay.disabled=false;

this.select(

UI.el.dayGrid,

card

);

Events.emit(

"brief:changed"

);

}

);

UI.el.dayGrid

.appendChild(card);

});

},

renderSlots(){

if(!UI.el.timeGrid)return;

UI.el.timeGrid.innerHTML="";

State.slots.forEach(slot=>{

const card=

document.createElement("button");

card.type="button";

card.className="time-card";

card.textContent=slot;

card.addEventListener(

"click",

()=>{

State.brief.time=slot;

UI.el.confirmBooking.disabled=false;

this.select(

UI.el.timeGrid,

card

);

Events.emit(

"brief:changed"

);

}

);

UI.el.timeGrid

.appendChild(card);

});

},

select(container,card){

container

.querySelectorAll(

".selected"

)

.forEach(item=>

item.classList.remove(

"selected"

)

);

card.classList.add(

"selected"

);

}

};


const Booking={

init(){

UI.el.confirmBooking

?.addEventListener(

"click",

()=>this.submit()

);

UI.el.closeSuccess

?.addEventListener(

"click",

()=>{

UI.el.modal.close();

}

);

},

async submit(){

const button=

UI.el.confirmBooking;

button.disabled=true;

button.textContent=

"Booking...";

try{

const booking=

await API.book({

brief:State.brief

});

State.brief.briefId=

booking.briefId;

State.bookingId=

booking.bookingId;

Wizard.go(8);

}

catch(error){

console.error(error);

button.disabled=false;

button.textContent=

"Book The Positioning Breakdown →";

alert(

"Something went wrong. Please try again."

);

}

}

};


const Modal={

init(){

document

.querySelectorAll(

"#bookBreakdownBtn,#footerBookBtn"

)

.forEach(button=>{

button.addEventListener(

"click",

()=>{

UI.el.modal.showModal();

Wizard.go(1);

}

);

});

document

.getElementById(

"closeModal"

)

?.addEventListener(

"click",

()=>{

UI.el.modal.close();

}

);

UI.el.modal

?.addEventListener(

"click",

event=>{

const rect=

UI.el.modal

.getBoundingClientRect();

if(

event.clientX<rect.left||

event.clientX>rect.right||

event.clientY<rect.top||

event.clientY>rect.bottom

){

UI.el.modal.close();

}

});

}

};


const App={

init(){

UI.cache();

Wizard.init();

Brief.init();

Calendar.init();

Booking.init();

Modal.init();

}

};



document.addEventListener(

"DOMContentLoaded",

()=>App.init()

);

})();