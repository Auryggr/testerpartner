document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================================================
     HERO QUESTION ROTATOR
     ========================================================= */

  const questions = Array.from(
    document.querySelectorAll(".rotating-question")
  );

  if (questions.length > 1) {
    let activeQuestion = questions.findIndex((item) =>
      item.classList.contains("active")
    );

    if (activeQuestion < 0) {
      activeQuestion = 0;
      questions[0].classList.add("active");
    }

    window.setInterval(() => {
      questions[activeQuestion].classList.remove("active");

      activeQuestion = (activeQuestion + 1) % questions.length;

      questions[activeQuestion].classList.add("active");
    }, 4500);
  }

  /* =========================================================
     POSITIONING BREAKDOWN MODAL
     ========================================================= */

  const modal = document.getElementById("breakdownModal");

  if (!modal) {
    console.error('TesterPartner: #breakdownModal was not found.');
    return;
  }

  const openButtons = document.querySelectorAll(".js-book-breakdown");
  const closeButton = document.getElementById("closeModal");
  const closeSuccessButton = document.getElementById("closeSuccess");

  const screens = Array.from(
    modal.querySelectorAll(".wizard-screen")
  );

  const dots = Array.from(
    modal.querySelectorAll(".progress-dots .dot")
  );

  const chapterNumber = modal.querySelector(".chapter-number");
  const chapterTitle = modal.querySelector(".chapter-title");

  const state = {
    step: 1,
    challenge: "",
    difficulty: "",
    outcome: "",
    future: "",
    meetingDay: "",
    meetingTime: "",
    availability: []
  };

  const chapterLabels = {
    1: ["01", "Your Challenge"],
    2: ["02", "Current Situation"],
    3: ["03", "Desired Outcome"],
    4: ["04", "Reflection"],
    5: ["05", "Looking Ahead"],
    6: ["06", "Choose a Day"],
    7: ["07", "Choose a Time"],
    8: ["08", "Booked"]
  };

  function showStep(step) {
    state.step = step;

    screens.forEach((screen) => {
      const screenStep = Number(screen.dataset.step);
      screen.classList.toggle("active", screenStep === step);
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle(
        "active",
        index <= Math.min(step - 1, dots.length - 1)
      );
    });

    const chapter = chapterLabels[step];

    if (chapterNumber && chapter) {
      chapterNumber.textContent = chapter[0];
    }

    if (chapterTitle && chapter) {
      chapterTitle.textContent = chapter[1];
    }

    if (step === 4) {
      renderReflection();
    }

    if (step === 6) {
      loadAvailability();
    }
  }

  function openModal() {
    showStep(1);

    if (typeof modal.showModal === "function") {
      if (!modal.open) {
        modal.showModal();
      }
    } else {
      modal.setAttribute("open", "");
    }

    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }

    document.body.style.overflow = "";
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", openModal);
  });

  closeButton?.addEventListener("click", closeModal);
  closeSuccessButton?.addEventListener("click", closeModal);

  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModal();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  /* =========================================================
     WIZARD
     ========================================================= */

  function selectedRadio(name) {
    return (
      modal.querySelector(`input[name="${name}"]:checked`)?.value || ""
    );
  }

  function validateStep(step) {
    if (step === 1) {
      const challenge =
        document.getElementById("challenge")?.value.trim() || "";

      if (challenge.length < 10) {
        window.alert(
          "Please share a little more about the conversation your team keeps having."
        );
        return false;
      }

      state.challenge = challenge;
    }

    if (step === 2) {
      state.difficulty = selectedRadio("difficulty");

      if (!state.difficulty) {
        window.alert(
          "Choose the option that best describes what makes the decision difficult."
        );
        return false;
      }
    }

    if (step === 3) {
      state.outcome = selectedRadio("outcome");

      if (!state.outcome) {
        window.alert(
          "Choose the outcome you would most like to leave with."
        );
        return false;
      }
    }

    if (step === 5) {
      state.future = selectedRadio("future");

      if (!state.future) {
        window.alert(
          "Choose what would ideally change after the Breakdown."
        );
        return false;
      }
    }

    if (step === 6 && !state.meetingDay) {
      window.alert("Choose an available day.");
      return false;
    }

    return true;
  }

  function renderReflection() {
    const summaryChallenge =
      document.getElementById("summaryChallenge");
    const summaryDifficulty =
      document.getElementById("summaryDifficulty");
    const summaryOutcome =
      document.getElementById("summaryOutcome");

    if (summaryChallenge) {
      summaryChallenge.textContent = state.challenge || "—";
    }

    if (summaryDifficulty) {
      summaryDifficulty.textContent = state.difficulty || "—";
    }

    if (summaryOutcome) {
      summaryOutcome.textContent = state.outcome || "—";
    }
  }

  modal.querySelectorAll(".next-step").forEach((button) => {
    button.addEventListener("click", () => {
      if (!validateStep(state.step)) {
        return;
      }

      showStep(Math.min(state.step + 1, 8));
    });
  });

  modal.querySelectorAll(".previous-step").forEach((button) => {
    button.addEventListener("click", () => {
      showStep(Math.max(state.step - 1, 1));
    });
  });

  /* =========================================================
     AVAILABILITY
     ========================================================= */

  const dayGrid = document.getElementById("dayGrid");
  const timeGrid = document.getElementById("timeGrid");
  const continueDay = document.getElementById("continueDay");
  const confirmBooking = document.getElementById("confirmBooking");

  async function loadAvailability() {
    if (!dayGrid) {
      return;
    }

    dayGrid.innerHTML =
      '<div class="availability-status">Loading availability…</div>';

    state.meetingDay = "";
    state.meetingTime = "";

    if (continueDay) {
      continueDay.disabled = true;
    }

    if (confirmBooking) {
      confirmBooking.disabled = true;
    }

    try {
      const response = await fetch("/api/availability", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `Availability request failed with ${response.status}`
        );
      }

      const payload = await response.json();

      const days =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload.days)
          ? payload.days
          : Array.isArray(payload.availability)
          ? payload.availability
          : [];

      state.availability = days;

      renderDays(days);
    } catch (error) {
      console.error("TesterPartner availability error:", error);

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
      date: day.date || day.day || day.start || "",
      label: day.label || "",
      slots:
        day.slots ||
        day.times ||
        day.availableTimes ||
        []
    };
  }

  function renderDays(rawDays) {
    if (!dayGrid) {
      return;
    }

    const days = rawDays
      .map(normalizeDay)
      .filter((day) => day.date);

    dayGrid.innerHTML = "";

    if (!days.length) {
      dayGrid.innerHTML =
        '<div class="availability-status">No available days were returned. Please check back soon.</div>';
      return;
    }

    days.forEach((day) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "day-option";
      button.dataset.date = day.date;

      let label = day.label;

      if (!label) {
        const parsedDate = new Date(`${day.date}T12:00:00`);

        label = Number.isNaN(parsedDate.getTime())
          ? day.date
          : new Intl.DateTimeFormat(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric"
            }).format(parsedDate);
      }

      button.textContent = label;

      button.addEventListener("click", () => {
        dayGrid
          .querySelectorAll(".day-option")
          .forEach((item) => item.classList.remove("selected"));

        button.classList.add("selected");

        state.meetingDay = day.date;
        state.meetingTime = "";

        renderTimes(day.slots);

        if (continueDay) {
          continueDay.disabled = false;
        }
      });

      dayGrid.appendChild(button);
    });
  }

  function renderTimes(rawSlots) {
    if (!timeGrid) {
      return;
    }

    timeGrid.innerHTML = "";

    if (confirmBooking) {
      confirmBooking.disabled = true;
    }

    const slots = Array.isArray(rawSlots)
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
          : slot.time ||
            slot.start ||
            slot.value ||
            slot.label ||
            "";

      const label =
        typeof slot === "object" && slot.label
          ? slot.label
          : value;

      if (!value) {
        return;
      }

      const button = document.createElement("button");

      button.type = "button";
      button.className = "time-option";
      button.textContent = label;

      button.addEventListener("click", () => {
        timeGrid
          .querySelectorAll(".time-option")
          .forEach((item) => item.classList.remove("selected"));

        button.classList.add("selected");

        state.meetingTime = value;

        if (confirmBooking) {
          confirmBooking.disabled = false;
        }
      });

      timeGrid.appendChild(button);
    });
  }

  /* =========================================================
     BOOKING
     ========================================================= */

  async function submitBooking() {
    if (!state.meetingDay || !state.meetingTime) {
      window.alert("Choose a time before booking.");
      return;
    }

    if (!confirmBooking) {
      return;
    }

    const previousText = confirmBooking.textContent;

    confirmBooking.disabled = true;
    confirmBooking.textContent = "Booking…";

    const payload = {
      conversation: state.challenge,
      difficulty: state.difficulty,
      outcome: state.outcome,
      future: state.future,
      meetingDay: state.meetingDay,
      meetingTime: state.meetingTime
    };

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            `Booking request failed with ${response.status}`
        );
      }

      showStep(8);
    } catch (error) {
      console.error("TesterPartner booking error:", error);

      window.alert(
        "We couldn’t complete the booking. Please try again."
      );

      confirmBooking.disabled = false;
      confirmBooking.textContent =
        previousText || "Book The Positioning Breakdown →";
    }
  }

  confirmBooking?.addEventListener("click", submitBooking);

  // Initial modal state
  showStep(1);
});