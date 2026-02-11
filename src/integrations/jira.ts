import type {
  JiraConfig,
  JiraIssue,
  JiraCreateResponse,
  Epic,
  UserStory,
} from "../types/index.js";

interface JiraField {
  id: string;
  name: string;
  schema?: { type: string; custom?: string };
}

export class JiraClient {
  private baseUrl: string;
  private auth: string;
  private projectKey: string;
  private epicNameFieldId: string | null = null;
  private storyPointsFieldId: string | null = null;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.auth = Buffer.from(`${config.email}:${config.apiToken}`).toString(
      "base64"
    );
    this.projectKey = config.projectKey;
  }

  async initialize(): Promise<void> {
    // Discover custom field IDs for Epic Name and Story Points
    const fields = await this.request<JiraField[]>("/rest/api/3/field");

    for (const field of fields) {
      if (
        field.name === "Epic Name" ||
        field.schema?.custom?.includes("gh-epic-label")
      ) {
        this.epicNameFieldId = field.id;
      }
      if (
        field.name === "Story Points" ||
        field.name === "Story point estimate" ||
        field.schema?.custom?.includes("story-point")
      ) {
        this.storyPointsFieldId = field.id;
      }
    }
  }

  async createAllFromEpics(epics: Epic[]): Promise<JiraCreateResponse> {
    await this.initialize();

    const result: JiraCreateResponse = {
      epics: [],
      stories: [],
      subtasks: [],
    };

    for (const epic of epics) {
      // Create Epic
      const epicIssue = await this.createEpic(epic.name, epic.description);
      result.epics.push(epicIssue);

      // Create Stories under the Epic
      for (const story of epic.stories) {
        const storyIssue = await this.createStory(story, epicIssue.key);
        result.stories.push(storyIssue);

        // Create Subtasks under the Story
        for (const subtask of story.subtasks) {
          const subtaskIssue = await this.createSubtask(
            subtask.title,
            subtask.description,
            storyIssue.key
          );
          result.subtasks.push(subtaskIssue);
        }
      }
    }

    return result;
  }

  private async createEpic(
    name: string,
    description: string
  ): Promise<JiraIssue> {
    const fields: Record<string, unknown> = {
      project: { key: this.projectKey },
      summary: name,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
      issuetype: { name: "Epic" },
    };

    if (this.epicNameFieldId) {
      fields[this.epicNameFieldId] = name;
    }

    // Must be set after dynamic field assignments to avoid being overwritten
    fields.customfield_10015 = todayISO();

    return this.request<JiraIssue>("/rest/api/3/issue", {
      method: "POST",
      body: { fields },
    });
  }

  private async createStory(
    story: UserStory,
    epicKey: string
  ): Promise<JiraIssue> {
    const description = [
      `**As a** ${story.asA}`,
      `**I want** ${story.iWant}`,
      `**So that** ${story.soThat}`,
      "",
      story.description,
      "",
      "## Acceptance Criteria",
      ...story.acceptanceCriteria.map((ac) => `- ${ac}`),
    ].join("\n");

    const fields: Record<string, unknown> = {
      project: { key: this.projectKey },
      summary: story.title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
      issuetype: { name: "Story" },
      priority: { name: mapPriority(story.priority) },
      labels: story.labels,
      parent: { key: epicKey },
    };

    if (this.storyPointsFieldId) {
      fields[this.storyPointsFieldId] = story.storyPoints;
    }

    // Must be set after dynamic field assignments to avoid being overwritten
    fields.customfield_10015 = todayISO();

    return this.request<JiraIssue>("/rest/api/3/issue", {
      method: "POST",
      body: { fields },
    });
  }

  private async createSubtask(
    title: string,
    description: string,
    parentKey: string
  ): Promise<JiraIssue> {
    const fields: Record<string, unknown> = {
      project: { key: this.projectKey },
      summary: title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
      issuetype: { name: "Sub-task" },
      parent: { key: parentKey },
      customfield_10015: todayISO(),
    };

    return this.request<JiraIssue>("/rest/api/3/issue", {
      method: "POST",
      body: { fields },
    });
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(
        `Jira API error (${resp.status}): ${errorText}`
      );
    }

    return resp.json() as Promise<T>;
  }
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10); // "yyyy-MM-dd"
}

function mapPriority(
  priority: "highest" | "high" | "medium" | "low" | "lowest"
): string {
  const mapping: Record<string, string> = {
    highest: "Highest",
    high: "High",
    medium: "Medium",
    low: "Low",
    lowest: "Lowest",
  };
  return mapping[priority] ?? "Medium";
}
