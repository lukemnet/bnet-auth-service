import { BlizzAPI } from 'blizzapi';

import bnetConfig from '../config/bnet';
import redisConfig from '../config/redis';
import { FastifyInstance } from 'fastify';

const { region, apiKey, apiSecret } = bnetConfig;
const { replyCachePeriod, cacheSegment } = redisConfig;

const getFreshAccessToken = () => {
  return new BlizzAPI(region, apiKey, apiSecret).getAccessToken();
}

const getCachedAccessToken = async (server: FastifyInstance) => {
  if (redisConfig.enable) {
    const response = await server.cache.get(cacheSegment);
    return response.item;
  }
  return getFreshAccessToken();
}

const isAccessTokenCached = (server: FastifyInstance) => {
  if (redisConfig.enable) {
    return server.cache.has(cacheSegment);
  }
  return false;
}

const cacheAccessToken = (server: FastifyInstance, accessToken: string) => {
  if (redisConfig.enable) {
    return server.cache.set(cacheSegment, accessToken, replyCachePeriod);
  }
}

const getAccessToken = async (server:FastifyInstance, refresh: Boolean) => {
  const noKeyInCache = !(await isAccessTokenCached(server));

  if (noKeyInCache || refresh) {
    const accessToken = await getFreshAccessToken();
    await cacheAccessToken(server, accessToken);
    return accessToken;
  }

  return getCachedAccessToken(server);
}

export {
  getAccessToken,
  getFreshAccessToken,
  getCachedAccessToken,
  isAccessTokenCached,
  cacheAccessToken
}
