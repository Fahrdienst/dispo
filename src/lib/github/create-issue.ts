import "server-only"

interface CreateGithubIssueInput {
  title: string
  body: string
  labels: string[]
}

export interface GithubIssueResult {
  number: number
  html_url: string
}

/**
 * Create a GitHub issue via the REST API using the native `fetch`.
 *
 * Requires the following environment variables:
 * - `GITHUB_ISSUES_TOKEN` — a fine-grained PAT with "Issues: write" on the repo.
 * - `GITHUB_ISSUES_REPO`  — the target repo in `owner/name` form.
 *
 * Throws a human-readable error on any misconfiguration or non-2xx response.
 * The token is never included in thrown error messages.
 */
export async function createGithubIssue(
  input: CreateGithubIssueInput
): Promise<GithubIssueResult> {
  const token = process.env.GITHUB_ISSUES_TOKEN
  const repo = process.env.GITHUB_ISSUES_REPO

  if (!token) {
    throw new Error("GITHUB_ISSUES_TOKEN ist nicht konfiguriert")
  }
  if (!repo) {
    throw new Error("GITHUB_ISSUES_REPO ist nicht konfiguriert")
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      labels: input.labels,
    }),
    // Issue creation must never be cached.
    cache: "no-store",
  })

  if (!response.ok) {
    // Surface GitHub's error message for server logs, but keep it token-free.
    let detail = ""
    try {
      const data = (await response.json()) as { message?: unknown }
      if (typeof data.message === "string") {
        detail = data.message
      }
    } catch {
      // Ignore JSON parse errors — the status code is enough context.
    }

    throw new Error(
      `GitHub-Issue konnte nicht erstellt werden (HTTP ${response.status})` +
        (detail ? `: ${detail}` : "")
    )
  }

  const data = (await response.json()) as {
    number?: unknown
    html_url?: unknown
  }

  if (typeof data.number !== "number" || typeof data.html_url !== "string") {
    throw new Error("Unerwartete Antwort von der GitHub-API")
  }

  return { number: data.number, html_url: data.html_url }
}
