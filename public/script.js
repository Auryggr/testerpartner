document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (selector, scope = document) =>
    scope.querySelector(selector);

  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  function normalizeWebsite(value) {
    let website = value.trim();

    if (!website) {
      return "";
    }

    if (
      !website.startsWith("http://") &&
      !website.startsWith("https://")
    ) {
      website = `https://${website}`;
    }

    try {
      const url = new URL(website);

      if (!url.hostname.includes(".")) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  /* =========================================================
     ANALYTICS EVENTS
     ---------------------------------------------------------
     Uses the gtag() function defined in /cookie-consent.js.
     Nothing reaches Google unless the visitor accepted
     analytics cookies. Never send names, emails, websites
     or the free-text challenge here.
     ========================================================= */

  function track(eventName, params = {}) {
    if (typeof window.gtag !== "function") {
      return;
    }

    try {
      window.gtag("event", eventName, params);
    } catch {
      /* Analytics must never break the booking flow. */
    }
  }

  /* =========================================================
     HERO QUESTION ROTATOR
     ========================================================= */

  const questions = $$(".rotating-question");

  if (questions.length > 1) {
    let activeQuestion = questions.findIndex((question) =>
      question.classList.contains("active")
    );

    if (activeQuestion < 0) {
      activeQuestion = 0;
      questions[0].classList.add("active");
    }

    window.setInterval(() => {
      questions[activeQuestion].classList.remove("active");

      activeQuestion =
        (activeQuestion + 1) % questions.length;

      questions[activeQuestion].classList.add("active");
    }, 4500);
  }

  /* =========================================================
     POSITIONING BREAKDOWN MODAL
     ========================================================= */

  const modal = $("#breakdownModal");

  if (!modal) {
    console.error(
      "TesterPartner: #breakdownModal was not found."
    );
    return;
  }

  const openButtons = $$(".js-book-breakdown");
  const closeButton = $("#closeModal");
  const closeSuccessButton = $("#closeSuccess");

  const screens = $$(".wizard-screen", modal);
  const dots = $$(".progress-dots .dot", modal);

  const chapterNumber = $(".chapter-number", modal);
  const chapterTitle = $(".chapter-title", modal);

  const dayGrid = $("#dayGrid");
  const timeGrid = $("#timeGrid");
  const continueDay = $("#continueDay");
  const confirmBooking = $("#confirmBooking");

  const state = {
    step: 1,

    challenge: "",
    difficulty: "",
    outcome: "",
    partnerType: "",
    clientWebsite: "",

    name: "",
    email: "",
    website: "",

    meetingDay: "",
    meetingTime: "",

    privacyAccepted: false,
    recordingConsent: false,
    marketingOptIn: false,

    availability: []
  };

  const chapterLabels = {
    1: ["01", "Your Challenge"],
    2: ["02", "Current Situation"],
    3: ["03", "Desired Outcome"],
    4: ["04", "Reflection"],
    5: ["05", "Your Details"],
    6: ["06", "Choose a Day"],
    7: ["07", "Choose a Time"],
    8: ["08", "Booked"]
  };

  /* =========================================================
     CONSENT DEFAULTS BY REGION
     ---------------------------------------------------------
     United States: recording + marketing start checked
     (allowed there; the recording is always confirmed again
     at the start of the call).
     Everywhere else, unknown country or Global Privacy
     Control: both start unchecked. The Privacy Policy box
     is never pre-checked.
     ========================================================= */

  const optionalConsentIds = ["consentRecording", "consentMarketing"];
  const touchedConsents = new Set();
  let consentDefaultsRequested = false;

  optionalConsentIds.forEach((id) => {
    $(`#${id}`)?.addEventListener("change", () => {
      touchedConsents.add(id);
    });
  });

  function applyConsentDefaults() {
    if (consentDefaultsRequested) {
      return;
    }

    consentDefaultsRequested = true;

    if (typeof window.tpGetRegion !== "function") {
      return;
    }

    window
      .tpGetRegion()
      .then((region) => {
        if (region?.mode !== "optout" || region?.gpc) {
          return;
        }

        optionalConsentIds.forEach((id) => {
          const checkbox = $(`#${id}`);

          // Never override a box the visitor already changed.
          if (checkbox && !touchedConsents.has(id)) {
            checkbox.checked = true;
          }
        });
      })
      .catch(() => {
        /* Unknown region: keep both unchecked. */
      });
  }

  function updateParticipantFields() {
    const isBrand = selectedRadio("partnerType") === "DTC / Ecommerce Brand";
    const clientField = $("#clientWebsiteField");
    const clientInput = $("#clientWebsite");
    const websiteLabel = $("#websiteLabel");
    const websiteInput = $("#website");
    if (clientField) clientField.hidden = isBrand;
    if (clientInput) clientInput.required = !isBrand;
    if (websiteLabel) websiteLabel.textContent = isBrand ? "Your brand website" : "Agency website";
    if (websiteInput) websiteInput.placeholder = isBrand ? "yourbrand.com" : "youragency.com";
  }
  $$("input[name='partnerType']", modal).forEach(input => {
    input.addEventListener("change", updateParticipantFields);
  });
  updateParticipantFields();

  /* =========================================================
     MODAL
     ========================================================= */

  function showStep(step) {
    state.step = step;

    screens.forEach((screen) => {
      const screenStep =
        Number(screen.dataset.step);

      screen.classList.toggle(
        "active",
        screenStep === step
      );
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle(
        "active",
        index <=
          Math.min(
            step - 1,
            dots.length - 1
          )
      );
    });

    const chapter =
      chapterLabels[step];

    if (chapterNumber && chapter) {
      chapterNumber.textContent =
        chapter[0];
    }

    if (chapterTitle && chapter) {
      chapterTitle.textContent =
        chapter[1];
    }

    if (step === 4) {
      renderReflection();
    }

    if (step === 5) {
      applyConsentDefaults();
    }

    if (step === 6) {
      loadAvailability();
    }

    track("breakdown_step_view", {
      step_number: step,
      step_name: chapter ? chapter[1] : String(step)
    });
  }

  function openModal(event) {
    const button = event?.currentTarget;

    track("breakdown_open", {
      cta_location:
        button?.dataset?.ctaLocation ||
        button?.textContent?.trim().slice(0, 60) ||
        "unknown"
    });

    showStep(1);

    if (
      typeof modal.showModal === "function"
    ) {
      if (!modal.open) {
        modal.showModal();
      }
    } else {
      modal.setAttribute("open", "");
    }

    document.body.style.overflow =
      "hidden";
  }

  function closeModal() {
    track("breakdown_close", {
      step_number: state.step,
      completed: state.step === 8
    });

    if (
      typeof modal.close === "function" &&
      modal.open
    ) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }

    document.body.style.overflow = "";
  }

  openButtons.forEach((button) => {
    button.addEventListener(
      "click",
      openModal
    );
  });

  closeButton?.addEventListener(
    "click",
    closeModal
  );

  closeSuccessButton?.addEventListener(
    "click",
    closeModal
  );

  modal.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeModal();
    }
  );

  modal.addEventListener(
    "click",
    (event) => {
      if (event.target === modal) {
        closeModal();
      }
    }
  );

  /* =========================================================
     WIZARD VALIDATION
     ========================================================= */

  function selectedRadio(name) {
    return (
      $(
        `input[name="${name}"]:checked`,
        modal
      )?.value || ""
    );
  }

  function validateStep(step) {
    if (step === 1) {
      const challenge =
        $("#challenge")?.value.trim() ||
        "";

      if (challenge.length < 10) {
        window.alert(
          "Please share a little more about the conversation your team keeps having."
        );

        return false;
      }

      state.challenge = challenge;
    }

    if (step === 2) {
      state.difficulty =
        selectedRadio("difficulty");

      if (!state.difficulty) {
        window.alert(
          "Choose the option that best describes what makes the decision difficult."
        );

        return false;
      }
    }

    if (step === 3) {
      state.outcome =
        selectedRadio("outcome");

      if (!state.outcome) {
        window.alert(
          "Choose the outcome you would most like to leave with."
        );

        return false;
      }
    }

    if (step === 5) {
      state.partnerType = selectedRadio("partnerType");
      if (!state.partnerType) {
        window.alert("Choose whether you’re joining as an agency or a brand.");
        return false;
      }

      const name =
        $("#name")?.value.trim() || "";

      const websiteInput =
        $("#website")?.value.trim() || "";

      if (!name) {
        window.alert(
          "Please enter your name."
        );

        $("#name")?.focus();

        return false;
      }

      const email =
  $("#email")?.value.trim() || "";

if (!email) {
  window.alert("Please enter your work email.");
  $("#email")?.focus();
  return false;
}

const emailIsValid =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

if (!emailIsValid) {
  window.alert("Please enter a valid email.");
  $("#email")?.focus();
  return false;
}

state.email = email;

      if (!websiteInput) {
        window.alert(
          "Please enter your company website."
        );

        $("#website")?.focus();

        return false;
      }

      const website =
        normalizeWebsite(
          websiteInput
        );

      if (!website) {
        window.alert(
          "Please enter a valid company website."
        );

        $("#website")?.focus();

        return false;
      }

      const isAgency = state.partnerType === "Agency";
      const clientInput = $("#clientWebsite")?.value.trim() || "";
      const clientWebsite = isAgency ? normalizeWebsite(clientInput) : website;
      if (isAgency && !clientWebsite) {
        window.alert("Enter a valid website for the client you selected.");
        $("#clientWebsite")?.focus();
        return false;
      }
      const privacyCheckbox = $("#consentPrivacy");

      if (privacyCheckbox && !privacyCheckbox.checked) {
        window.alert(
          "Please accept the Privacy Policy to book your session."
        );

        privacyCheckbox.focus();

        return false;
      }

      state.privacyAccepted = Boolean(privacyCheckbox?.checked);
      state.recordingConsent = Boolean($("#consentRecording")?.checked);
      state.marketingOptIn = Boolean($("#consentMarketing")?.checked);

      state.name = name;
      state.website = website;
      state.clientWebsite = clientWebsite;

      /*
       * Keep the normalized URL visible
       * when the user navigates back.
       */
      const websiteField =
        $("#website");

      if (websiteField) {
        websiteField.value =
          website;
      }
    }

    if (
      step === 6 &&
      !state.meetingDay
    ) {
      window.alert(
        "Choose an available day."
      );

      return false;
    }

    return true;
  }

  /* =========================================================
     REFLECTION
     ========================================================= */

  function renderReflection() {
    const summaryChallenge =
      $("#summaryChallenge");

    const summaryDifficulty =
      $("#summaryDifficulty");

    const summaryOutcome =
      $("#summaryOutcome");

    if (summaryChallenge) {
      summaryChallenge.textContent =
        state.challenge || "—";
    }

    if (summaryDifficulty) {
      summaryDifficulty.textContent =
        state.difficulty || "—";
    }

    if (summaryOutcome) {
      summaryOutcome.textContent =
        state.outcome || "—";
    }
  }

  /* =========================================================
     WIZARD NAVIGATION
     ========================================================= */

  $$(".next-step", modal).forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          if (
            !validateStep(
              state.step
            )
          ) {
            return;
          }

          showStep(
            Math.min(
              state.step + 1,
              8
            )
          );
        }
      );
    }
  );

  $$(".previous-step", modal).forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          showStep(
            Math.max(
              state.step - 1,
              1
            )
          );
        }
      );
    }
  );

  /* =========================================================
     AVAILABILITY
     ========================================================= */

  async function loadAvailability() {
    if (!dayGrid) {
      return;
    }

    dayGrid.innerHTML =
      '<div class="availability-status">Loading availability…</div>';

    if (timeGrid) {
      timeGrid.innerHTML = "";
    }

    state.meetingDay = "";
    state.meetingTime = "";

    if (continueDay) {
      continueDay.disabled = true;
    }

    if (confirmBooking) {
      confirmBooking.disabled = true;
    }

    try {
      const response =
        await fetch(
          "/api/availability",
          {
            method: "GET",
            headers: {
              Accept:
                "application/json"
            }
          }
        );

      const payload =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
          `Availability request failed with ${response.status}`
        );
      }

      /*
       * Supports the current API:
       *
       * {
       *   success: true,
       *   data: {
       *     days: [...]
       *   }
       * }
       *
       * plus previous response shapes.
       */
      const days =
        Array.isArray(
          payload?.data?.days
        )
          ? payload.data.days
          : Array.isArray(
              payload?.days
            )
          ? payload.days
          : Array.isArray(
              payload?.availability
            )
          ? payload.availability
          : [];

      state.availability =
        days;

      renderDays(days);
    } catch (error) {
      console.error(
        "TesterPartner availability error:",
        error
      );

      track("availability_error");

      dayGrid.innerHTML =
        '<div class="availability-status">We couldn’t load availability right now. Please refresh and try again.</div>';
    }
  }

  function normalizeDay(day) {
    if (typeof day === "string") {
      return {
        date: day,
        label: "",
        slots: []
      };
    }

    return {
      date:
        day?.date ||
        day?.day ||
        day?.start ||
        "",

      label:
        day?.label || "",

      slots:
        day?.slots ||
        day?.times ||
        day?.availableTimes ||
        []
    };
  }

  function renderDays(rawDays) {
    if (!dayGrid) {
      return;
    }

    const days =
      rawDays
        .map(normalizeDay)
        .filter(
          (day) => day.date
        );

    dayGrid.innerHTML = "";

    if (!days.length) {
      dayGrid.innerHTML =
        '<div class="availability-status">No available days were returned. Please check back soon.</div>';

      return;
    }

    days.forEach((day) => {
      const button =
        document.createElement(
          "button"
        );

      button.type = "button";
      button.className =
        "day-option";

      button.dataset.date =
        day.date;

      let label = day.label;

      if (!label) {
        const parsedDate =
          new Date(
            `${day.date}T12:00:00`
          );

        label =
          Number.isNaN(
            parsedDate.getTime()
          )
            ? day.date
            : new Intl.DateTimeFormat(
                undefined,
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric"
                }
              ).format(
                parsedDate
              );
      }

      button.textContent = label;

      button.addEventListener(
        "click",
        () => {
          $$(
            ".day-option",
            dayGrid
          ).forEach(
            (item) =>
              item.classList.remove(
                "selected"
              )
          );

          button.classList.add(
            "selected"
          );

          state.meetingDay =
            day.date;

          state.meetingTime = "";

          renderTimes(
            day.slots
          );

          if (continueDay) {
            continueDay.disabled =
              false;
          }
        }
      );

      dayGrid.appendChild(
        button
      );
    });
  }

  function renderTimes(rawSlots) {
    if (!timeGrid) {
      return;
    }

    timeGrid.innerHTML = "";

    if (confirmBooking) {
      confirmBooking.disabled =
        true;
    }

    const slots =
      Array.isArray(rawSlots)
        ? rawSlots
        : [];

    if (!slots.length) {
      timeGrid.innerHTML =
        '<div class="availability-status">No available times were returned for this day.</div>';

      return;
    }

    slots.forEach((slot) => {
      const value =
        typeof slot === "string"
          ? slot
          : slot?.time ||
            slot?.start ||
            slot?.value ||
            slot?.label ||
            "";

      const label =
        typeof slot === "object" &&
        slot?.label
          ? slot.label
          : value;

      if (!value) {
        return;
      }

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";
      button.className =
        "time-option";

      button.textContent =
        label;

      button.addEventListener(
        "click",
        () => {
          $$(
            ".time-option",
            timeGrid
          ).forEach(
            (item) =>
              item.classList.remove(
                "selected"
              )
          );

          button.classList.add(
            "selected"
          );

          state.meetingTime =
            value;

          if (confirmBooking) {
            confirmBooking.disabled =
              false;
          }
        }
      );

      timeGrid.appendChild(
        button
      );
    });
  }

  /* =========================================================
     BOOKING
     ========================================================= */

  async function submitBooking() {
    if (
      !state.meetingDay ||
      !state.meetingTime
    ) {
      window.alert(
        "Choose a time before booking."
      );

      return;
    }

    if (!confirmBooking) {
      return;
    }

    const previousText =
      confirmBooking.textContent;

    confirmBooking.disabled = true;
    confirmBooking.textContent =
      "Booking…";

    const payload = {
      conversation:
        state.challenge,

      difficulty:
        state.difficulty,

      outcome:
        state.outcome,

      partnerType: state.partnerType,
      clientWebsite: state.clientWebsite,

      name:
        state.name,
        
      email:
       state.email,

      website:
        state.website,

      meetingDay:
        state.meetingDay,

      meetingTime:
        state.meetingTime,

      privacyAccepted:
        state.privacyAccepted,

      recordingConsent:
        state.recordingConsent,

      marketingOptIn:
        state.marketingOptIn
    };

    try {
      const response =
        await fetch(
          "/api/booking",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          result.message ||
          `Booking request failed with ${response.status}`
        );
      }

      console.log(
        "TesterPartner booking created:",
        result
      );

      /*
       * GA4 recommended event for a completed lead.
       * Form answers (difficulty, outcome, challenge) are NOT sent:
       * they stay in our own booking records.
       */
      track("generate_lead", {
        lead_source: "positioning_breakdown",
        partner_type: state.partnerType
      });

      showStep(8);
    } catch (error) {
      console.error(
        "TesterPartner booking error:",
        error
      );

      track("booking_error");

      /*
       * Show the actual backend error.
       * This is especially useful while
       * we're still developing the MVP.
       */
      window.alert(
        error.message ||
        "We couldn’t complete the booking. Please try again."
      );

      confirmBooking.disabled =
        false;

      confirmBooking.textContent =
        previousText ||
        "Book the Mapping Session →";
    }
  }

  confirmBooking?.addEventListener(
    "click",
    submitBooking
  );

  /* =========================================================
     INITIAL STATE
     ========================================================= */

  showStep(1);
});