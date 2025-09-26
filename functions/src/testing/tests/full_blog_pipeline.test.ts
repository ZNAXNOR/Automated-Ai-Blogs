import { fullBlogPipeline } from '../../full_blog_pipeline';
import * as R0 from '../../rounds/r0_trends';
import * as R1 from '../../rounds/r1_ideate';
import * as R2 from '../../rounds/r2_outline';
import * as R3 from '../../rounds/r3_draft';
import * as R4 from '../../rounds/r4_polish';
import * as R5 from '../../rounds/r5_meta';
import * as R6 from '../../rounds/r6_coherence';
import * as R7 from '../../rounds/r7_publish';

jest.mock('../../rounds/r0_trends');
jest.mock('../../rounds/r1_ideate');
jest.mock('../../rounds/r2_outline');
jest.mock('../../rounds/r3_draft');
jest.mock('../../rounds/r4_polish');
jest.mock('../../rounds/r5_meta');
jest.mock('../../rounds/r6_coherence');
jest.mock('../../rounds/r7_publish');

describe('fullBlogPipeline', () => {
  const runId = 'test-pipeline-run';
  const seeds = ['test-seed-1', 'test-seed-2'];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(30000);
  });

  test('should call all rounds in sequence', async () => {
    await fullBlogPipeline(runId, seeds);

    expect(R0.run).toHaveBeenCalledWith({ runId, seeds });
    expect(R1.run).toHaveBeenCalledWith({ runId });
    expect(R2.run).toHaveBeenCalledWith({ runId });
    expect(R3.run).toHaveBeenCalledWith({ runId });
    expect(R4.run).toHaveBeenCalledWith({ runId });
    expect(R5.run).toHaveBeenCalledWith({ runId });
    expect(R6.run).toHaveBeenCalledWith({ runId });
    expect(R7.run).toHaveBeenCalledWith({ runId });
  });
});
