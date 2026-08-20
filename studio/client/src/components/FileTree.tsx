/** MindBuild Studio design reminder: factual Android Studio file map, warm industrial detail, RTL-friendly hierarchy. */

import { ChevronDown, ChevronLeft, FileCode2, FileJson2, Folder, Image } from "lucide-react";
import type { ProjectFile } from "@/lib/androidProject";

type TreeNode = { name: string; path: string; children: Map<string, TreeNode>; isFile: boolean };

function makeTree(files: ProjectFile[]) {
  const root: TreeNode = { name: "", path: "", children: new Map(), isFile: false };
  files.forEach((file) => {
    let node = root;
    file.path.split("/").forEach((name, index, parts) => {
      const nextPath = node.path ? `${node.path}/${name}` : name;
      if (!node.children.has(name)) node.children.set(name, { name, path: nextPath, children: new Map(), isFile: index === parts.length - 1 });
      node = node.children.get(name)!;
    });
  });
  return root;
}

function iconFor(name: string, isFile: boolean) {
  if (!isFile) return <Folder size={16} strokeWidth={1.8} />;
  if (/\.(png|webp|jpg|jpeg|xml)$/i.test(name) && !/\.xml$/i.test(name)) return <Image size={15} strokeWidth={1.8} />;
  if (/\.(gradle|kts|toml|properties|json)$/i.test(name)) return <FileJson2 size={15} strokeWidth={1.8} />;
  return <FileCode2 size={15} strokeWidth={1.8} />;
}

function Branch({ node, depth, activePath, onPick }: { node: TreeNode; depth: number; activePath: string; onPick: (path: string) => void }) {
  const children = Array.from(node.children.values()).sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
  return <>{children.map((child) => <div key={child.path}>
    <button className={`tree-row ${child.path === activePath ? "is-active" : ""}`} style={{ paddingInlineStart: `${depth * 14 + 8}px` }} onClick={() => child.isFile ? onPick(child.path) : undefined} type="button">
      {child.isFile ? <span className="tree-placeholder" /> : <ChevronDown size={13} className="tree-chevron" />}
      <span className="tree-icon">{iconFor(child.name, child.isFile)}</span>
      <span>{child.name}</span>
    </button>
    {!child.isFile && <Branch node={child} depth={depth + 1} activePath={activePath} onPick={onPick} />}
  </div>)}</>;
}

export function FileTree({ files, activePath, onPick }: { files: ProjectFile[]; activePath: string; onPick: (path: string) => void }) {
  const tree = makeTree(files);
  return <div className="file-tree" dir="ltr">
    <div className="tree-root"><ChevronLeft size={14} /> <span>Android Project</span><span className="tree-count">{files.length}</span></div>
    <Branch node={tree} depth={0} activePath={activePath} onPick={onPick} />
  </div>;
}
