import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedApp, PRD, Epic } from "../types/index.js";

const MODEL = "claude-sonnet-4-20250514";

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export async function analyzeAppForPRD(
  client: Anthropic,
  app: ScrapedApp
): Promise<PRD> {
  const pagesDescription = app.pages
    .map(
      (p) =>
        `## Page: ${p.title} (${p.url})\n\nVisible text:\n${p.textContent}\n\nRoutes found: ${p.routes.join(", ")}`
    )
    .join("\n\n---\n\n");

  const navDescription = app.navigation
    .map((n) => `- ${n.label}: ${n.href}`)
    .join("\n");

  // Build messages with screenshots
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `You are a senior product manager. Analyze the following web application scraped from a Lovable prototype and generate a comprehensive PRD (Product Requirements Document).

The app has ${app.pages.length} pages. Here is the content:

### Navigation
${navDescription || "No navigation detected"}

### Pages
${pagesDescription}

### Global Styles
${app.globalStyles || "None extracted"}

Generate a PRD in the following JSON format. Be thorough with business rules - infer them from the UI patterns, forms, validations, and workflows visible in the app.

{
  "title": "string",
  "overview": "string - comprehensive product overview",
  "objectives": ["string - business objectives"],
  "targetAudience": "string",
  "features": [
    {
      "id": "F-001",
      "name": "string",
      "description": "string - detailed feature description",
      "priority": "must-have | should-have | nice-to-have",
      "screens": ["page URLs where this feature appears"],
      "businessRules": ["BR-001"],
      "acceptanceCriteria": ["Given/When/Then format"]
    }
  ],
  "businessRules": [
    {
      "id": "BR-001",
      "name": "string",
      "description": "string",
      "conditions": ["when X"],
      "actions": ["then Y"]
    }
  ],
  "nonFunctionalRequirements": ["string"],
  "outOfScope": ["string"],
  "successMetrics": ["string"]
}

Respond ONLY with the JSON, no markdown fences.`,
    },
  ];

  // Add screenshots for each page (up to 5 to stay within limits)
  for (const page of app.pages.slice(0, 5)) {
    if (page.screenshot) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: page.screenshot,
        },
      });
      contentBlocks.push({
        type: "text",
        text: `Screenshot of: ${page.title} (${page.url})`,
      });
    }
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as PRD;
}

export async function generateUserStories(
  client: Anthropic,
  prd: PRD
): Promise<Epic[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a senior product manager breaking a PRD into epics and user stories for a development team.

Here is the PRD:
${JSON.stringify(prd, null, 2)}

Generate epics and user stories in the following JSON format. Each story should be small enough for a single sprint. Use story points (Fibonacci: 1, 2, 3, 5, 8, 13). Include detailed acceptance criteria.

[
  {
    "name": "Epic Name",
    "description": "Epic description",
    "stories": [
      {
        "id": "US-001",
        "epic": "Epic Name",
        "title": "Short descriptive title",
        "description": "Detailed description of the story",
        "asA": "role",
        "iWant": "action",
        "soThat": "benefit",
        "acceptanceCriteria": [
          "Given X, When Y, Then Z"
        ],
        "priority": "highest | high | medium | low | lowest",
        "storyPoints": 3,
        "labels": ["frontend", "backend", "api", "ui"],
        "featureId": "F-001",
        "subtasks": [
          {
            "title": "Subtask title",
            "description": "What needs to be done"
          }
        ]
      }
    ]
  }
]

Respond ONLY with the JSON array, no markdown fences.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as Epic[];
}

export async function generateVueCode(
  client: Anthropic,
  prd: PRD,
  app: ScrapedApp
): Promise<string> {
  const pagesContext = app.pages
    .map((p) => `Page "${p.title}": ${p.textContent.slice(0, 2000)}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a senior Vue.js developer. Generate a Vue 3 + PrimeVue project structure based on the following PRD and app analysis.

PRD:
${JSON.stringify(prd, null, 2)}

App pages context:
${pagesContext}

Generate a JSON array of files for a Vue 3 project using:
- Vue 3 with Composition API and <script setup>
- PrimeVue 4 as the component library
- Vue Router for navigation
- Pinia for state management
- TypeScript

Each file should be:
[
  {
    "path": "src/components/ExampleComponent.vue",
    "content": "full file content here",
    "description": "What this file does"
  }
]

Include:
1. Main App.vue with router-view
2. Router configuration matching the app's navigation
3. Vue components for each screen/feature
4. Pinia stores for state management
5. TypeScript interfaces for data models
6. PrimeVue component usage (DataTable, Dialog, Button, InputText, etc.)

Use PrimeVue's unstyled mode with Tailwind CSS for custom styling.

Respond ONLY with the JSON array, no markdown fences.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return text;
}
