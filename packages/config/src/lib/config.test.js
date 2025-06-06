import config from './createConfig';
import path from 'path';
const crdMockPath = path.resolve(__dirname, './crd-mock.yaml');

const configBuilder = (c) => config({ rootFolder: '', frontendCRDPath: crdMockPath, ...c });

describe('should create dummy config with no options', () => {
  const { mode, optimization, entry, output, devServer } = config({
    rootFolder: '',
    appEntry: '/foo/bar',
    appName: 'Fooapp',
    env: 'stage-stable',
    frontendCRDPath: crdMockPath,
  });

  const { mode: prodMode } = configBuilder({ mode: 'production' });
  test('mode', () => {
    expect(mode).toBe('development');
  });

  test('prodMode', () => {
    expect(prodMode).toBe('production');
  });

  test('optimization', () => {
    expect(optimization).toEqual(undefined);
  });

  test('entry', () => {
    expect(entry).toEqual({ App: '/foo/bar' });
  });

  test('output', () => {
    expect(output).toEqual({
      filename: expect.stringMatching(/js\/\[name\]\.\[contenthash\]\.js/),
      path: '/dist',
      chunkFilename: expect.stringMatching(/js\/\[name\]\.\[contenthash\]\.js/),
    });
  });

  test('devServer', () => {
    expect(devServer).toEqual({
      setupMiddlewares: expect.any(Function),
      onListening: expect.any(Function),
      static: {
        directory: '/dist',
      },
      server: 'http',
      host: '0.0.0.0',
      port: 8002,
      hot: false,
      liveReload: true,
      allowedHosts: 'all',
      historyApiFallback: {
        rewrites: [
          { from: /^\/api/, to: '/404.html' },
          { from: /^\/config/, to: '/404.html' },
        ],
        verbose: false,
        disableDotRule: true,
      },
      client: {
        overlay: false,
      },
      devMiddleware: {
        writeToDisk: true,
      },
    });
  });
});

describe('rootFolder', () => {
  const { output, devServer } = configBuilder({ rootFolder: '/some' });
  test('output', () => {
    expect(output.path).toBe('/some/dist');
  });

  test('devServer', () => {
    expect(devServer.static.directory).toBe('/some/dist');
  });
});

describe('module rules', () => {
  test('length', () => {
    const { module } = configBuilder({ appEntry: 'testEntry', appName: 'someName' });
    expect(module.rules.length).toBe(4);
  });
});

test('appEntry correctly set', () => {
  const { entry } = configBuilder({ appEntry: 'testEntry' });
  expect(entry).toEqual({ App: 'testEntry' });
});

describe('publicPath', () => {
  test('should ignore unknown public path', () => {
    const { output } = configBuilder({ publicPath: 'test-value' });
    expect(output.publicPath).toBe(undefined);
  });
  test('should propagate public path auto', () => {
    const { output } = configBuilder({ publicPath: 'auto' });
    expect(output.publicPath).toBe('auto');
  });
});

describe('port', () => {
  const { devServer } = configBuilder({ port: 1000 });

  test('devServer', () => {
    expect(devServer.port).toBe(1000);
  });
});

test('https', () => {
  const { devServer } = configBuilder({ https: true });
  expect(devServer.server).toBe('https');
});

test('noFileHash', () => {
  const { output } = configBuilder({ useFileHash: false });
  expect(output.filename).toBe('js/[name].js');
});
