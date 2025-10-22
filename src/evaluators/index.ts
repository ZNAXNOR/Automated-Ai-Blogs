// Ensure every prompt file is imported so its registration runs
import './evaluateAll.evaluator';
import './humanization.evaluator'
import './metadata.evaluator';
import './readability.evaluator';
import './seo.evaluator';

// Optionally export prompt references
export { evaluateAllEvaluator } from './evaluateAll.evaluator';
export { HumanizationEvaluator } from './humanization.evaluator';
export { MetadataEvaluator } from './metadata.evaluator';
export { ReadabilityEvaluator } from './readability.evaluator';
export { SEOEvaluator } from './seo.evaluator';

console.log('[Evaluators]     All evaluator modules registered');
