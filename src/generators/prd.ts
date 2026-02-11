import type { PRD } from "../types/index.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function writePRDToMarkdown(
  prd: PRD,
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const md = renderPRDMarkdown(prd);
  const filePath = join(outputDir, "PRD.md");
  await writeFile(filePath, md, "utf-8");
  return filePath;
}

export async function writePRDToJSON(
  prd: PRD,
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const filePath = join(outputDir, "prd.json");
  await writeFile(filePath, JSON.stringify(prd, null, 2), "utf-8");
  return filePath;
}

function renderPRDMarkdown(prd: PRD): string {
  const lines: string[] = [];

  lines.push(`# ${prd.title}`);
  lines.push("");
  lines.push("## 1. Overview");
  lines.push("");
  lines.push(prd.overview);
  lines.push("");

  lines.push("## 2. Objectives");
  lines.push("");
  for (const obj of prd.objectives) {
    lines.push(`- ${obj}`);
  }
  lines.push("");

  lines.push("## 3. Target Audience");
  lines.push("");
  lines.push(prd.targetAudience);
  lines.push("");

  lines.push("## 4. Features");
  lines.push("");
  for (const feature of prd.features) {
    lines.push(`### ${feature.id}: ${feature.name}`);
    lines.push("");
    lines.push(`**Priority:** ${feature.priority}`);
    lines.push("");
    lines.push(feature.description);
    lines.push("");

    if (feature.screens.length > 0) {
      lines.push("**Screens:**");
      for (const screen of feature.screens) {
        lines.push(`- ${screen}`);
      }
      lines.push("");
    }

    if (feature.businessRules.length > 0) {
      lines.push(
        `**Related Business Rules:** ${feature.businessRules.join(", ")}`
      );
      lines.push("");
    }

    if (feature.acceptanceCriteria.length > 0) {
      lines.push("**Acceptance Criteria:**");
      for (const ac of feature.acceptanceCriteria) {
        lines.push(`- ${ac}`);
      }
      lines.push("");
    }
  }

  lines.push("## 5. Business Rules");
  lines.push("");
  for (const rule of prd.businessRules) {
    lines.push(`### ${rule.id}: ${rule.name}`);
    lines.push("");
    lines.push(rule.description);
    lines.push("");

    if (rule.conditions.length > 0) {
      lines.push("**Conditions:**");
      for (const cond of rule.conditions) {
        lines.push(`- ${cond}`);
      }
      lines.push("");
    }

    if (rule.actions.length > 0) {
      lines.push("**Actions:**");
      for (const action of rule.actions) {
        lines.push(`- ${action}`);
      }
      lines.push("");
    }
  }

  lines.push("## 6. Non-Functional Requirements");
  lines.push("");
  for (const nfr of prd.nonFunctionalRequirements) {
    lines.push(`- ${nfr}`);
  }
  lines.push("");

  lines.push("## 7. Out of Scope");
  lines.push("");
  for (const oos of prd.outOfScope) {
    lines.push(`- ${oos}`);
  }
  lines.push("");

  lines.push("## 8. Success Metrics");
  lines.push("");
  for (const metric of prd.successMetrics) {
    lines.push(`- ${metric}`);
  }
  lines.push("");

  return lines.join("\n");
}
