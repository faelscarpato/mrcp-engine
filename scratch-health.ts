import { calculateCodeHealth } from './packages/core/lib/analysis/code-health.js';

async function main() {
  console.log('Calculating health...');
  const result = await calculateCodeHealth({ repoUrl: '.' });
  console.log(`Maintainability Index: ${result.maintainabilityIndex}`);
  console.log(`God Modules Count: ${result.summary.godModulesCount}`);
  console.log(`Top Priorities:`);
  console.log(JSON.stringify(result.topRefactoringPriorities, null, 2));
}

main().catch(console.error);
