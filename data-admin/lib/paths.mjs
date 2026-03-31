import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (Solar-Selector), regardless of cwd */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const paths = {
    repoRoot: REPO_ROOT,
    panelsDir: path.join(REPO_ROOT, "src", "data", "panels"),
    controllersDir: path.join(REPO_ROOT, "src", "data", "controllers"),
    dataAdminDir: path.join(REPO_ROOT, "data-admin"),
    schemaDir: path.join(REPO_ROOT, "data-admin", "schema"),
    configDir: path.join(REPO_ROOT, "data-admin", "config"),
    logsDir: path.join(REPO_ROOT, "logs"),
    changelogsDir: path.join(REPO_ROOT, "changelogs"),
};

/** Ensure path is inside base (no traversal); works on Windows */
export function assertUnderBase(resolvedPath, base) {
    const rel = path.relative(path.normalize(base), path.normalize(resolvedPath));
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error("Path escapes allowed directory");
    }
}
