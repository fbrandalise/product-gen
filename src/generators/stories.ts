import type { Epic } from "../types/index.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function writeStoriesToMarkdown(
  epics: Epic[],
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const md = renderStoriesMarkdown(epics);
  const filePath = join(outputDir, "USER_STORIES.md");
  await writeFile(filePath, md, "utf-8");
  return filePath;
}

export async function writeStoriesToJSON(
  epics: Epic[],
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const filePath = join(outputDir, "user_stories.json");
  await writeFile(filePath, JSON.stringify(epics, null, 2), "utf-8");
  return filePath;
}

function renderStoriesMarkdown(epics: Epic[]): string {
  const lines: string[] = [];

  lines.push("# User Stories");
  lines.push("");

  let totalStories = 0;
  let totalPoints = 0;

  for (const epic of epics) {
    totalStories += epic.stories.length;
    totalPoints += epic.stories.reduce((sum, s) => sum + s.storyPoints, 0);
  }

  lines.push(`> **${epics.length} Epics** | **${totalStories} Stories** | **${totalPoints} Story Points**`);
  lines.push("");

  for (const epic of epics) {
    const epicPoints = epic.stories.reduce((sum, s) => sum + s.storyPoints, 0);
    lines.push(`## Epic: ${epic.name}`);
    lines.push("");
    lines.push(epic.description);
    lines.push("");
    lines.push(
      `> ${epic.stories.length} stories | ${epicPoints} story points`
    );
    lines.push("");

    for (const story of epic.stories) {
      lines.push(`### ${story.id}: ${story.title}`);
      lines.push("");
      lines.push(
        `**Priority:** ${story.priority} | **Points:** ${story.storyPoints} | **Feature:** ${story.featureId}`
      );
      lines.push("");
      lines.push(
        `> As a **${story.asA}**, I want **${story.iWant}**, so that **${story.soThat}**.`
      );
      lines.push("");
      lines.push(story.description);
      lines.push("");

      if (story.acceptanceCriteria.length > 0) {
        lines.push("**Acceptance Criteria:**");
        for (const ac of story.acceptanceCriteria) {
          lines.push(`- [ ] ${ac}`);
        }
        lines.push("");
      }

      if (story.subtasks.length > 0) {
        lines.push("**Subtasks:**");
        for (const sub of story.subtasks) {
          lines.push(`- [ ] **${sub.title}**: ${sub.description}`);
        }
        lines.push("");
      }

      if (story.labels.length > 0) {
        lines.push(`**Labels:** ${story.labels.map((l) => `\`${l}\``).join(", ")}`);
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}
