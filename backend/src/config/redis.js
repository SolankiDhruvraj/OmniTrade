import IORedis from "ioredis";
import { env } from "./env.js";

export const createRedisConnection = () => new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
