const GITHUB_API = "https://api.github.com";

function getDispatchConfig(env) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_RESEARCH_REPO } = env;
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is missing.");
  if (!GITHUB_OWNER) throw new Error("GITHUB_OWNER is missing.");
  if (!GITHUB_RESEARCH_REPO) throw new Error("GITHUB_RESEARCH_REPO is missing.");
  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_RESEARCH_REPO
  };
}

export async function triggerResearch(env, brief) {
  const { token, owner, repo } = getDispatchConfig(env);

  const url = `${GITHUB_API}/repos/${owner}/${repo}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      // GitHub exige User-Agent en todas las requests a su API.
      "User-Agent": "testerpartner-cloudflare"
    },
    body: JSON.stringify({
      event_type: "run-research",
      // client_payload llega al workflow como github.event.client_payload
      client_payload: {
        briefId: brief.briefId,
        website: brief.website || null,
        companyType: brief.companyType || null
      }
    })
  });

  if (response.status === 204) {
    return { ok: true };
  }

  // Cualquier otra cosa es un fallo: leemos el detalle para diagnóstico.
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = `HTTP ${response.status}`;
  }
  throw new Error(
    `repository_dispatch failed (${response.status}): ${detail.slice(0, 300)}`
  );
}

export async function triggerResearchSafe(env, brief) {
  try {
    await triggerResearch(env, brief);
    return { dispatched: true };
  } catch (err) {
    // No rompemos la confirmación de reserva del cliente por esto.
    console.error("Research dispatch failed, will rely on backup poll:", err);
    return { dispatched: false, error: String(err) };
  }
}