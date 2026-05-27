import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInvoice } from './invoiceService';

const OFFLINE_QUEUE_KEY = '@subtrack_offline_invoices';

type QueuedInvoice = {
  id: string;
  userId: string;
  payload: any;
  timestamp: number;
};

/**
 * Adds an invoice creation task to the offline sync queue
 */
export async function enqueueOfflineInvoice(userId: string, payload: any): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedInvoice[] = queueStr ? JSON.parse(queueStr) : [];

    const newQueueItem: QueuedInvoice = {
      id: payload.id || Date.now().toString(),
      userId,
      payload,
      timestamp: Date.now(),
    };

    queue.push(newQueueItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('Invoice enqueued offline successfully:', newQueueItem.id);
  } catch (error) {
    console.error('Failed to enqueue invoice offline:', error);
  }
}

/**
 * Attempts to process and upload all queued offline invoices
 */
export async function processOfflineQueue(userId: string): Promise<boolean> {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return true;

    const queue: QueuedInvoice[] = JSON.parse(queueStr);
    const userQueue = queue.filter((item) => item.userId === userId);
    if (userQueue.length === 0) return true;

    console.log(`Processing ${userQueue.length} offline queued invoices...`);

    const failedIds: string[] = [];

    for (const item of userQueue) {
      try {
        await createInvoice(item.userId, item.payload);
        console.log(`Uploaded queued invoice ${item.id} successfully!`);
      } catch (uploadError) {
        console.warn(`Failed to upload queued invoice ${item.id}, keeping in queue:`, uploadError);
        failedIds.push(item.id);
      }
    }

    // Keep failed items and items from other users
    const remainingQueue = queue.filter(
      (item) => item.userId !== userId || failedIds.includes(item.id)
    );

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return failedIds.length === 0;
  } catch (error) {
    console.error('Failed to process offline queue:', error);
    return false;
  }
}
