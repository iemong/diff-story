declare module "parse-diff" {
  export interface Change {
    type: "normal" | "add" | "del";
    content: string;
  }
  export interface Chunk {
    content: string;
    changes: Change[];
  }
  export interface File {
    from?: string;
    to?: string;
    additions: number;
    deletions: number;
    chunks: Chunk[];
  }
  export default function parseDiff(input?: string): File[];
}
