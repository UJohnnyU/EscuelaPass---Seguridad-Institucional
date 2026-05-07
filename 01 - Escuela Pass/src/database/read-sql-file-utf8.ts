import * as fs from 'fs';

/** Lee SQL como UTF-8 y elimina BOM (EF BB BF) para que Postgres no falle con `syntax error at or near "` */
export function readSqlFileUtf8NoBom(absolutePath: string): string {
  const buf = fs.readFileSync(absolutePath);
  const start =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  return buf.subarray(start).toString('utf8');
}
