(() => {
    "use strict";
  
    const modal = document.getElementById("breakdownModal");
    const screens = Array.from(document.querySelectorAll(".wizard-screen"));
    const dots = Array.from(document.querySelectorAll(".progress-dots .dot"));
    const chapterNumber = document.querySelector(".chapter-number");
    const chapterTitle = document.querySelector(".chapter-title");
  
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
  
    const chapters = {
      1: ["01", "Your Challenge"],
      2: ["02", "Current Situation"],
      3: ["03", "Desired Outcome"],
      4: ["04", "Reflection"],
      5: ["05", "Looking Ahead"],
      6: ["06", "Choose a Day"],
      7: ["07", "Choose a Time"],
      8: ["08", "Booked"]
    };
  
    function openModal() {
      if (!modal) return;
  
      if (typeof modal.showModal === "function") {
        modal.showModal();
      } else {
        modal.setAttribute("open", "");
      }
  
      showStep(1);
    }
  
    function closeModal() {
      if (!modal) return;
  
      if (typeof modal.close === "function") {
        modal.close();
      } else {
        modal.removeAttribute("open");
      }
    }
  
    function showStep(step) {
      state.step = step;
  
      screens.forEach((screen) => {
        screen.classList.toggle(
          "active",
          Number(screen.dataset.step) === step
        );
      });
  
      dots.forEach((dot, index) => {
        dot.classList.toggle(
          "active",
          index <= Math.min(step - 1, dots.length - 1)
        );
      });
  
      const chapter = chapters[step];
  
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
  
    function selectedRadio(name) {
      return (
        document.querySelector(
          `input[name="${name}"]:checked`
        )?.value || ""
      );
    }
  
    function validateStep(step) {
      if (step === 1) {
        const challenge =
          document.getElementById("challenge")?.value.trim() || "";
  
        if (challenge.length < 10) {
          alert(
            "Please share a little more about the conversation your team keeps having."
          );
  
          return false;
        }
  
        state.challenge = challenge;
      }
  
      if (step === 2) {
        state.difficulty = selectedRadio("difficulty");
  
        if (!state.difficulty) {
          alert(
            "Choose the option that best describes what makes the decision difficult."
          );
  
          return false;
        }
      }
  
      if (step === 3) {
        state.outcome = selectedRadio("outcome");
  
        if (!state.outcome) {
          alert(
            "Choose the outcome you would most like to leave with."
          );
  
          return false;
        }
      }
  
      if (step === 5) {
        state.future = selectedRadio("future");
  
        if (!state.future) {
          alert(
            "Choose what would ideally change after the Breakdown."
          );
  
          return false;
        }
      }
  
      if (step === 6 && !state.meetingDay) {
        alert("Choose an available day.");
  
        return false;
      }
  
      return true;
    }
  
    function renderReflection() {
      const challenge =
        document.getElementById("summaryChallenge");
  
      const difficulty =
        document.getElementById("summaryDifficulty");
  
      const outcome =
        document.getElementById("summaryOutcome");
  
      if (challenge) {
        challenge.textContent =
          state.challenge || "—";
      }
  
      if (difficulty) {
        difficulty.textContent =
          state.difficulty || "—";
      }
  
      if (outcome) {
        outcome.textContent =
          state.outcome || "—";
      }
    }
  
    async function loadAvailability() {
      const dayGrid =
        document.getElementById("dayGrid");
  
      const continueDay =
        document.getElementById("continueDay");
  
      if (!dayGrid) return;
  
      dayGrid.innerHTML =
        '<div class="availability-status">Loading availability…</div>';
  
      if (continueDay) {
        continueDay.disabled = true;
      }
  
      try {
        const response = await fetch(
          "/api/availability",
          {
            headers: {
              Accept: "application/json"
            }
          }
        );
  
        if (!response.ok) {
          throw new Error(
            `Availability request failed: ${response.status}`
          );
        }
  
        const data = await response.json();
  
        const rawDays =
          Array.isArray(data)
            ? data
            : Array.isArray(data.days)
            ? data.days
            : Array.isArray(data.availability)
            ? data.availability
            : [];
  
        state.availability = rawDays;
  
        renderDays(rawDays);
      } catch (error) {
        console.error(error);
  
        dayGrid.innerHTML =
          '<div class="availability-status">We couldn’t load availability right now. Please refresh and try again.</div>';
      }
    }
  
    function normalizeDay(item) {
      if (typeof item === "string") {
        return {
          date: item,
          slots: []
        };
      }
  
      return {
        date:
          item.date ||
          item.day ||
          item.start ||
          "",
  
        label:
          item.label ||
          "",
  
        slots:
          item.slots ||
          item.times ||
          item.availableTimes ||
          []
      };
    }
  
    function renderDays(rawDays) {
      const dayGrid =
        document.getElementById("dayGrid");
  
      if (!dayGrid) return;
  
      const days = rawDays
        .map(normalizeDay)
        .filter((day) => day.date);
  
      if (!days.length) {
        dayGrid.innerHTML =
          '<div class="availability-status">No available days were returned. Please check back soon.</div>';
  
        return;
      }
  
      dayGrid.innerHTML = "";
  
      days.forEach((day) => {
        const button =
          document.createElement("button");
  
        button.type = "button";
        button.className = "day-option";
        button.dataset.date = day.date;
  
        const date =
          new Date(`${day.date}T12:00:00`);
  
        const label =
          day.label ||
          new Intl.DateTimeFormat(
            undefined,
            {
              weekday: "short",
              month: "short",
              day: "numeric"
            }
          ).format(date);
  
        button.textContent = label;
  
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(".day-option")
              .forEach((element) => {
                element.classList.remove("selected");
              });
  
            button.classList.add("selected");
  
            state.meetingDay = day.date;
            state.meetingTime = "";
  
            renderTimes(day.slots);
  
            const continueDay =
              document.getElementById("continueDay");
  
            if (continueDay) {
              continueDay.disabled = false;
            }
          }
        );
  
        dayGrid.appendChild(button);
      });
    }
  
    function renderTimes(slots) {
      const timeGrid =
        document.getElementById("timeGrid");
  
      const confirm =
        document.getElementById("confirmBooking");
  
      if (!timeGrid) return;
  
      const values =
        Array.isArray(slots)
          ? slots
          : [];
  
      timeGrid.innerHTML = "";
  
      if (confirm) {
        confirm.disabled = true;
      }
  
      if (!values.length) {
        timeGrid.innerHTML =
          '<div class="availability-status">No available times were returned for this day.</div>';
  
        return;
      }
  
      values.forEach((slot) => {
        const value =
          typeof slot === "string"
            ? slot
            : slot.time ||
              slot.label ||
              slot.start ||
              "";
  
        if (!value) return;
  
        const button =
          document.createElement("button");
  
        button.type = "button";
        button.className = "time-option";
  
        button.textContent =
          typeof slot === "object" &&
          slot.label
            ? slot.label
            : value;
  
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(".time-option")
              .forEach((element) => {
                element.classList.remove("selected");
              });
  
            button.classList.add("selected");
  
            state.meetingTime = value;
  
            if (confirm) {
              confirm.disabled = false;
            }
          }
        );
  
        timeGrid.appendChild(button);
      });
    }
  
    async function submitBooking() {
      if (
        !state.meetingDay ||
        !state.meetingTime
      ) {
        alert(
          "Choose a time before booking."
        );
  
        return;
      }
  
      const confirm =
        document.getElementById(
          "confirmBooking"
        );
  
      const originalText =
        confirm?.textContent;
  
      if (confirm) {
        confirm.disabled = true;
        confirm.textContent =
          "Booking…";
      }
  
      const payload = {
        conversation: state.challenge,
        difficulty: state.difficulty,
        outcome: state.outcome,
        future: state.future,
        meetingDay: state.meetingDay,
        meetingTime: state.meetingTime
      };
  
      try {
        const response = await fetch(
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
              JSON.stringify(payload)
          }
        );
  
        const data =
          await response
            .json()
            .catch(() => ({}));
  
        if (!response.ok) {
          throw new Error(
            data.error ||
            data.message ||
            `Booking failed: ${response.status}`
          );
        }
  
        showStep(8);
      } catch (error) {
        console.error(error);
  
        alert(
          "We couldn’t complete the booking. Please try again."
        );
  
        if (confirm) {
          confirm.disabled = false;
  
          confirm.textContent =
            originalText ||
            "Book The Positioning Breakdown →";
        }
      }
    }
  
    document
      .querySelectorAll(
        ".js-book-breakdown"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          openModal
        );
      });
  
    document
      .getElementById("closeModal")
      ?.addEventListener(
        "click",
        closeModal
      );
  
    document
      .getElementById("closeSuccess")
      ?.addEventListener(
        "click",
        closeModal
      );
  
    modal?.addEventListener(
      "click",
      (event) => {
        if (event.target === modal) {
          closeModal();
        }
      }
    );
  
    document
      .querySelectorAll(".next-step")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            if (!validateStep(state.step)) {
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
      });
  
    document
      .querySelectorAll(
        ".previous-step"
      )
      .forEach((button) => {
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
      });
  
    document
      .getElementById(
        "confirmBooking"
      )
      ?.addEventListener(
        "click",
        submitBooking
      );
  
    const questions =
      Array.from(
        document.querySelectorAll(
          ".rotating-question"
        )
      );
  
    if (questions.length > 1) {
      let activeQuestion = 0;
  
      setInterval(() => {
        questions[
          activeQuestion
        ].classList.remove("active");
  
        activeQuestion =
          (activeQuestion + 1) %
          questions.length;
  
        questions[
          activeQuestion
        ].classList.add("active");
      }, 4500);
    }
  })();