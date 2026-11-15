import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (name: string) => YAML.parse(readFileSync(path.join(__dirname, name), 'utf-8'));

// openapi.yaml is the original API; openapi.v3.yaml adds the CRM 3.0 routes.
const base = load('openapi.yaml');
const v3 = load('openapi.v3.yaml');

export const openapiDocument = {
  ...base,
  tags: [...base.tags, ...v3.tags],
  components: { ...base.components, schemas: { ...base.components.schemas, ...v3.schemas } },
  paths: { ...base.paths, ...v3.paths },
};
