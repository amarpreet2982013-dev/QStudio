import { useIDEStore } from "../store/ideStore";
import { AstExplorer } from "./AstExplorer";

export function Explorer(): JSX.Element {
  const { projectRoot, files, setProject, openTab, log } = useIDEStore();
  const openProject = async () => { const root = await window.silq?.openProject(); if (!root) return; const tree = await window.silq?.files(root) ?? []; setProject(root, tree); log(`Opened workspace: ${root}`); };
  const select = async (node: FileNode) => { if (node.kind === "directory") return; const content = await window.silq?.readFile(node.path) ?? ""; openTab({ id: node.path, path: node.path, title: node.name, content }); };
  return <aside className="explorer"><div className="panel-title">EXPLORER <button onClick={openProject}>＋</button></div>{projectRoot ? <><div className="root-name">⌄ {projectRoot.split("/").pop()}</div><Tree nodes={files} onSelect={select} /></> : <div className="explorer-empty"><p>No folder opened</p><button className="primary" onClick={openProject}>Open Project</button><p className="muted">or start with the included Bell state</p></div>}<AstExplorer /></aside>;
}
function Tree({ nodes, onSelect }: { nodes: FileNode[]; onSelect(node: FileNode): void }) { return <ul className="tree">{nodes.map((node) => <li key={node.path}><button onClick={() => onSelect(node)}>{node.kind === "directory" ? "⌄ 📁" : "◇"} {node.name}</button>{node.children && <Tree nodes={node.children} onSelect={onSelect} />}</li>)}</ul>; }
