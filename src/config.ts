import "dotenv/config";
import type { AppConfig } from "./types/index.js";

export function loadConfig(): AppConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required. Set it in .env or as environment variable.");
  }

  return {
    openaiApiKey,
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
