const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

const { runAttachmentInternalTests } = require('../src/domain/tasks/attachments.internalTests.ts');
const { runRecurrenceInternalTests } = require('../src/domain/tasks/recurrence.internalTests.ts');
const { runSpanishTaskParserInternalTests } = require('../src/features/assistant/spanishTaskParser.internalTests.ts');
const { runEnglishTaskParserInternalTests } = require('../src/features/assistant/englishTaskParser.internalTests.ts');
const { runSupabaseTaskMapperInternalTests } = require('../src/infrastructure/supabase/supabaseTaskMapper.internalTests.ts');
const {
  runSupabaseAttachmentRepositoryInternalTests,
} = require('../src/infrastructure/supabase/supabaseAttachmentRepository.internalTests.ts');
const { runI18nInternalTests } = require('../src/shared/i18n/i18n.internalTests.ts');

const results = [
  ...runAttachmentInternalTests(),
  ...runRecurrenceInternalTests(),
  ...runSpanishTaskParserInternalTests(),
  ...runEnglishTaskParserInternalTests(),
  ...runSupabaseTaskMapperInternalTests(),
  ...runSupabaseAttachmentRepositoryInternalTests(),
  ...runI18nInternalTests(),
];
const failed = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(`${result.ok ? '✓' : '✗'} ${result.name}`);
  if (!result.ok && result.details) {
    console.log(JSON.stringify(result.details, null, 2));
  }
}

if (failed.length) {
  console.error(`\n${failed.length} internal test(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} internal tests passed.`);
