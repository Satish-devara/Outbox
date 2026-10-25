import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getEmailQueue } from '../queues/emailQueue';

let serverAdapter: ExpressAdapter | null = null;

export function setupBullBoard() {
  if (!serverAdapter) {
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(getEmailQueue())],
      serverAdapter,
    });

    console.log('✅  Live BullMQ dashboard mounted at /admin/queues');
  }

  return serverAdapter.getRouter();
}
