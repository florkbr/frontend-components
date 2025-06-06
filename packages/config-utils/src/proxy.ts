/* eslint-disable no-console */
// Webpack proxy and express config for `useProxy: true` or `standalone: true`
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import express from 'express';
import path from 'path';
import type { Configuration } from 'webpack-dev-server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chokidar from 'chokidar';
import cookieTransform from './cookieTransform';
import { isInterceptAbleRequest, matchNavigationRequest } from './feo/check-outgoing-requests';
import { hasFEOFeaturesEnabled, readFrontendCRD } from './feo/crd-check';
import fecLogger, { LogType } from './fec-logger';
import { modifyRequest } from './feo/modify-response';
import { FrontendCRD } from './feo/feo-types';

const defaultReposDir = path.join(__dirname, 'repos');

const checkLocalAppHost = (appName: string, hostUrl: string, port: number | string) => {
  const check = execSync(`curl --max-time 5 --silent --head ${hostUrl} | awk '/^HTTP/{print $2}'`).toString().trim();

  if (check !== '200') {
    console.error('\n' + appName[0].toUpperCase() + appName.substring(1) + ' is not running or available via ' + hostUrl);
    console.log(
      '\nMake sure to run `npm run start -- --port=' +
        port +
        '` in the ' +
        appName +
        " application directory to start it's webpack dev server and the bundle is built.\n"
    );

    return false;
  } else {
    return true;
  }
};

type ProxyConfigItem = import('webpack-dev-server').ProxyConfigArrayItem;

const buildRoutes = (
  routes: {
    [route: string]: ProxyConfigItem & { host?: string };
  },
  target: string
) =>
  Object.entries(routes || {}).map(([route, redirect]) => {
    const currTarget = typeof redirect === 'object' ? redirect.host : redirect;
    if (typeof redirect === 'object') {
      delete redirect.host;
    }
    const result: ProxyConfigItem = {
      context: (path: string) => path.includes(route),
      target: currTarget === 'PORTAL_BACKEND_MARKER' ? target : currTarget || undefined,
      secure: false,
      changeOrigin: true,
      autoRewrite: true,
      ws: true,
      onProxyReq: cookieTransform as ProxyConfigItem['onProxyReq'],
      ...(typeof redirect === 'object' ? redirect : {}),
    };

    return result;
  });

const buildLocalAppRoutes = (localApps: string | string[], defaultLocalAppHost: string, target: string) =>
  buildRoutes(
    (!Array.isArray(localApps) ? localApps.split(',') : localApps).reduce((acc, curr) => {
      const [appName, appConfig] = (curr || '').split(':');
      const [appPort = 8003, protocol = 'http'] = appConfig.split('~');
      const appUrl = `${protocol}://${defaultLocalAppHost}:${appPort}`;

      if (checkLocalAppHost(appName, appUrl, appPort)) {
        console.log('Creating app proxy routes for: ' + appName + ' to ' + appUrl);

        return {
          ...acc,
          [`/apps/${appName}`]: {
            host: appUrl,
          },
        };
      } else {
        process.exit();
      }
    }, {}),
    target
  );

export type ProxyOptions = {
  env?: 'prod-stable' | 'stage-stable' | string;
  customProxy?: ProxyConfigItem[];
  routes?: { routes?: { [route: string]: ProxyConfigItem } } & { [route: string]: ProxyConfigItem };
  routesPath?: string;
  useProxy?: boolean;
  proxyURL?: string;
  standalone?: boolean;
  port?: number;
  reposDir?: string;
  localChrome?: string;
  appUrl?: (string | RegExp)[];
  publicPath: string;
  proxyVerbose?: boolean;
  useCloud?: boolean;
  target?: string;
  keycloakUri?: string;
  registry?: ((...args: any[]) => void)[];
  /** @deprecated Is now turned on by default */
  isChrome?: boolean;
  onBeforeSetupMiddleware?: (opts: { chromePath?: string }) => void;
  bounceProd?: boolean;
  useAgent?: boolean;
  useDevBuild?: boolean;
  localApps?: string;
  /**
   * Used to block running chrome from build repos.
   * Chrome should be running from container from now on.
   */
  blockLegacyChrome?: boolean;
  // needs to be passed from the config directly to proxy
  frontendCRDPath?: string;
};

