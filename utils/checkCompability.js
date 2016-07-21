global.__DEV__ = false;

const path = require('path');
const fs = require('fs');
const babel = require('babel-core');

const NodeHaste = require('node-haste');
const blacklist = require('./blacklist');
const externalHelpersPlugin = require('babel-plugin-external-helpers');
const inlineRequiresPlugin = require('babel-preset-fbjs/plugins/inline-requires');

let entryPath = path.join(__dirname, 'return.ios.js');

const cache = new NodeHaste.Cache({
  cacheKey: '$$cacheKey$$',
});

const fileWatcher = new NodeHaste.FileWatcher([{
  dir: path.join(__dirname, '..')
}], {useWatchman: true});

const opts = {
    blacklistRE: blacklist('ios')
};

const graph = new NodeHaste({
  roots: [path.join(__dirname, '..')],
  cache,
  ignoreFilePath: function(filepath) {
        return filepath.indexOf('__tests__') !== -1 ||
          (opts.blacklistRE && opts.blacklistRE.test(filepath));
      },
  fileWatcher,
  transformCode: (module, code, options) => {
      let {path: filename} = module;

      const config = {
          filename,
          sourceFileName: filename,
      };

      const extraPlugins = [externalHelpersPlugin];

      config.plugins = extraPlugins.concat(config.plugins);

      let babelConfig = Object.assign({}, JSON.parse(
          fs.readFileSync(path.resolve(__dirname, '..', '.babelrc'))
      ), config);

      return new Promise(resolve => {
          resolve(babel.transform(code, babelConfig));
      });
  },
  providesModuleNodeModules: [
      'react',
      'react-native'
  ],
  "platforms": [
    "ios",
    "android"
  ],
  shouldThrowOnUnresolvedErrors: () => false
});

var m = require('module');

let resolveMap = {};
let originalLoader = m._load;

let nodeHasteLoader = (request, parent, isMain) => {
    try {
        return originalLoader(request, parent, isMain);
    } catch (e) {
        if (resolveMap.hasOwnProperty(request) && !resolveMap[request].path) {
            console.log(request, resolveMap[request]);
            throw new Error('path is not present ' + request);
        }

        if (resolveMap.hasOwnProperty(request)) {
            var filename = m._resolveFilename(resolveMap[request].path, parent, isMain);
            console.log('yay - ', filename);

            var cachedModule = m._cache[filename];
            if (cachedModule) {
                return cachedModule.exports;
            }

            var Module = m.constructor;

            var module = new Module(filename, parent);
            if (isMain) {
                process.mainModule = module;
                module.id = '.';
            }
            m._cache[filename] = module;

            return m._compile(resolveMap[request].code, filename)
        }

        throw e;
    }

    throw new Error(`module ${request} could not be resolved`);
}

m._load = nodeHasteLoader;

graph.getDependencies({
    entryPath,
    platform: 'ios',
    recursive: true
}).then(
    response => {
        Promise.all(response.dependencies.filter(dep => !dep.isPolyfill()).map(dep => {
            return new Promise((resolve,reject) => {
                Promise.all([dep.getName(), dep.getCode(), dep.getPackage().getName()])
                .then(([name, code, package]) => resolve({name, code, package, path: dep.path}))
                .catch(e => console.log(e));
            });
        })).then((dependencies) => {
            dependencies.map(({name, code, package, path}) => {
                resolveMap[name] = {name, code, package, path};
            });

            console.log('gathered dependencies');

            try {
                let ReactNative = require('react-native');
            } catch (e) {
                console.log(e);
            }
            // let ReactNativeMock = `let React = require('react-native-mock');`;

            console.log('joah?', ReactNative);
            console.log('joah?', ReactNative.ActivityIndicatorIOS);
            // console.log('joah?', ReactNativeMock);
        });
    },
    error => {
        console.error(error)
    }
);
