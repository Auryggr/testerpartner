export async function getAvailability(env) {
    return {
      days: [
        {
          date: "2026-07-28",
          slots: ["10:00", "11:00", "15:00"]
        },
        {
          date: "2026-07-29",
          slots: ["10:30", "14:00", "16:00"]
        }
      ]
    };
  }