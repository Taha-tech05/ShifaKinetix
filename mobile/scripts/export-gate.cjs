// Test-only TypeScript loader. No LLM, network, or alternate gate implementation.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(source, filename);
};
const { evaluate } = require('../src/gate/evaluate.ts');
const { cases } = require('../../shared/gate_test_cases.json');
process.stdout.write(JSON.stringify(cases.map((item) => ({ caseId: item.caseId, output: evaluate(item.answers) }))));
