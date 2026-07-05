// Retrieval limits for the design intelligence database.
//
// morph scores the entire merged corpus on every transform. These limits
// control how many matches feed insight synthesis — not how many are searched.

/** Every reference with score > 0 is scored; this caps returned matches. */
export const RETRIEVAL_MATCH_LIMIT = 128;

/** All returned matches participate in pattern/profile voting. */
export const INSIGHTS_MATCH_LIMIT = 128;

/** Pattern IDs ranked from corpus signal aggregation. */
export const INSIGHTS_PATTERN_LIMIT = 32;

/** References listed in transform receipts (UI display). */
export const RECEIPT_REFERENCE_LIMIT = 32;