const proxy = ({
  env = 'stage-stable',
  customProxy = [],
  routes,
  routesPath,
  useProxy,
  proxyURL = 'http://squid.corp.redhat.com:3128',
  appUrl = [],
  publicPath,
  proxyVerbose,
  useCloud = false,
  target = '',
  bounceProd = false,
  useAgent = true,
  localApps = process.env.LOCAL_APPS,
  frontendCRDPath = path.resolve(process.cwd(), 'deploy/frontend.yaml'),
}: ProxyOptions) => {
  const frontendCrdRef: { current?: FrontendCRD } = { current: undefined };
  let FEOFeaturesEnabled = false;
  try {
    frontendCrdRef.current = readFrontendCRD(frontendCRDPath);
    FEOFeaturesEnabled = hasFEOFeaturesEnabled(frontendCrdRef.current);
  } catch (e) {
    fecLogger(
      LogType.warn,
      `FEO features are not enabled. Unable to find frontend CRD file at ${frontendCRDPath}. If you want FEO features for local development, make sure to have a "deploy/frontend.yaml" file in your project or specify its location via "frontendCRDPath" attribute.`
    );
  }
  const proxy: ProxyConfigItem[] = [];
  const majorEnv = env.split('-')[0];
  const defaultLocalAppHost = process.env.LOCAL_APP_HOST || majorEnv + '.foo.redhat.com';

  if (FEOFeaturesEnabled && frontendCrdRef?.current) {
    fecLogger(LogType.info, 'Watching frontend CRC file for changes');
    const watcher = chokidar.watch(frontendCRDPath).on('change', () => {
      fecLogger(LogType.info, 'Frontend CRD has changed, reloading the file');
      try {
        frontendCrdRef.current = readFrontendCRD(frontendCRDPath);
      } catch (error) {
        fecLogger(LogType.error, 'Error reloading frontend CRD file', error);
      }
    });

    // close the watcher on webserver shutdown
    process.on('SIGTERM', () => {
      fecLogger(LogType.info, 'Closing frontend CRD watcher');
      watcher.close();
    });
    process.on('SIGINT', () => {
      fecLogger(LogType.info, 'Closing frontend CRD watcher');
      watcher.close();
    });
  }

  if (target === '') {
    target += 'https://';
    if (!['prod', 'stage', 'dev'].includes(majorEnv)) {
      target += majorEnv + '.';
    }

    target += useCloud ? 'cloud' : 'console';
    if (['stage', 'dev'].includes(majorEnv)) {
      target += `.${majorEnv}`;
    }

    target += '.redhat.com/';
  }

  let agent;

  const isProd = env.startsWith('prod');
  const isStage = env.startsWith('stage');
  const isEphemeral = env.startsWith('ephemeral');

  const shouldBounceProdRequests = isProd && bounceProd && !useAgent;

  if (isStage || isEphemeral || (isProd && useAgent)) {
    // stage is deployed with Akamai which requires a corporate proxy
    agent = new HttpsProxyAgent(proxyURL);
  }

  if (isStage) {
    // stage-stable branches don't exist in build repos
    // Currently stage pulls from QA
    env = env.replace('stage', 'qa');
  }

  if (isEphemeral) {
    env = env.replace('ephemeral', 'qa');
  }

  if (!Array.isArray(appUrl)) {
    appUrl = [appUrl];
  }

  appUrl.push(publicPath);

  if (routesPath) {
    routes = require(routesPath);
  }

  if (routes) {
    routes = routes.routes || routes;
    proxy.push(...buildRoutes(routes, target));
  }

  if (localApps && localApps.length > 0) {
    proxy.push(...buildLocalAppRoutes(localApps, defaultLocalAppHost, target));
  }

  if (customProxy) {
    proxy.push(...customProxy);
  }

  if (useProxy) {
    // Catch-all
    proxy.push({
      secure: false,
      changeOrigin: true,
      autoRewrite: true,
      onProxyRes: (proxyRes, req, res) => {
        // this should reading the aggregated bundles filed generated from chrome service
        // The functionality is disabled until the interceptor is ready
        // eslint-disable-next-line no-constant-condition
        if (FEOFeaturesEnabled && frontendCrdRef.current && isInterceptAbleRequest(req.url)) {
          // stub the original write function
          const _write = res.write;
          let body = '';
          proxyRes.on('data', (chunk) => {
            body += chunk;
          });

          res.write = function () {
            try {
              const payload = modifyRequest(body, req.url, frontendCrdRef.current!);
              // content length is necessary to update to prevent JSON parsing errors in browser
              res.setHeader('content-length', payload.length);
              _write.call(res, payload, 'utf8');
              return true;
            } catch {
              // wait for all the chunks to arrive
              return true;
            }
          };
        }
      },
      context: (url: string) => {
        const shouldProxy = !appUrl.find((u) => (typeof u === 'string' ? url.startsWith(u) : u.test(url)));
        if (shouldProxy) {
          if (proxyVerbose) {
            console.log('proxy', url);
          }

          return true;
        }

        return false;
      },
      target,
      bypass: async (req, res) => {
        /**
         * Bypass any HTML to the root URL
         * Serves as a historyApiFallback when refreshing on any other URL than '/'
         */
        if (!req.url.match(/\/api\//) && !req.url.match(/\./) && req.headers.accept?.includes('text/html')) {
          return '/';
        }

        /**
         * Use node-fetch to proxy all non-GET requests (this avoids all origin/host akamai policy)
         * This enables using PROD proxy without VPN and agent
         */
        if (shouldBounceProdRequests && req.method !== 'GET') {
          const result = await fetch((target + req.url).replace(/\/\//g, '/'), {
            method: req.method,
            body: JSON.stringify(req.body),
            headers: {
              ...(req.headers.cookie && {
                cookie: req.headers.cookie,
              }),
              'Content-Type': 'application/json',
            },
          });

          const text = await result.text();
          try {
            const data = JSON.parse(text);
            res.status(result.status).json(data);
          } catch (err) {
            res.status(result.status).send(text);
          }
        }

        return null;
      },
      ...(agent
        ? {
            agent,
            headers: {
              // Set FEO gzip headers here to prevent issues with setting headers after response was closed
              'accept-encoding': 'gzip;q=0,deflate,sdch',
              // Staging Akamai CORS gives 403s for non-GET requests from non-origin hosts
              Host: target.replace('https://', ''),
              // Origin format is protocol://hostname:port only, remove any trailing slash
              Origin: target.replace(/\/$/, ''),
            },
          }
        : {
            'accept-encoding': 'gzip;q=0,deflate,sdch',
          }),
    });
  }

  const config: Configuration = {
    ...(proxy.length > 0 && { proxy }),
    onListening(server) {
      if (useProxy) {
        // Dev is just a prod but SSO does not allow dev.foo.redhat.com origin
        const host = useProxy ? `${majorEnv === 'dev' ? 'prod' : majorEnv}.foo.redhat.com` : 'localhost';
        const origin = `https://${host}:${server.options.port}`;
        console.log('App should run on:');

        console.log('\u001b[34m'); // Use same webpack-dev-server blue
        if (appUrl.length > 0) {
          appUrl.slice(0, appUrl.length - 1).forEach((url) => console.log(`  - ${origin}${url}`));

          console.log('\x1b[0m');
          console.log('Static assets are available at:');
          console.log('\u001b[34m'); // Use same webpack-dev-server blue
          console.log(`  - ${origin}${appUrl[appUrl.length - 1]}`);
        } else {
          console.log(`  - ${origin}`);
        }

        console.log('\u001b[0m');
      }
    },
    setupMiddlewares(middlewares, { app, compiler, options }) {
      app?.enable('strict routing'); // trailing slashes are mean

      if (shouldBounceProdRequests) {
        app?.use(express.json());
        app?.use(express.urlencoded({ extended: true }));
      }

      return middlewares;
    },
  };

  return config;
};

export default proxy;
module.exports = proxy;
