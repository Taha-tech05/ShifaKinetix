// Turns an ES-module file (three.js ships only as ES modules) into CommonJS for jest. Used only for three.
const ts = require('typescript');

module.exports = {
  process(source, filename) {
    const out = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, allowJs: true, esModuleInterop: true },
    });
    return { code: out.outputText };
  },
};
