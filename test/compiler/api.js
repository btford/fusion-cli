/** Copyright (c) 2018 Uber Technologies, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/* eslint-env node */

const fs = require('fs');
const path = require('path');
const test = require('tape');
const getPort = require('get-port');
const {promisify} = require('util');
const babel = require('@babel/core');

const {Compiler} = require('../../build/compiler');
const {run} = require('../run-command');

const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

test('throws if missing src/main.js', t => {
  const env = 'development';
  const dir = './test/fixtures/__non_existent__';
  t.throws(() => {
    new Compiler({env, dir});
  });
  t.end();
});

test('development env globals', async t => {
  const env = 'development';
  const dir = './test/fixtures/noop-test';

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  const entryPath = `.fusion/dist/${env}/server/server-main.js`;
  const entry = path.resolve(dir, entryPath);

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  // Validate browser globals by file content
  const clientDir = path.resolve(dir, `.fusion/dist/${env}/client`);
  const assets = await readdir(clientDir);
  const clientEntry = assets.find(a => a.match(/^client-main.*\.js$/));
  const clientEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/${clientEntry}`
  );
  const clientContent = await readFile(clientEntryPath, 'utf8');

  const expectedClientBrowser = {
    development: '`main __BROWSER__ is ${true}`',
    production: '"main __BROWSER__ is true"',
  };
  t.ok(
    clientContent.includes(expectedClientBrowser[env]),
    `__BROWSER__ is transpiled to be true in ${env}`
  );

  const expectedClientNode = {
    development: '`main __NODE__ is ${false}`',
    production: '"main __NODE__ is false"',
  };
  t.ok(
    clientContent.includes(expectedClientNode[env]),
    '__NODE__ is transpiled to be false'
  );

  // Validate node globals by execution
  const command = `
    const assert = require('assert');
    const app = require('${entry}');
    assert.equal(typeof app.start, 'function', 'Entry has start function');
    app
      .start({port: ${await getPort()}})
      .then(server => {
        server.close();
      })
      .catch(e => {
        setImmediate(() => {
          throw e;
        });
      });
    `;
  // $FlowFixMe
  const {stdout} = await run(['-e', command], {stdio: 'pipe'});
  t.ok(
    stdout.includes('main __BROWSER__ is false'),
    'the global, __BROWSER__, is false'
  );
  t.ok(
    stdout.includes(`main __DEV__ is ${(env === 'development').toString()}`),
    `the global, __DEV__, is ${(env === 'development').toString()}`
  );
  t.ok(
    stdout.includes('main __NODE__ is true'),
    'the global, __NODE__, is true'
  );

  t.end();
});

test('production env globals', async t => {
  const env = 'development';
  const dir = './test/fixtures/noop-test';

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  const entryPath = `.fusion/dist/${env}/server/server-main.js`;
  const entry = path.resolve(dir, entryPath);

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  // Validate browser globals by file content
  const clientDir = path.resolve(dir, `.fusion/dist/${env}/client`);
  const assets = await readdir(clientDir);
  const clientEntry = assets.find(a => a.match(/^client-main.*\.js$/));
  const clientEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/${clientEntry}`
  );
  const clientContent = await readFile(clientEntryPath, 'utf8');

  const expectedClientBrowser = {
    development: '`main __BROWSER__ is ${true}`',
    production: '"main __BROWSER__ is true"',
  };
  t.ok(
    clientContent.includes(expectedClientBrowser[env]),
    `__BROWSER__ is transpiled to be true in ${env}`
  );

  const expectedClientNode = {
    development: '`main __NODE__ is ${false}`',
    production: '"main __NODE__ is false"',
  };
  t.ok(
    clientContent.includes(expectedClientNode[env]),
    '__NODE__ is transpiled to be false'
  );

  // Validate node globals by execution
  const command = `
    const assert = require('assert');
    const app = require('${entry}');
    assert.equal(typeof app.start, 'function', 'Entry has start function');
    app
      .start({port: ${await getPort()}})
      .then(server => {
        server.close();
      })
      .catch(e => {
        setImmediate(() => {
          throw e;
        });
      });
    `;
  // $FlowFixMe
  const {stdout} = await run(['-e', command], {stdio: 'pipe'});
  t.ok(
    stdout.includes('main __BROWSER__ is false'),
    'the global, __BROWSER__, is false'
  );
  t.ok(
    stdout.includes(`main __DEV__ is ${(env === 'development').toString()}`),
    `the global, __DEV__, is ${(env === 'development').toString()}`
  );
  t.ok(
    stdout.includes('main __NODE__ is true'),
    'the global, __NODE__, is true'
  );

  t.end();
});

test('generates error if missing default export', async t => {
  const env = 'development';
  const dir = './test/fixtures/empty';
  const entryPath = `.fusion/dist/${env}/server/server-main.js`;
  const entry = path.resolve(dir, entryPath);

  const compiler = new Compiler({env, dir});
  await compiler.clean();
  t.notok(await exists(entry), 'Cleans');

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  t.ok(await exists(entry), 'Entry file gets compiled');

  // $FlowFixMe
  const app = require(entry);
  t.ok(typeof app.start === 'function', 'Entry has start function');
  app
    .start({port: await getPort()})
    .then(server => {
      server.close();
      t.fail('Should not start server when missing default export');
    })
    .catch(() => t.pass('Should reject when missing default export'))
    .then(t.end);
});

