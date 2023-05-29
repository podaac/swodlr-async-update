import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv/dist/2020';
import {SSM} from '@aws-sdk/client-ssm';
import got from 'got';
import {Sequelize} from 'sequelize';
import initModels from '@podaac/swodlr-db-models';
import winston from 'winston';


/**
 * A class which manages automagic initialization of required services and
 * singletons of common tools. Mainly accessible by an exported singleton
 */
class Utilities {
  static #APP_NAME = 'swodlr';
  static #SERVICE_NAME = 'async-update';
  static #SSM_PATH = `/service/${this.#APP_NAME}/${this.#SERVICE_NAME}/`;
  static #instance;

  #ajv = new Ajv({
    useDefaults: true,
    removeAdditional: true,
    loadSchema: async (uri) => await got(uri).json(),
  });
  #ssm = new SSM();
  #ssmParameters = new Map();

  #sequelize;
  #loggers;

  /**
   * Creates a singleton instance of Utilities if it doesn't already exist and
   * returns it
   * @return {Utilities} a singleton instance
   */
  static async instance() {
    if (Utilities.#instance == null) {
      const instance = new Utilities();
      await instance.#init();
      Utilities.#instance = instance;
    }
    return Utilities.#instance;
  }

  /**
   * Initializes the Utilities class's required services
   */
  async #init() {
    await this.#loadSSMParameters();
    await this.#setupDatabase();
    this.#setupLogger();
  }

  /**
   * Loads parameters from SSM by paginating through the SSM path
   */
  async #loadSSMParameters() {
    if (this.#ssmParameters.size > 0) return;

    let nextToken;
    do {
      const input = {
        Path: Utilities.#SSM_PATH,
        WithDecryption: true,
      };
      if (nextToken) input['NextToken'] = nextToken;

      const res = await this.#ssm.getParametersByPath(input);
      nextToken = res?.NextToken;

      for (const param of res.Parameters) {
        const name = param.Name.replace(Utilities.#SSM_PATH, '');
        this.#ssmParameters.set(name, param.Value);
      }
    } while (nextToken);
  }

  /**
   * Initializes a new Sequelize instance and initializes database models with
   * the instance
   */
  async #setupDatabase() {
    if (this.#sequelize) return;

    const sequelize = new Sequelize({
      dialect: 'postgres',
      host: this.getParameter('db_host'),
      username: this.getParameter('db_username'),
      password: this.getParameter('db_password'),
      database: this.getParameter('db_name'),
    });
    initModels(sequelize);

    this.#sequelize = sequelize;
  }

  /**
   * Sets up the Winston logger with a application-wide log level and output to
   * the console
   */
  #setupLogger() {
    if (this.#loggers) return;

    this.#loggers = new winston.Container({
      level: this.getParameter('log_level') ?? 'info',
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  /**
   * Retrieves a parameter's value from the internal SSM parameter cache
   * @param {string} name parameter name
   * @return {string} parameter value
   */
  getParameter(name) {
    return this.#ssmParameters.get(name);
  }

  /**
   * Creates and returns a logger for use within a module. Adds extra formatting
   * to base winston config
   * @param {string} filepath the raw path to the module requesting a logger
   *                          (usually import.meta.url)
   * @return {winston.Logger} a logger for the module
   */
  getLogger(filepath) {
    const name = path.basename(filepath);

    if (this.#loggers.has(name)) {
      return this.#loggers.get(name);
    } else {
      return this.#loggers.add(name, {
        format: winston.format.combine(
            winston.format.errors({stack: true}),
            winston.format.simple(),
            winston.format.label({
              message: true,
              label: name,
            }),
        ),
      });
    }
  }

  /**
   * Loads a json schema from the schemas/ directory and compiles it into a
   * validation function via ajv
   * @param {string} schemaName base filename of the json schema without the
   *                            .json extension
   * @return {function} a validation function from ajv
   */
  async loadJsonSchema(schemaName) {
    const schemaPath = path.resolve(
        import.meta.url.replace(/^file:/, ''),
        '../../schemas',
        `${schemaName}.json`,
    );
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
    return await this.#ajv.compileAsync(schema);
  }

  /**
   * Provides access to the internal sequelize instance
   */
  get sequelize() {
    return this.#sequelize;
  }
}

export default await Utilities.instance();
