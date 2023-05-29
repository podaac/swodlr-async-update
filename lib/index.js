import {L2RasterProduct, Status} from '@podaac/swodlr-db-models';
import * as State from './state.js';
import * as SDSStatuses from './sds_statuses.js';
import utils from './utils.js';

const logger = utils.getLogger(import.meta.url);
const sequelize = utils.sequelize;
const validateJobset = await utils.loadJsonSchema('jobset');

/**
 * The main entrypoint into the lambda
 * @param {object} event the event from SQS
 */
export async function lambdaHandler(event) {
  logger.debug(`Records received: ${event['Records'].length}`);

  let jobs = [];
  for (const record of event['Records']) {
    const jobset = JSON.parse(record['body']);
    if (validateJobset(jobset)) {
      jobs = jobs.concat(jobset['jobs']);
    } else {
      logger.error('Jobset failed to validate');
      logger.debug(`Failed jobset: ${JSON.stringify(jobset)}`);
    }
  }

  for (const job of jobs) {
    const jobStatus = job['job_status'];
    if (SDSStatuses.WAITING.has(jobStatus)) {
      continue;
    }

    const product = await L2RasterProduct.findByPk(job['product_id']);
    if (product === null) {
      logger.error(`Product id not found - ${job['product_id']}`);
      continue;
    }

    let state; let reason;
    if (SDSStatuses.FAIL.has(jobStatus)) {
      state = State.ERROR;
      reason = `SDS job failed - please contact support`;
    } else if (SDSStatuses.SUCCESS.has(jobStatus)) {
      if (job['stage'] == 'submit_evaluate') {
        state = State.GENERATING;
      } else if (job['stage'] === 'submit_raster') {
        state = State.READY;
      } else {
        state = State.ERROR;
        reason = 'Unknown job stage - please contact support';
      }
    } else {
      state = State.ERROR;
      reason = 'Unknown job state - please contact support';
    }

    await sequelize.transaction(async (t) => {
      const status = await Status.create({
        timestamp: Date.now(),
        state,
        reason,
      }, {transaction: t});
      await status.setL2RasterProduct(product, {transaction: t});
    });

    // TODO: Add staging locations to database schema
  }
}
