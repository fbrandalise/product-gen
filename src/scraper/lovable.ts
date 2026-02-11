import puppeteer, { type Page } from "puppeteer-core";
import type {
  ScrapedApp,
  ScrapedPage,
  ScrapedComponent,
  NavigationItem,
} from "../types/index.js";

const NAVIGATION_WAIT_MS = 3000;
const PAGE_LOAD_WAIT_MS = 5000;
const NAV_TIMEOUT_MS = 60000;
const NAV_RETRIES = 2;

/**
 * Detects a Chrome/Chromium executable path on the system.
 * Falls back to common locations if CHROME_PATH env is not set.
 */
function findChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];

  return candidates[0];
}

export async function scrapeLovableApp(url: string): Promise<ScrapedApp> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Load the initial page
    await navigateWithRetry(page, url);
    await delay(PAGE_LOAD_WAIT_MS);

    // Discover all internal routes from navigation and links
    const routes = await discoverRoutes(page, url);
    const uniqueRoutes = [...new Set([url, ...routes])];

    // Scrape each page
    const pages: ScrapedPage[] = [];
    for (const route of uniqueRoutes) {
      const scrapedPage = await scrapePage(page, route);
      pages.push(scrapedPage);
    }

    // Extract global navigation
    const navigation = await extractNavigation(page);

    return {
      baseUrl: url,
      pages,
      navigation,
      globalStyles: await extractGlobalStyles(page),
    };
  } finally {
    await browser.close();
  }
}

async function scrapePage(page: Page, url: string): Promise<ScrapedPage> {
  if (page.url() !== url) {
    await navigateWithRetry(page, url);
    await delay(NAVIGATION_WAIT_MS);
  }

  const title = await page.title();
  const html = await page.content();

  // Take a full-page screenshot as base64
  const screenshotBuffer = await page.screenshot({
    fullPage: true,
    encoding: "base64",
  });

  // Extract the component tree from the DOM
  const components = await page.evaluate(() => {
    function extractComponent(el: Element): ComponentData | null {
      if (
        el.tagName === "SCRIPT" ||
        el.tagName === "STYLE" ||
        el.tagName === "NOSCRIPT"
      ) {
        return null;
      }

      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        if (
          attr.name.startsWith("data-") ||
          attr.name === "role" ||
          attr.name === "aria-label" ||
          attr.name === "placeholder" ||
          attr.name === "type" ||
          attr.name === "href" ||
          attr.name === "src" ||
          attr.name === "alt"
        ) {
          attrs[attr.name] = attr.value;
        }
      }

      const children: ComponentData[] = [];
      for (const child of el.children) {
        const extracted = extractComponent(child);
        if (extracted) children.push(extracted);
      }

      // Get direct text content (not from children)
      let directText = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          directText += (node.textContent ?? "").trim();
        }
      }

      return {
        tag: el.tagName.toLowerCase(),
        classes: [...el.classList],
        text: directText.slice(0, 200),
        attributes: attrs,
        children,
      };
    }

    interface ComponentData {
      tag: string;
      classes: string[];
      text: string;
      attributes: Record<string, string>;
      children: ComponentData[];
    }

    const body = document.querySelector("body");
    if (!body) return [];

    const topLevel: ComponentData[] = [];
    for (const child of body.children) {
      const extracted = extractComponent(child);
      if (extracted) topLevel.push(extracted);
    }
    return topLevel;
  });

  // Extract all visible text
  const textContent = await page.evaluate(() => {
    return document.body?.innerText?.slice(0, 10000) ?? "";
  });

  // Discover routes from this page
  const routes = await discoverRoutes(page, url);

  return {
    url,
    title,
    html,
    screenshot: screenshotBuffer as string,
    components: components as ScrapedComponent[],
    routes,
    textContent,
  };
}

async function discoverRoutes(page: Page, baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;

  const links: string[] = await page.evaluate((orig: string) => {
    const anchors = document.querySelectorAll("a[href]");
    const hrefs: string[] = [];
    for (const a of anchors) {
      const href = (a as HTMLAnchorElement).href;
      if (href.startsWith(orig) && !href.includes("#")) {
        hrefs.push(href);
      }
    }
    return hrefs;
  }, origin);

  return [...new Set(links)];
}

async function extractNavigation(page: Page): Promise<NavigationItem[]> {
  return page.evaluate(() => {
    const nav =
      document.querySelector("nav") ??
      document.querySelector("[role='navigation']");
    if (!nav) return [];

    function extractItems(
      container: Element
    ): Array<{
      label: string;
      href: string;
      children: Array<{ label: string; href: string; children: never[] }>;
    }> {
      const items: Array<{
        label: string;
        href: string;
        children: Array<{ label: string; href: string; children: never[] }>;
      }> = [];
      const links = container.querySelectorAll("a");
      for (const link of links) {
        items.push({
          label: link.textContent?.trim() ?? "",
          href: link.getAttribute("href") ?? "",
          children: [],
        });
      }
      return items;
    }

    return extractItems(nav);
  });
}

async function extractGlobalStyles(page: Page): Promise<string> {
  return page.evaluate(() => {
    const styles: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (
            rule instanceof CSSStyleRule &&
            (rule.selectorText === ":root" ||
              rule.selectorText.startsWith("body") ||
              rule.selectorText.startsWith("html"))
          ) {
            styles.push(rule.cssText);
          }
        }
      } catch {
        // Cross-origin stylesheets will throw
      }
    }
    return styles.join("\n");
  });
}

/**
 * Navigate to a URL with retry logic and a lenient loading strategy.
 * First tries "networkidle2" (all requests settled); on timeout falls back to
 * "domcontentloaded" so that slow background requests don't block scraping.
 */
async function navigateWithRetry(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt <= NAV_RETRIES; attempt++) {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
      return;
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes("timeout");
      if (!isTimeout || attempt === NAV_RETRIES) throw err;

      // Retry with a more lenient wait strategy
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        // Give the SPA a moment to hydrate
        await delay(PAGE_LOAD_WAIT_MS);
        return;
      } catch {
        // Let the outer loop retry
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
