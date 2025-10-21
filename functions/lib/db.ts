export function getDb(DB: D1Database) {
  return {
    async exec(sql: string, params: any[] = []) {
      const stmt = DB.prepare(sql);
      const bound = params.length ? stmt.bind(...params) : stmt;
      return await bound.run();
    },
    async query<T = any>(sql: string, params: any[] = []) {
      const stmt = DB.prepare(sql);
      const bound = params.length ? stmt.bind(...params) : stmt;
      const res = await bound.all<T>();
      return res.results as T[];
    },
    async get<T = any>(sql: string, params: any[] = []) {
      const rows = await this.query<T>(sql, params);
      return rows[0] as T | undefined;
    }
  };
}
