import { useEffect, useState } from "react";
import { SilqCompiler } from "../../../backend/src/compiler/SilqCompiler";
import type { ProgramNode, StatementNode } from "../../../backend/src/compiler/types";
import { useIDEStore } from "../store/ideStore";

const compiler = new SilqCompiler();
export function AstExplorer(): JSX.Element {
  const source = useIDEStore((state) => state.tabs.find((tab) => tab.id === state.activeTab)?.content ?? ""); const selectAst = useIDEStore((state) => state.selectAst); const [ast, setAst] = useState<ProgramNode>();
  useEffect(() => { let active = true; const timer = window.setTimeout(() => { void compiler.parse(source).then((result) => { if (active) setAst(result); }); }, 180); return () => { active = false; window.clearTimeout(timer); }; }, [source]);
  return <section className="ast"><div className="subheading">AST EXPLORER</div>{ast ? <AstNode label="Program" node={ast} select={selectAst} /> : <p className="muted">Parsing source…</p>}</section>;
}
function AstNode({ label, node, select }: { label: string; node: ProgramNode | StatementNode; select(range: { start: number; end: number }): void }): JSX.Element { const children = node.kind === "Program" || node.kind === "Function" ? node.body : []; return <details open className="ast-node"><summary onClick={() => select(node.range)}>{label}{"name" in node ? ` · ${node.name}` : ""}</summary>{children.map((child, index) => <AstNode key={`${child.range.start}-${index}`} label={child.kind} node={child} select={select} />)}</details>; }
