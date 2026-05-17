'use client';
import { CsvMapper } from '@zameen/ui';
import { IMPORT_TARGETS, type ImportTargetKey } from '@/modules/admin/import-targets';
import { parseCsv, validateRows, commitImport } from '@/modules/admin/import-actions';

interface Props {
  target: ImportTargetKey;
}

export function ImportRunner({ target }: Props) {
  const spec = IMPORT_TARGETS[target];
  return (
    <CsvMapper
      targetLabel={spec.label}
      fieldSpecs={spec.fields}
      templatePath={spec.templatePath}
      onParse={(csv) => parseCsv(target, csv)}
      onValidate={(rows, mapping) => validateRows(target, rows, mapping)}
      onCommit={(valid) => commitImport(target, valid)}
    />
  );
}
