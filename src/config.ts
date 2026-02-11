import "dotenv/config";
import type { AppConfig } from "./types/index.js";

export function loadConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required. Set it in .env or as environment variable.");
  }

  return {
    anthropicApiKey,
    jira: {
      baseUrl: process.env.JIRA_BASE_URL ?? "",
      email: process.env.JIRA_EMAIL ?? "",
      apiToken: process.env.JIRA_API_TOKEN ?? "",
      projectKey: process.env.JIRA_PROJECT_KEY ?? "",
    },
    outputDir: process.env.OUTPUT_DIR ?? "./output",
  };
}

export function validateJiraConfig(config: AppConfig): boolean {
  const { jira } = config;
  return !!(jira.baseUrl && jira.email && jira.apiToken && jira.projectKey);
}
