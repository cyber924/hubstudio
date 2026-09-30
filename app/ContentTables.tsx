export type ContentTable = { title: string; columns: string[]; rows: string[][] };
export default function ContentTables({ tables }: { tables?: ContentTable[] }) {
  if (!tables?.length) return null;
  return <div className="content-tables">{tables.map((table, i) => <section key={i}><h2>{table.title}</h2><div className="table-scroll"><table><thead><tr>{table.columns.map((column, j) => <th key={j} scope="col">{column}</th>)}</tr></thead><tbody>{table.rows.map((row, j) => <tr key={j}>{table.columns.map((_, k) => <td key={k}>{row[k] || "—"}</td>)}</tr>)}</tbody></table></div></section>)}</div>;
}
