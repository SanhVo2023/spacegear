import { DatabaseSync } from "node:sqlite";
export function database() {
  const sqlite=new DatabaseSync(":memory:");
  return {
    sqlite,
    prepare(sql) { const values=[]; const stmt={
      bind(...args){values.splice(0,values.length,...args);return stmt;},
      async first(){return sqlite.prepare(sql).get(...values)||null;},
      async run(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};},
      async all(){return {success:true,results:sqlite.prepare(sql).all(...values)};},
    };return stmt;},
    async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}},
  };
}
