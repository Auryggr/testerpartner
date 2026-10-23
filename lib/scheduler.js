import {
  getBusyPeriods
} from "./google-calendar.js";


const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 18;
/*
 * How many days of options to show, counted from the first
 * bookable moment (now + minimum notice).
 */
const DAYS_AHEAD = 7;


/*
 * Devuelve YYYY-MM-DD usando la zona horaria configurada.
 */
function getLocalDateString(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}


/*
 * Devuelve información de fecha/hora en la timezone configurada.
 */
function getDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    }
  ).formatToParts(date);

  return Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value
    ])
  );
}


/*
 * Convierte una fecha/hora local de Argentina
 * en un Date real.
 *
 * Para este MVP usamos -03:00 explícitamente porque
 * Buenos Aires actualmente no cambia por DST.
 */
function createBuenosAiresDate(
  dateString,
  hour,
  minute = 0
) {
  return new Date(
    `${dateString}T${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}:00-03:00`
  );
}


function addMinutes(date, minutes) {
  return new Date(
    date.getTime() + minutes * 60 * 1000
  );
}


function overlaps(
  startA,
  endA,
  startB,
  endB
) {
  return startA < endB && endA > startB;
}


function isWeekday(date, timeZone) {
  const weekday =
    getDateParts(date, timeZone).weekday;

  return !["Sat", "Sun"].includes(weekday);
}


function formatSlotTime(date, timeZone) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: false
    }
  ).format(date);
}


export async function getAvailability(
  env,
  { minNoticeMinutes = 0 } = {}
) {
  const timeZone =
    env.TIMEZONE ||
    "America/Argentina/Buenos_Aires";

  /*
   * SESSION_DURATION: how long each Mapping Session lasts.
   * SLOT_INTERVAL: how often a start time is offered.
   * 15-minute sessions offered every 30 minutes leave
   * 15 minutes between calls for notes and preparation.
   */
  const sessionDuration =
    Number(env.SESSION_DURATION || 15);

  const slotInterval =
    Number(env.SLOT_INTERVAL || 30);

  const bufferMinutes =
    Number(env.BUFFER_MINUTES || 15);

  const now = new Date();

  /*
   * Visitors can only book slots that start at least
   * minNoticeMinutes from now (48 h by default; 0 in QA mode).
   */
  const earliestStart =
    addMinutes(now, minNoticeMinutes);

  const daysToScan =
    DAYS_AHEAD +
    Math.ceil(minNoticeMinutes / (24 * 60));

  /*
   * Consultamos Google desde ahora hasta
   * 7 días en el futuro.
   */
  const rangeEnd =
    new Date(
      now.getTime() +
      daysToScan * 24 * 60 * 60 * 1000
    );

  const busyPeriods =
    await getBusyPeriods(
      env,
      now.toISOString(),
      rangeEnd.toISOString()
    );

  /*
   * Extendemos cada evento ocupado con buffer.
   *
   * Ejemplo:
   *
   * Calendar:
   * 14:00 → 15:00
   *
   * TesterPartner considera ocupado:
   * 13:45 → 15:15
   */
  const busyWithBuffer =
    busyPeriods.map((period) => ({
      start: addMinutes(
        new Date(period.start),
        -bufferMinutes
      ),

      end: addMinutes(
        new Date(period.end),
        bufferMinutes
      )
    }));


  const days = [];


  for (
    let offset = 0;
    offset < daysToScan;
    offset++
  ) {
    const candidateDate =
      new Date(
        now.getTime() +
        offset * 24 * 60 * 60 * 1000
      );

    if (
      !isWeekday(candidateDate, timeZone)
    ) {
      continue;
    }

    const dateString =
      getLocalDateString(
        candidateDate,
        timeZone
      );

    const dayStart =
      createBuenosAiresDate(
        dateString,
        DEFAULT_START_HOUR
      );

    const dayEnd =
      createBuenosAiresDate(
        dateString,
        DEFAULT_END_HOUR
      );


    const slots = [];


    /*
     * Un horario de inicio cada SLOT_INTERVAL minutos
     * (por defecto 30): 10:00, 10:30, 11:00…
     * Cada sesión dura SESSION_DURATION (por defecto 15).
     */
    for (
      let slotStart = dayStart;
      addMinutes(
        slotStart,
        sessionDuration
      ) <= dayEnd;
      slotStart =
        addMinutes(
          slotStart,
          slotInterval
        )
    ) {
      const slotEnd =
        addMinutes(
          slotStart,
          sessionDuration
        );


      /*
       * No mostramos horarios pasados.
       */
      if (slotStart < earliestStart || slotStart <= now) {
        continue;
      }


      /*
       * ¿Este slot toca algún evento
       * ocupado + buffer?
       */
      const conflict =
        busyWithBuffer.some(
          (busy) =>
            overlaps(
              slotStart,
              slotEnd,
              busy.start,
              busy.end
            )
        );


      if (conflict) {
        continue;
      }


      slots.push(
        formatSlotTime(
          slotStart,
          timeZone
        )
      );
    }


    if (slots.length) {
      days.push({
        date: dateString,
        slots
      });
    }
  }


  return {
    timezone: timeZone,
    sessionDuration,
    slotInterval,
    minNoticeHours: minNoticeMinutes / 60,
    bufferMinutes,
    days
  };
}