import { generateBriefId } from "./ids.js";

export function createBrief(data) {
  return {
    briefId: generateBriefId(),
    status: "Booked",
    createdAt: new Date().toISOString(),

    // --- conversación humana (sin cambios) ---
    conversation: data.conversation.trim(),
    difficulty: data.difficulty,
    outcome: data.outcome,
    future: data.future,

    companyType: normalizeCompanyType(data.companyType),

    researchStatus: "Pending"
  };
}

export function normalizeCompanyType(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();

  const map = {
    devtool: "DevTool",
    developer: "DevTool",
    "developer tool": "DevTool",
    api: "DevTool",
    sdk: "DevTool",

    consumer: "Consumer",
    "consumer product": "Consumer",
    physical: "Consumer",
    ecommerce: "Consumer",
    "e-commerce": "Consumer",

    saas: "SaaS",
    "b2b saas": "SaaS",
    software: "SaaS",
    platform: "SaaS",

    service: "Service",
    "local service": "Service",
    agency: "Service",
    consulting: "Service"
  };

  return map[v] || null;
}