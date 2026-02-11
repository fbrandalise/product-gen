import type { GeneratedFile, GeneratedProject } from "../types/index.js";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export async function writeGeneratedProject(
  filesJson: string,
  outputDir: string
): Promise<GeneratedProject> {
  const codeDir = join(outputDir, "code");
  await mkdir(codeDir, { recursive: true });

  let files: GeneratedFile[];
  try {
    files = JSON.parse(filesJson) as GeneratedFile[];
  } catch {
    // If Claude returns invalid JSON, wrap the raw code in a single file
    files = [
      {
        path: "src/App.vue",
        content: filesJson,
        description: "Generated application code",
      },
    ];
  }

  // Add scaffolding files that the AI might not generate
  const scaffoldFiles = getScaffoldFiles();
  const existingPaths = new Set(files.map((f) => f.path));
  for (const sf of scaffoldFiles) {
    if (!existingPaths.has(sf.path)) {
      files.push(sf);
    }
  }

  // Write all files
  for (const file of files) {
    const fullPath = join(codeDir, file.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, "utf-8");
  }

  const setupInstructions = `# Generated Vue 3 + PrimeVue Project

## Setup

\`\`\`bash
cd ${codeDir}
npm install
npm run dev
\`\`\`

## Project Structure

${files.map((f) => `- \`${f.path}\`: ${f.description}`).join("\n")}
`;

  const readmePath = join(codeDir, "README.md");
  await writeFile(readmePath, setupInstructions, "utf-8");

  return { files, setupInstructions };
}

function getScaffoldFiles(): GeneratedFile[] {
  return [
    {
      path: "package.json",
      description: "Project dependencies",
      content: JSON.stringify(
        {
          name: "generated-app",
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vue-tsc && vite build",
            preview: "vite preview",
          },
          dependencies: {
            vue: "^3.5.13",
            "vue-router": "^4.5.0",
            pinia: "^2.3.0",
            primevue: "^4.3.1",
            primeicons: "^7.0.0",
            "@primevue/themes": "^4.3.1",
          },
          devDependencies: {
            "@vitejs/plugin-vue": "^5.2.1",
            typescript: "^5.7.3",
            "vue-tsc": "^2.2.0",
            vite: "^6.1.0",
            tailwindcss: "^3.4.17",
            autoprefixer: "^10.4.20",
            postcss: "^8.4.49",
          },
        },
        null,
        2
      ),
    },
    {
      path: "vite.config.ts",
      description: "Vite configuration",
      content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
`,
    },
    {
      path: "tsconfig.json",
      description: "TypeScript configuration",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            module: "ESNext",
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: "force",
            noEmit: true,
            jsx: "preserve",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            paths: { "@/*": ["./src/*"] },
          },
          include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
        },
        null,
        2
      ),
    },
    {
      path: "index.html",
      description: "HTML entry point",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.ts",
      description: "Application entry point with PrimeVue setup",
      content: `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import router from './router'
import App from './App.vue'

import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.mount('#app')
`,
    },
    {
      path: "env.d.ts",
      description: "TypeScript env declarations",
      content: `/// <reference types="vite/client" />
`,
    },
  ];
}
