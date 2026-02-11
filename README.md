# product-gen

CLI tool to accelerate product development by converting Lovable prototypes into structured PRDs, Jira user stories, and Vue 3 + PrimeVue code.

## Pipeline

```
Lovable URL → Scrape → Claude Analysis → PRD → User Stories → Jira + Code
```

1. **Scrape** - Puppeteer navigates the Lovable app, captures screenshots, extracts DOM structure, text, and routes
2. **PRD Generation** - Claude analyzes the scraped data (including screenshots) and produces a structured PRD with features, business rules, and acceptance criteria
3. **User Stories** - Claude breaks the PRD into epics and stories with story points, subtasks, and detailed acceptance criteria
4. **Jira Integration** - Creates epics, stories, and subtasks in Jira Cloud via REST API
5. **Code Generation** - Generates a Vue 3 + PrimeVue project with components, router, stores, and TypeScript types

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `JIRA_BASE_URL` | For Jira | e.g. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | For Jira | Your Atlassian account email |
| `JIRA_API_TOKEN` | For Jira | [Create API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | For Jira | e.g. `PROJ` |

## Usage

### Full pipeline

```bash
npx tsx src/index.ts generate -u https://your-app.lovable.app
```

### Individual steps

```bash
# Scrape only
npx tsx src/index.ts scrape -u https://your-app.lovable.app

# Generate PRD from scraped data
npx tsx src/index.ts prd

# Push stories to Jira
npx tsx src/index.ts jira
```

### Options

| Flag | Description | Default |
|---|---|---|
| `-u, --url` | Lovable app URL | Required |
| `-o, --output` | Output directory | `./output` |
| `--skip-jira` | Skip Jira integration | `false` |
| `--skip-code` | Skip code generation | `false` |
| `--skip-scrape` | Use cached scrape data | `false` |

## Output Structure

```
output/
├── scraped_app.json      # Raw scrape data (reusable)
├── PRD.md                # Product Requirements Document
├── prd.json              # PRD as structured JSON
├── USER_STORIES.md       # Formatted user stories
├── user_stories.json     # Stories as structured JSON
└── code/                 # Generated Vue 3 + PrimeVue project
    ├── package.json
    ├── src/
    │   ├── main.ts
    │   ├── App.vue
    │   ├── router/
    │   ├── stores/
    │   ├── components/
    │   └── views/
    └── ...
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Scraping**: Puppeteer
- **AI**: Claude (Anthropic API)
- **Jira**: Atlassian REST API v3
- **Output**: Vue 3, PrimeVue 4, Pinia, Vue Router, Tailwind CSS
