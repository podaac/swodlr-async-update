import {jest} from '@jest/globals';
import {L2RasterProduct, Status} from '@podaac/swodlr-db-models';
import {Sequelize} from 'sequelize';
import {loadTestData} from './utils';

/* --- Mocks --- */
jest.unstable_mockModule('@aws-sdk/client-ssm', () => ({
  SSM: jest.fn(() => ({
    getParametersByPath: jest.fn(() => ({
      Parameters: [],
    })),
  })),
}));

Sequelize.prototype.transaction = jest.fn(async (fn) =>
  await fn(),
);

L2RasterProduct.findByPk = jest.fn((pk) =>
  new L2RasterProduct({id: pk}),
);

Status.prototype.setL2RasterProduct = jest.fn();
Status.create = jest.fn((values) =>
  new Status(values),
);

/* --- Tests --- */
const {lambdaHandler} = await import('../lib');

const failedData = await loadTestData('failed');
const successEvaluateData = await loadTestData('success_evaluate');
const successRasterData = await loadTestData('success_raster');
const waitingData = await loadTestData('waiting');

test('submit a failed job', async () => {
  await lambdaHandler(failedData, null);

  expect(Sequelize.prototype.transaction).toHaveBeenCalledTimes(1);
  expect(Status.create).toHaveBeenCalledTimes(1);

  expect(Status.create.mock.calls[0][0]).toMatchObject({
    productId: '9834b3aa-d3d1-49fa-b8ec-a4482e80c8be',
    state: 'ERROR',
    reason: 'SDS job failed - please contact support',
  });
});

test('submit a successful evaluate job', async () => {
  await lambdaHandler(successEvaluateData, null);

  expect(Sequelize.prototype.transaction).toHaveBeenCalledTimes(1);
  expect(Status.create).toHaveBeenCalledTimes(1);

  expect(Status.create.mock.calls[0][0]).toMatchObject({
    productId: 'a38e973a-cc85-4389-a680-b1d84287322d',
    state: 'GENERATING',
    reason: undefined,
  });
});

test('submit a successful raster job', async () => {
  await lambdaHandler(successRasterData, null);

  expect(Sequelize.prototype.transaction).toHaveBeenCalledTimes(1);
  expect(Status.create).toHaveBeenCalledTimes(1);

  expect(Status.create.mock.calls[0][0]).toMatchObject({
    productId: 'af541198-e12d-4410-9b20-767b13550042',
    state: 'READY',
    reason: undefined,
  });
});

test('submit a waiting job', async () => {
  await lambdaHandler(waitingData, null);
  expect(Sequelize.prototype.transaction).toHaveBeenCalledTimes(0);
});
