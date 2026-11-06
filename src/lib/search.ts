import { plain } from "./text";

export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_MAX_TERMS = 8;

// Như mgst-app: cắt trần ở máy chủ vì URL gõ tay không qua maxLength của ô tìm, mỗi từ thành một điều kiện.
export const searchTerms = (q: string): string[] => plain(q.slice(0, SEARCH_MAX_LENGTH)).trim().split(/\s+/).filter(Boolean).slice(0, SEARCH_MAX_TERMS);
