# {{id}}: {{title}}

**Epic:** {{epic}}
**Priority:** {{priority}} | **Points:** {{storyPoints}} | **Feature:** {{featureId}}
**Labels:** {{#each labels}}`{{this}}`{{#unless @last}} {{/unless}}{{/each}}

## User Story

> As a **{{asA}}**, I want **{{iWant}}**, so that **{{soThat}}**.

## Description

{{description}}

## Acceptance Criteria

{{#each acceptanceCriteria}}
- [ ] {{this}}
{{/each}}

## Subtasks

{{#each subtasks}}
- [ ] **{{title}}**: {{description}}
{{/each}}
