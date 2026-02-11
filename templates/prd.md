# {{title}}

## 1. Overview
{{overview}}

## 2. Objectives
{{#each objectives}}
- {{this}}
{{/each}}

## 3. Target Audience
{{targetAudience}}

## 4. Features

{{#each features}}
### {{id}}: {{name}}

**Priority:** {{priority}}

{{description}}

**Screens:** {{#each screens}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

**Business Rules:** {{#each businessRules}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

**Acceptance Criteria:**
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}

{{/each}}

## 5. Business Rules

{{#each businessRules}}
### {{id}}: {{name}}

{{description}}

**Conditions:**
{{#each conditions}}
- {{this}}
{{/each}}

**Actions:**
{{#each actions}}
- {{this}}
{{/each}}

{{/each}}

## 6. Non-Functional Requirements
{{#each nonFunctionalRequirements}}
- {{this}}
{{/each}}

## 7. Out of Scope
{{#each outOfScope}}
- {{this}}
{{/each}}

## 8. Success Metrics
{{#each successMetrics}}
- {{this}}
{{/each}}
