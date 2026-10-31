import { Kafka } from "kafkajs";
import { env } from "../config/env.js";

let producerPromise = null;

const isKafkaEnabled = () => env.kafka.brokers.length > 0;

const getProducer = async () => {
  if (!isKafkaEnabled()) return null;

  if (!producerPromise) {
    const kafka = new Kafka({
      clientId: env.kafka.clientId,
      brokers: env.kafka.brokers,
    });
    const producer = kafka.producer();
    producerPromise = producer.connect().then(() => producer);
  }

  return producerPromise;
};

export const publishOrderEvent = async (type, payload) => {
  try {
    const producer = await getProducer();
    if (!producer) return;

    await producer.send({
      topic: env.kafka.orderEventsTopic,
      messages: [{
        key: String(payload.batchId || payload.executionId || type),
        value: JSON.stringify({
          type,
          payload,
          emittedAt: new Date().toISOString(),
        }),
      }],
    });
  } catch (error) {
    console.error("Kafka publish failed", error);
  }
};

export const disconnectKafkaProducer = async () => {
  if (!producerPromise) return;
  const producer = await producerPromise;
  await producer.disconnect();
};