test('dev works', async t => {
  const env = 'development';
  const dir = './test/fixtures/noop';
  const entryPath = `.fusion/dist/${env}/server/server-main.js`;
  const entry = path.resolve(dir, entryPath);

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  t.notok(await exists(entry), 'Cleans');

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  t.ok(await exists(entry), 'Entry file gets compiled');
  t.ok(await exists(entry + '.map'), 'Source map gets compiled');

  const command = `
    const assert = require('assert');
    const app = require('${entry}');
    assert.equal(typeof app.start, 'function', 'Entry has start function');
    (async () => {
      const server = await app.start({port: ${await getPort()}});
      server.close();
    })().catch(e => {
      setImmediate(() => {
        throw e;
      });
    });
    `;
  await run(['-e', command], {
    env: Object.assign({}, process.env, {
      NODE_ENV: 'development',
    }),
    stdio: 'pipe',
  });
  t.end();
});

test('compiles with babel plugin', async t => {
  const env = 'development';
  const dir = './test/fixtures/custom-babel';
  const serverEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/server/server-main.js`
  );
  const clientEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/client-main.js`
  );
  const clientVendorPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/client-vendor.js`
  );

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  t.ok(await exists(clientEntryPath), 'Client file gets compiled');
  t.ok(await exists(clientVendorPath), 'Client vendor file gets compiled');
  t.ok(await exists(serverEntryPath), 'Server file gets compiled');

  const clientEntry = await readFile(clientEntryPath, 'utf8');
  const clientVendorEntry = await readFile(clientVendorPath, 'utf8');
  const serverEntry = await readFile(serverEntryPath, 'utf8');
  t.ok(
    clientEntry.includes('transformed_custom_babel'),
    'custom plugin applied in client'
  );
  t.ok(
    serverEntry.includes('transformed_custom_babel'),
    'custom plugin applied in server'
  );
  t.ok(
    clientVendorEntry.includes('transformed_custom_babel'),
    'babel plugin runs against node_modules'
  );
  t.ok(
    clientVendorEntry.includes('helloworld'),
    'babel plugin does not run against blacklist'
  );

  t.end();
});

test('experimentalCompile option', async t => {
  const env = 'development';
  const dir = './test/fixtures/custom-babel';
  const serverEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/server/server-main.js`
  );
  const clientEntryPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/client-main.js`
  );

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();
  t.ok(await exists(clientEntryPath), 'Client file gets compiled');
  t.ok(await exists(serverEntryPath), 'Server file gets compiled');
  t.end();
});

test('transpiles node_modules', async t => {
  const env = 'development';
  const dir = './test/fixtures/transpile-node-modules';
  const clientVendorPath = path.resolve(
    dir,
    `.fusion/dist/${env}/client/client-legacy-vendor.js`
  );

  const compiler = new Compiler({env, dir, forceLegacyBuild: true});
  await compiler.clean();

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  t.ok(await exists(clientVendorPath), 'Client vendor file gets compiled');

  const clientVendor = await readFile(clientVendorPath, 'utf8');

  babel.transform(clientVendor, {
    plugins: [
      () => {
        return {
          visitor: {
            FunctionDeclaration: path => {
              if (path.node.async) {
                t.fail(`bundle has untranspiled async function`);
              }
            },
            ArrowFunctionExpression: path => {
              if (path.node.async) {
                t.fail('bundle has untranspiled async function');
              }
            },
            FunctionExpression: path => {
              if (path.node.async) {
                t.fail('bundle has untranspiled async function');
              }
            },
          },
        };
      },
    ],
  });

  t.ok(clientVendor.includes(`'fixturepkg_string'`));

  t.end();
});

test('production works', async t => {
  const env = 'production';
  const dir = './test/fixtures/noop';
  const entryPath = `.fusion/dist/${env}/server/server-main.js`;
  const entry = path.resolve(dir, entryPath);

  const compiler = new Compiler({env, dir});
  await compiler.clean();

  t.notok(await exists(entry), 'Cleans');

  const watcher = await new Promise((resolve, reject) => {
    const watcher = compiler.start((err, stats) => {
      if (err || stats.hasErrors()) {
        return reject(err || new Error('Compiler stats included errors.'));
      }

      return resolve(watcher);
    });
  });
  watcher.close();

  t.ok(await exists(entry), 'Entry file gets compiled');
  t.ok(await exists(entry + '.map'), 'Source map gets compiled');

  const clientDir = path.resolve(dir, `.fusion/dist/${env}/client`);
  const assets = await readdir(clientDir);
  t.ok(assets.find(a => a.match(/^client-main.+\.js$/)), 'main .js');
  t.ok(assets.find(a => a.match(/^client-main.+\.js.map$/)), 'main .map');
  //t.ok(assets.find(a => a.match(/^client-main.+\.js.gz$/)), 'main .gz');
  t.ok(assets.find(a => a.match(/^client-main.+\.js.br$/)), 'main .br');
  t.ok(assets.find(a => a.match(/^client-vendor.+\.js$/)), 'vendor .js');
  t.ok(assets.find(a => a.match(/^client-vendor.+\.js.map$/)), 'vendor .map');
  //t.ok(assets.find(a => a.match(/^client-vendor.+\.js.gz$/)), 'vendor .gz');
  t.ok(assets.find(a => a.match(/^client-vendor.+\.js.br$/)), 'vendor .br');
  const command = `
    const assert = require('assert');
    const app = require('${entry}');
    assert.equal(typeof app.start, 'function', 'Entry has start function');
    app
      .start({port: ${await getPort()}})
      .then(server => {
        server.close();
      })
      .catch(e => {
        setImmediate(() => {
          throw e;
        });
      });
    `;
  await run(['-e', command], {
    env: Object.assign({}, process.env, {
      NODE_ENV: 'production',
    }),
    stdio: 'pipe',
  });
  t.end();
});
