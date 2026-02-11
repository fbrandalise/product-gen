// ── Scraper types ──

export interface ScrapedPage {
  url: string;
  title: string;
  html: string;
  screenshot: string; // base64 encoded PNG
  components: ScrapedComponent[];
  routes: string[];
  textContent: string;
}

export interface ScrapedComponent {
  tag: string;
  classes: string[];
  text: string;
  attributes: Record<string, string>;
  children: ScrapedComponent[];
}

export interface ScrapedApp {
  baseUrl: string;
  pages: ScrapedPage[];
  navigation: NavigationItem[];
  globalStyles: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  children: NavigationItem[];
}

// ── PRD types ──

export interface PRD {
  title: string;
  overview: string;
  objectives: string[];
  targetAudience: string;
  features: Feature[];
  businessRules: BusinessRule[];
  nonFunctionalRequirements: string[];
  outOfScope: string[];
  successMetrics: string[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: "must-have" | "should-have" | "nice-to-have";
  screens: string[];
  businessRules: string[]; // references to BusinessRule.id
  acceptanceCriteria: string[];
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  actions: string[];
}

// ── User Story types ──

export interface UserStory {
  id: string;
  epic: string;
  title: string;
  description: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: "highest" | "high" | "medium" | "low" | "lowest";
  storyPoints: number;
  labels: string[];
  featureId: string; // reference to Feature.id
  subtasks: Subtask[];
}

export interface Subtask {
  title: string;
  description: string;
}

export interface Epic {
  name: string;
  description: string;
  stories: UserStory[];
}

// ── Jira types ──

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface JiraIssue {
  key: string;
  id: string;
  self: string;
}

export interface JiraCreateResponse {
  epics: JiraIssue[];
  stories: JiraIssue[];
  subtasks: JiraIssue[];
}

// ── Code Generation types ──

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface GeneratedProject {
  files: GeneratedFile[];
  setupInstructions: string;
}

// ── Config types ──

export interface AppConfig {
  anthropicApiKey: string;
  jira: JiraConfig;
  outputDir: string;
}

// ── Pipeline types ──

export interface PipelineResult {
  scrapedApp: ScrapedApp;
  prd: PRD;
  epics: Epic[];
  jiraResult?: JiraCreateResponse;
  generatedProject: GeneratedProject;
}
