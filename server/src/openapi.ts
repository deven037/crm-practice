import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf-8');

export const openapiDocument = YAML.parse(raw);
