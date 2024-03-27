import {L2RasterProduct, Status, Granule} from '@podaac/swodlr-db-models';
import * as State from './state.js';
import * as SDSStatuses from './sds_statuses.js';
import utils from './utils.js';

const logger = utils.getLogger(import.meta.url);
const sequelize = utils.sequelize;
const validateJob = await utils.loadJsonSchema('job');

/**
 * The main entrypoint into the lambda
 * @param {object} event the event from SQS
 */
export async function lambdaHandler(event) {
  logger.debug(`Records received: ${event['Records'].length}`);

  const jobs = [];
  for (const record of event['Records']) {
    const job = JSON.parse(record['body']);
    if (validateJob(job)) {
      jobs.push(job);
    } else {
      logger.error('Jobset failed to validate');
      logger.error(JSON.stringify(validateJob.errors));
      logger.debug(`Failed job: ${JSON.stringify(job)}`);
    }
  }

  for (const job of jobs) {
    const jobStatus = job['job_status'];
    if (SDSStatuses.WAITING.has(jobStatus)) {
      logger.debug(`Waiting status (noop): product_id: ${job['product_id']}`);
      continue;
    }

    const product = await L2RasterProduct.findByPk(job['product_id']);
    if (product === null) {
      logger.error(`Product id not found: ${job['product_id']}`);
      continue;
    }

    let state; let reason;
    if (SDSStatuses.FAIL.has(jobStatus)) {
      state = State.ERROR;
      reason = 'SDS job failed - please contact support';
    } else if (SDSStatuses.SUCCESS.has(jobStatus)) {
      if (job['stage'] === 'submit_evaluate') {
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
      const status = {
        productId: product.id,
        timestamp: Date.now(),
        state,
        reason,
      };

      logger.info(`Creating status: ${JSON.stringify(status)}`);
      await Status.create(status, {transaction: t});

      if (Array.isArray(job['granules'])) {
        for (const uri of job['granules']) {
          const granule = {
            productId: product.id,
            timestamp: Date.now(),
            uri,
          };

          logger.info(`Creating granule: ${JSON.stringify(granule)}`);
          await Granule.create(granule, {transaction: t});
        }
      }
    });
  }
}
