"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceGuard = exports.WorkspaceGuard = exports.DEFAULT_MAX_FILE_SIZE = void 0;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
exports.DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
class WorkspaceGuard {
    workspaceRoots = new Set();
    /**
     * Adds an authorized workspace root, resolving any symlinks in its path.
     */
    async addWorkspace(root) {
        if (!root || typeof root !== "string" || root.trim() === "") {
            throw new Error("Invalid workspace root: path must be a non-empty string.");
        }
        if (root.includes("\0")) {
            throw new Error("Invalid workspace root: null bytes are not permitted.");
        }
        const resolved = node_path_1.default.resolve(root);
        const stat = await promises_1.default.stat(resolved);
        if (!stat.isDirectory()) {
            throw new Error(`Workspace root must be a directory: ${resolved}`);
        }
        const canonical = await promises_1.default.realpath(resolved);
        this.workspaceRoots.add(canonical);
        return canonical;
    }
    removeWorkspace(root) {
        const resolved = node_path_1.default.resolve(root);
        this.workspaceRoots.delete(resolved);
        // Also try to remove matching canonical entry
        for (const ws of this.workspaceRoots) {
            if (ws === resolved) {
                this.workspaceRoots.delete(ws);
            }
        }
    }
    getWorkspaces() {
        return Array.from(this.workspaceRoots);
    }
    hasWorkspace(root) {
        const resolved = node_path_1.default.resolve(root);
        return this.workspaceRoots.has(resolved);
    }
    clear() {
        this.workspaceRoots.clear();
    }
    /**
     * Validates that targetPath is within at least one active workspace.
     * Resolves symlinks to ensure traversal or symlink-escape cannot bypass boundaries.
     */
    async validateWithinWorkspace(targetPath, options = {}) {
        if (!targetPath || typeof targetPath !== "string" || targetPath.trim() === "") {
            throw new Error("Access denied: path must be a non-empty string.");
        }
        if (targetPath.includes("\0")) {
            throw new Error("Access denied: null bytes in path.");
        }
        if (this.workspaceRoots.size === 0) {
            throw new Error("Access denied: no authorized workspace is open.");
        }
        const resolved = node_path_1.default.resolve(targetPath);
        if (options.forWrite) {
            // If the file exists, resolve its real path; if not, resolve its parent directory
            let existingTarget;
            try {
                await promises_1.default.lstat(resolved);
                existingTarget = resolved;
            }
            catch {
                existingTarget = undefined;
            }
            if (existingTarget) {
                const canonical = await promises_1.default.realpath(existingTarget);
                this.assertCanonicalInside(canonical);
                return canonical;
            }
            // File does not exist yet: find the closest existing ancestor directory
            let curr = node_path_1.default.dirname(resolved);
            let existingAncestor;
            while (curr !== node_path_1.default.dirname(curr)) {
                try {
                    const stat = await promises_1.default.stat(curr);
                    if (stat.isDirectory()) {
                        existingAncestor = curr;
                        break;
                    }
                }
                catch {
                    // continue moving up
                }
                curr = node_path_1.default.dirname(curr);
            }
            if (!existingAncestor) {
                throw new Error("Access denied: no valid ancestor directory found for path.");
            }
            const canonicalAncestor = await promises_1.default.realpath(existingAncestor);
            this.assertCanonicalInside(canonicalAncestor);
            const relFromExisting = node_path_1.default.relative(existingAncestor, resolved);
            const candidateCanonical = node_path_1.default.resolve(canonicalAncestor, relFromExisting);
            this.assertCanonicalInside(candidateCanonical);
            return candidateCanonical;
        }
        // Read / inspect mode: file/directory must exist and its canonical path must be inside workspace
        let canonical;
        try {
            canonical = await promises_1.default.realpath(resolved);
        }
        catch (error) {
            throw new Error(`Access denied: cannot resolve path '${targetPath}': ${error instanceof Error ? error.message : String(error)}`);
        }
        this.assertCanonicalInside(canonical);
        return canonical;
    }
    /**
     * Helper that asserts a canonical absolute path is located inside at least one authorized workspace root.
     */
    assertCanonicalInside(canonicalPath) {
        const isInside = Array.from(this.workspaceRoots).some((ws) => {
            const rel = node_path_1.default.relative(ws, canonicalPath);
            return rel === "" || (!rel.startsWith("..") && !node_path_1.default.isAbsolute(rel));
        });
        if (!isInside) {
            throw new Error("Access is restricted to an open workspace.");
        }
    }
    /**
     * Reads a file within the workspace subject to size limits.
     */
    async readFile(targetPath, maxBytes = exports.DEFAULT_MAX_FILE_SIZE) {
        const canonical = await this.validateWithinWorkspace(targetPath);
        const stat = await promises_1.default.stat(canonical);
        if (!stat.isFile()) {
            throw new Error("Access denied: path is not a regular file.");
        }
        if (stat.size > maxBytes) {
            throw new Error(`File size (${stat.size} bytes) exceeds limit of ${maxBytes} bytes.`);
        }
        return promises_1.default.readFile(canonical, "utf8");
    }
    /**
     * Writes a file within the workspace subject to size limits.
     */
    async writeFile(targetPath, contents, maxBytes = exports.DEFAULT_MAX_FILE_SIZE) {
        const byteLength = Buffer.byteLength(contents, "utf8");
        if (byteLength > maxBytes) {
            throw new Error(`File contents (${byteLength} bytes) exceed limit of ${maxBytes} bytes.`);
        }
        const canonical = await this.validateWithinWorkspace(targetPath, { forWrite: true });
        // If an existing file is a symlink, verify its target is also within workspace boundaries
        try {
            const lstat = await promises_1.default.lstat(canonical);
            if (lstat.isSymbolicLink()) {
                const real = await promises_1.default.realpath(canonical);
                this.assertCanonicalInside(real);
            }
        }
        catch {
            // Path does not exist yet; safe to create
        }
        await promises_1.default.mkdir(node_path_1.default.dirname(canonical), { recursive: true });
        await promises_1.default.writeFile(canonical, contents, "utf8");
    }
    /**
     * Recursively reads directory tree, protecting against symlink escapes and deep recursion.
     */
    async readTree(root, currentDepth = 0, maxDepth = 15, visited = new Set()) {
        const canonicalRoot = await this.validateWithinWorkspace(root);
        if (currentDepth > maxDepth) {
            return [];
        }
        if (visited.has(canonicalRoot)) {
            // Loop protection
            return [];
        }
        visited.add(canonicalRoot);
        const entries = await promises_1.default.readdir(canonicalRoot, { withFileTypes: true });
        const nodes = [];
        for (const entry of entries) {
            if (entry.name.startsWith(".")) {
                continue;
            }
            const itemPath = node_path_1.default.join(canonicalRoot, entry.name);
            try {
                if (entry.isSymbolicLink()) {
                    const targetReal = await promises_1.default.realpath(itemPath);
                    // Only follow if target is inside an authorized workspace
                    try {
                        this.assertCanonicalInside(targetReal);
                    }
                    catch {
                        // Symlink points outside workspace; skip it
                        continue;
                    }
                    const stat = await promises_1.default.stat(targetReal);
                    if (stat.isDirectory()) {
                        nodes.push({
                            name: entry.name,
                            path: itemPath,
                            kind: "directory",
                            children: await this.readTree(targetReal, currentDepth + 1, maxDepth, visited),
                        });
                    }
                    else {
                        nodes.push({ name: entry.name, path: itemPath, kind: "file" });
                    }
                }
                else if (entry.isDirectory()) {
                    nodes.push({
                        name: entry.name,
                        path: itemPath,
                        kind: "directory",
                        children: await this.readTree(itemPath, currentDepth + 1, maxDepth, visited),
                    });
                }
                else {
                    nodes.push({ name: entry.name, path: itemPath, kind: "file" });
                }
            }
            catch {
                // Unreadable file / broken link; ignore gracefully
            }
        }
        return nodes;
    }
}
exports.WorkspaceGuard = WorkspaceGuard;
exports.workspaceGuard = new WorkspaceGuard();
