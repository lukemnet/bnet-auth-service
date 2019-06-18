require('dotenv').config();
import fastify, { ServerOptions, Plugin } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';
import blipp from 'fastify-blipp';
import fastifyCaching from 'fastify-caching';
import fastifyRedis from 'fastify-redis';
import Redis from 'ioredis';
import AbstractCache from 'abstract-cache';

import appConfig from './config/app';
import redisConfig from './config/redis';

import * as routes from './routes/index';

/* Fastify plugin types */

type FastifyPlugin = Plugin<Server, IncomingMessage, ServerResponse, any>;

interface FastifyPluginObject {
  plugin: FastifyPlugin;
  options: Object;
}

type FastifyPlugins = (FastifyPlugin | FastifyPluginObject)[];

/* Server instance */

const fastifyServer = fastify({
  logger: process.env.NODE_ENV === 'development'
} as ServerOptions);

/* Caching */

const cacheSetup = () => {
  /* istanbul ignore else */ 
  if (redisConfig.enable) {
    const redisClient = new Redis(redisConfig.connectionString);

    return [
      {
        plugin: fastifyRedis,
        options: {
          client: redisClient,
        },
      },
    
      {
        plugin: fastifyCaching,
        options: {
          cache: new AbstractCache({
            useAwait: true,
            driver: {
              name: 'abstract-cache-redis',
              options: {
                client: redisClient,
                cacheSegment: 'bas-cache',
              },
            },
          }),
          expiresIn: 5 * 60, // seconds
          cacheSegment: process.env.API_REDIS_CACHE_SEGMENT,
        },
      },
    ]
  }
  /* istanbul ignore next */ 
  return {
    plugins: null,
  };
}

const plugins = [
  /* Display the routes table to console at startup */
  blipp,

  /* Routes */
  routes.status,
  routes.getAccessToken,
  routes.refreshAccessToken,
] as FastifyPlugins;

/* Registering server plugins */

const registerPlugins = (plugins: FastifyPlugins | null) => {
  /* istanbul ignore else */ 
  if (plugins) {
    plugins.map((plugin) => {
      /* istanbul ignore else */
      if (typeof plugin === 'function') {
        fastifyServer.register(plugin);
      } else if (plugin !== null && 'plugin' in plugin && 'options' in plugin) {
        fastifyServer.register(plugin.plugin, plugin.options);
      }
    });
  }
}

/* Server invocation */

const startServer = async (done?: Function) => {
  try {
    registerPlugins(plugins);
    /* istanbul ignore else */
    if (redisConfig.enable) registerPlugins(cacheSetup() as FastifyPlugins);
    await fastifyServer.listen(appConfig.port);
    /* istanbul ignore if */ 
    if (process.env.NODE_ENV === 'development') {
      fastifyServer.log.info(`Redis cache enabled: ${redisConfig.enable}`);
      fastifyServer.blipp();
    }
  } catch (err) {
    fastifyServer.log.error(err);
  }
  /* istanbul ignore else */ 
  if (done) done();
};

const stopServer = async (done?: Function) => {
  fastifyServer.close(() => {
    /* istanbul ignore else */ 
    if (done) done();
  });
}

/* Here we go! */

export = {
  start: startServer,
  stop: stopServer,
  registerPlugins: () => registerPlugins(plugins),
  instance: fastifyServer,
}
