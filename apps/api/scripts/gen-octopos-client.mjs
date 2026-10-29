#!/usr/bin/env node
/**
 * Generates `src/modules/pos/providers/octopos/generated.ts` from the Octopos sandbox OpenAPI document
 * (`docs/octopos/openapi.json`, Swagger 2.0 as served by `GET /api/swagger/docs/v1`).
 *
 *   node scripts/gen-octopos-client.mjs            # rewrite the file
 *   node scripts/gen-octopos-client.mjs --check    # exit 1 when the committed file is stale (CI)
 *
 * Only the operations otvori uses are emitted (OPERATIONS below) together with every definition they reference,
 * transitively. The output is deterministic (sorted keys) so the diff shows exactly what changed in the spec.
 * No dependency: the spec is Swagger 2.0, which current openapi-typescript releases no longer read.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.resolve(here, '../../../docs/octopos/openapi.json');
const OUT = path.resolve(here, '../src/modules/pos/providers/octopos/generated.ts');

/**
 * [method, path, exported name] of the operations otvori uses. Swashbuckle reuses operationIds (`Product_Get` is
 * both `GET /Product` and `GET /Product/{id}`), so the path is the key and the name is ours.
 */
const OPERATIONS = [
  ['get', '/Ping', 'Ping_Get'],
  ['get', '/Currency/System', 'Currency_GetSystem'],
  ['get', '/Tax', 'Tax_Get'],
  ['get', '/BusinessPartner/MyCompany', 'BusinessPartner_GetMyCompany'],
  ['get', '/Table/Active', 'Table_GetActive'],
  ['get', '/Table/Occupied', 'Table_GetOccupied'],
  ['get', '/Product', 'Product_List'],
  ['get', '/WebOrder/Product', 'WebOrder_GetProducts'],
  ['get', '/WebOrder/ProductCategory', 'WebOrder_GetProductCategories'],
  ['post', '/WebOrder', 'WebOrder_Post'],
  ['get', '/WebOrder/{id}', 'WebOrder_Get'],
  ['post', '/WebOrder/{id}/Pay', 'WebOrder_PayTableBill'],
  ['get', '/WebOrder/{id}/FiscalReceipt', 'WebOrder_GetFiscalReceipt'],
  ['post', '/WebOrder/{externalId}/Cancel', 'WebOrder_CancelWebOrder'],
  ['post', '/WebOrder/{id}/Revoke', 'WebOrder_RevokeWebOrder'],
  ['get', '/BillCumulative/OpenBills', 'BillCumulative_GetOpenForTable'],
];

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const definitions = spec.definitions ?? {};

/** `Fusion.Octopos.Web.Api.Dto.WebOrderDto` → `WebOrderDto`; generic `PageListDto[…TableDto]` → `PageListDtoOfTableDto`. */
function typeName(ref) {
  const raw = ref.replace(/^#\/definitions\//, '');
  const generic = raw.match(/^(.*)\[(.*)\]$/);
  const short = (s) => s.split('.').pop();
  if (generic) return `${short(generic[1])}Of${short(generic[2])}`;
  return short(raw);
}

function tsType(schema, needed) {
  if (!schema) return 'unknown';
  if (schema.$ref) {
    needed.add(schema.$ref.replace(/^#\/definitions\//, ''));
    return typeName(schema.$ref);
  }
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${tsType(schema.items, needed)}[]`;
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, prop]) => `${name}?: ${tsType(prop, needed)}`);
        return `{ ${props.join('; ')} }`;
      }
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

const needed = new Set();
const ops = [];
for (const [method, p, name] of OPERATIONS) {
  const op = spec.paths[p]?.[method];
  if (!op) throw new Error(`${method.toUpperCase()} ${p} is not in the spec`);
  {
    const params = (op.parameters ?? []).filter((x) => x.name !== 'Authorization');
    const query = params.filter((x) => x.in === 'query');
    const pathParams = params.filter((x) => x.in === 'path');
    const body = params.find((x) => x.in === 'body');
    const ok = op.responses?.['200']?.schema;
    ops.push({
      id: name,
      method: method.toUpperCase(),
      path: p,
      summary: op.summary ?? '',
      pathParams: pathParams.map((x) => ({ name: x.name, type: tsType(x, needed) })),
      query: query.map((x) => ({ name: x.name, type: tsType(x, needed), required: Boolean(x.required) })),
      body: body ? tsType(body.schema, needed) : null,
      response: ok ? tsType(ok, needed) : 'void',
    });
  }
}
ops.sort((a, b) => a.id.localeCompare(b.id));

// Transitive closure of the definitions the operations reference.
const emitted = new Map();
const queue = [...needed];
while (queue.length) {
  const name = queue.shift();
  if (emitted.has(name)) continue;
  const def = definitions[name];
  if (!def) throw new Error(`Definition ${name} missing from the spec`);
  const local = new Set();
  const props = Object.entries(def.properties ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prop, schema]) => `  ${prop}?: ${tsType(schema, local)};`);
  emitted.set(name, `export interface ${typeName(`#/definitions/${name}`)} {\n${props.join('\n')}\n}`);
  for (const dep of local) if (!emitted.has(dep)) queue.push(dep);
}

const interfaces = [...emitted.entries()].sort(([a], [b]) => typeName(a).localeCompare(typeName(b))).map(([, body]) => body);

const opTypes = ops.map((op) => {
  const pathParams = op.pathParams.length ? `{ ${op.pathParams.map((x) => `${x.name}: ${x.type}`).join('; ')} }` : 'undefined';
  const query = op.query.length ? `{ ${op.query.map((x) => `${x.name}${x.required ? '' : '?'}: ${x.type}`).join('; ')} }` : 'undefined';
  return `  /** ${op.method} ${op.path}${op.summary ? ` — ${op.summary}` : ''} */
  ${op.id}: { method: '${op.method}'; path: '${op.path}'; pathParams: ${pathParams}; query: ${query}; body: ${op.body ?? 'undefined'}; response: ${op.response} };`;
});

const table = ops.map((op) => `  ${op.id}: { method: '${op.method}', path: '${op.path}' },`);

const output = `/**
 * GENERATED by scripts/gen-octopos-client.mjs from docs/octopos/openapi.json — do not edit by hand.
 * Spec: ${spec.info?.title ?? 'Octopos'} ${spec.info?.version ?? ''} (host ${spec.host ?? '?'}, basePath ${spec.basePath ?? '/'}).
 * Every property is optional: the register omits nulls and the sandbox returns fields the spec does not list.
 */

${interfaces.join('\n\n')}

/** The sandbox wraps every JSON answer; \`Warnings\` is not in the spec. Errors arrive as 400 with Success=false. */
export interface Envelope<T> {
  Success: boolean;
  Errors?: unknown[];
  Warnings?: unknown[];
  Data?: T;
}

export interface Operations {
${opTypes.join('\n')}
}

export type OperationId = keyof Operations;

export const OPERATIONS: { [K in OperationId]: { method: Operations[K]['method']; path: Operations[K]['path'] } } = {
${table.join('\n')}
};
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== output) {
    console.error(`${path.relative(process.cwd(), OUT)} is stale; run: node scripts/gen-octopos-client.mjs`);
    process.exit(1);
  }
  console.log('octopos client is up to date');
} else {
  writeFileSync(OUT, output);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${ops.length} operations, ${emitted.size} definitions`);
}
