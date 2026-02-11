#!/usr/bin/env node

// Disable SSL certificate verification for corporate proxies / self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Polyfill for esbuild/tsx compatibility with puppeteer
// @ts-expect-error -- __name is injected by esbuild but missing at runtime
globalThis.__name ??= (target: unknown) => target;

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, validateJiraConfig } from "./config.js";
import { scrapeLovableApp } from "./scraper/lovable.js";
import {
  createClient,
  analyzeAppForPRD,
  generateUserStories,
  generateVueCode,
  formatOpenAIError,
} from "./analyzer/claude.js";
import { writePRDToMarkdown, writePRDToJSON } from "./generators/prd.js";
import {
  writeStoriesToMarkdown,
  writeStoriesToJSON,
} from "./generators/stories.js";
import { writeGeneratedProject } from "./generators/code.js";
import { JiraClient } from "./integrations/jira.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const program = new Command();

program
  .name("product-gen")
  .description(
    "Generate PRDs, user stories, and Vue 3 + PrimeVue code from Lovable prototypes"
  )
  .version("1.0.0");

// ── Main pipeline command ──

program
  .command("generate")
  .description("Run the full pipeline: scrape → PRD → stories → code → Jira")
  .requiredOption("-u, --url <url>", "Lovable app URL to scrape")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("--skip-jira", "Skip Jira integration")
  .option("--skip-code", "Skip code generation")
  .option("--skip-scrape", "Skip scraping (use cached scrape data)")
  .action(async (opts) => {
    const config = loadConfig();
    const outputDir = opts.output;
    await mkdir(outputDir, { recursive: true });

    const client = createClient(config.openaiApiKey);

    // Step 1: Scrape
    let scrapedApp;
    if (opts.skipScrape) {
      const spinner = ora("Loading cached scrape data...").start();
      try {
        const cached = await import(
          join(process.cwd(), outputDir, "scraped_app.json"),
          { with: { type: "json" } }
        );
        scrapedApp = cached.default;
        spinner.succeed("Loaded cached scrape data");
      } catch {
        spinner.fail("No cached scrape data found. Run without --skip-scrape first.");
        process.exit(1);
      }
    } else {
      const spinner = ora(
        `Scraping Lovable app at ${chalk.cyan(opts.url)}...`
      ).start();
      try {
        scrapedApp = await scrapeLovableApp(opts.url);
        // Save scraped data for reuse
        await writeFile(
          join(outputDir, "scraped_app.json"),
          JSON.stringify(scrapedApp, null, 2),
          "utf-8"
        );
        spinner.succeed(
          `Scraped ${scrapedApp.pages.length} pages successfully`
        );
      } catch (err) {
        spinner.fail(`Scraping failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    // Step 2: Generate PRD
    let prd;
    {
      const spinner = ora("Analyzing app and generating PRD...").start();
      try {
        prd = await analyzeAppForPRD(client, scrapedApp);
        const mdPath = await writePRDToMarkdown(prd, outputDir);
        await writePRDToJSON(prd, outputDir);
        spinner.succeed(
          `PRD generated: ${chalk.green(mdPath)} (${prd.features.length} features, ${prd.businessRules.length} business rules)`
        );
      } catch (err) {
        spinner.fail(`PRD generation failed: ${formatOpenAIError(err)}`);
        process.exit(1);
      }
    }

    // Step 3: Generate User Stories
    let epics;
    {
      const spinner = ora("Breaking PRD into user stories...").start();
      try {
        epics = await generateUserStories(client, prd);
        const mdPath = await writeStoriesToMarkdown(epics, outputDir);
        await writeStoriesToJSON(epics, outputDir);
        const totalStories = epics.reduce(
          (sum, e) => sum + e.stories.length,
          0
        );
        spinner.succeed(
          `User stories generated: ${chalk.green(mdPath)} (${epics.length} epics, ${totalStories} stories)`
        );
      } catch (err) {
        spinner.fail(
          `Story generation failed: ${formatOpenAIError(err)}`
        );
        process.exit(1);
      }
    }

    // Step 4: Push to Jira
    if (!opts.skipJira) {
      if (!validateJiraConfig(config)) {
        console.log(
          chalk.yellow(
            "⚠ Jira credentials not configured. Skipping Jira integration."
          )
        );
        console.log(
          chalk.dim("  Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env")
        );
      } else {
        const spinner = ora("Creating issues in Jira...").start();
        try {
          const jira = new JiraClient(config.jira);
          const result = await jira.createAllFromEpics(epics);
          spinner.succeed(
            `Jira issues created: ${result.epics.length} epics, ${result.stories.length} stories, ${result.subtasks.length} subtasks`
          );
        } catch (err) {
          spinner.fail(`Jira sync failed: ${(err as Error).message}`);
          console.log(chalk.dim("  PRD and stories were saved locally."));
        }
      }
    }

    // Step 5: Generate Code
    if (!opts.skipCode) {
      const spinner = ora(
        "Generating Vue 3 + PrimeVue code..."
      ).start();
      try {
        const codeJson = await generateVueCode(client, prd, scrapedApp);
        const project = await writeGeneratedProject(codeJson, outputDir);
        spinner.succeed(
          `Code generated: ${chalk.green(join(outputDir, "code"))} (${project.files.length} files)`
        );
      } catch (err) {
        spinner.fail(
          `Code generation failed: ${formatOpenAIError(err)}`
        );
      }
    }

    // Summary
    console.log("");
    console.log(chalk.bold("Pipeline complete! Output:"));
    console.log(`  PRD:          ${chalk.cyan(join(outputDir, "PRD.md"))}`);
    console.log(
      `  User Stories: ${chalk.cyan(join(outputDir, "USER_STORIES.md"))}`
    );
    if (!opts.skipCode) {
      console.log(
        `  Code:         ${chalk.cyan(join(outputDir, "code/"))}`
      );
    }
    console.log(
      `  JSON data:    ${chalk.cyan(join(outputDir, "prd.json"))}, ${chalk.cyan(join(outputDir, "user_stories.json"))}`
    );
  });

// ── Scrape-only command ──

program
  .command("scrape")
  .description("Only scrape a Lovable app and save the data")
  .requiredOption("-u, --url <url>", "Lovable app URL")
  .option("-o, --output <dir>", "Output directory", "./output")
  .action(async (opts) => {
    await mkdir(opts.output, { recursive: true });

    const spinner = ora(
      `Scraping ${chalk.cyan(opts.url)}...`
    ).start();
    try {
      const app = await scrapeLovableApp(opts.url);
      const outPath = join(opts.output, "scraped_app.json");
      await writeFile(outPath, JSON.stringify(app, null, 2), "utf-8");
      spinner.succeed(
        `Scraped ${app.pages.length} pages → ${chalk.green(outPath)}`
      );
    } catch (err) {
      spinner.fail(`Scraping failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── PRD-only command ──

program
  .command("prd")
  .description("Generate PRD from previously scraped data")
  .option("-o, --output <dir>", "Output directory", "./output")
  .action(async (opts) => {
    const config = loadConfig();
    const client = createClient(config.openaiApiKey);

    const spinner = ora("Loading scraped data...").start();
    let scrapedApp;
    try {
      const cached = await import(
        join(process.cwd(), opts.output, "scraped_app.json"),
        { with: { type: "json" } }
      );
      scrapedApp = cached.default;
      spinner.succeed("Loaded scraped data");
    } catch {
      spinner.fail(
        "No scraped data found. Run 'product-gen scrape' first."
      );
      process.exit(1);
    }

    const prdSpinner = ora("Generating PRD...").start();
    try {
      const prd = await analyzeAppForPRD(client, scrapedApp);
      const mdPath = await writePRDToMarkdown(prd, opts.output);
      await writePRDToJSON(prd, opts.output);
      prdSpinner.succeed(`PRD generated: ${chalk.green(mdPath)}`);
    } catch (err) {
      prdSpinner.fail(`Failed: ${formatOpenAIError(err)}`);
      process.exit(1);
    }
  });

// ── Jira-only command ──

program
  .command("jira")
  .description("Push user stories to Jira from previously generated data")
  .option("-o, --output <dir>", "Output directory", "./output")
  .action(async (opts) => {
    const config = loadConfig();

    if (!validateJiraConfig(config)) {
      console.error(
        chalk.red(
          "Jira credentials not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env"
        )
      );
      process.exit(1);
    }

    const spinner = ora("Loading user stories...").start();
    let epics;
    try {
      const cached = await import(
        join(process.cwd(), opts.output, "user_stories.json"),
        { with: { type: "json" } }
      );
      epics = cached.default;
      spinner.succeed("Loaded user stories");
    } catch {
      spinner.fail(
        "No user stories found. Run 'product-gen generate' first."
      );
      process.exit(1);
    }

    const jiraSpinner = ora("Creating Jira issues...").start();
    try {
      const jira = new JiraClient(config.jira);
      const result = await jira.createAllFromEpics(epics);
      jiraSpinner.succeed(
        `Created: ${result.epics.length} epics, ${result.stories.length} stories, ${result.subtasks.length} subtasks`
      );
    } catch (err) {
      jiraSpinner.fail(`Failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
