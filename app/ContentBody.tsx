import { documentBlocks, type ContentBlock } from "./lib/content-blocks";

export default function ContentBody({ body, blocks }: { body?: string; blocks?: ContentBlock[] }) {
  return <div className="structured-body">{documentBlocks(body || "", blocks).map((block, i) => block.kind === "heading" ? <h3 key={i}>{block.text}</h3> : block.kind === "list" ? <ul key={i}>{block.items?.map((item, j) => <li key={j}>{item}</li>)}</ul> : block.kind === "callout" ? <aside className="document-callout" key={i}>{block.text}</aside> : <p key={i}>{block.text}</p>)}</div>;
}
