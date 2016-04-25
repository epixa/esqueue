import events from 'events';
import { isPlainObject } from 'lodash';
import logger from './helpers/logger';
import { JOB_STATUS_PENDING } from './helpers/constants';
import createIndex from './helpers/create_index';

const debug = logger('job');

export default class Job extends events.EventEmitter {
  constructor(client, index, type, payload, options = {}) {
    if (typeof type !== 'string') throw new Error('Type must be a string');
    if (!isPlainObject(payload)) throw new Error('Payload must be a plain object');

    super();

    const timeout = options.timeout || 10000;
    const maxAttempts = options.max_attempts || 3;
    const priority = Math.max(Math.min(options.priority || 10, 20), -20);

    this.client = client;
    this.index = index;
    this.type = type;
    this.payload = payload;

    this.ready = createIndex(client, index)
    .then(() => {
      this.client.index({
        index: this.index,
        type: this.type,
        body: {
          payload: this.payload,
          priority: priority,
          timeout: timeout,
          created_at: new Date(),
          attempts: 0,
          max_attempts: maxAttempts,
          status: JOB_STATUS_PENDING,
        }
      })
      .then((doc) => {
        this.document = {
          id: doc._id,
          type: doc._type,
          version: doc._version,
        };
        debug('Job created', this.document);
      });
    })
    .catch((err) => {
      debug('Job creation failed', err);
      this.emit('error', err);
      throw err;
    });
  }

}
