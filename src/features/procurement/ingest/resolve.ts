import { stableId } from "../domain/normalize";

/**
 * Identity resolution (PURE): which stored organisation does each party in a batch belong to?
 *
 * Every party carries identity keys, strongest first ("GB-COH:01234567",
 * "GB-PPON:PABC-1234-DEFG", …, "NAME:acme ltd"). `existing` is what the alias table already
 * knows about those keys and about the entities they point to.
 *
 * Rules
 *  - A party joins the entity its strongest known key points to.
 *  - Keys the alias table has not seen yet become aliases of that entity, so the next
 *    notice that carries only the weaker key (a PPON without the company number) still
 *    lands on the same row.
 *  - If the keys of one party point to two different entities, the entities are merged
 *    (the one reached by the stronger key wins) — unless both hold a different key of the
 *    EXCLUSIVE scheme (two Companies House numbers are two companies, whatever else they share).
 *  - A party with no known key creates an entity whose id is a hash of its strongest key,
 *    so the result does not depend on processing order or on who ran first.
 */
export type OrgRecord = {
  /** Unique within the batch. */
  ref: string;
  keys: string[];
};

export type ResolveOptions = {
  /** Prefix of generated ids ("sup", "buy"). */
  idPrefix: string;
  /** Scheme whose keys can never be shared by one entity, e.g. "GB-COH" for suppliers. */
  exclusiveScheme: string;
};

export type ResolveResult = {
  /** record ref -> entity id */
  entityOf: Map<string, string>;
  /** Aliases to write (new keys, and keys re-pointed by a merge). */
  aliases: Map<string, string>;
  /** Entities folded into another one. */
  merges: Array<{ from: string; into: string }>;
  /** New entity id -> the key it was created from. */
  created: Map<string, string>;
  /** Final alias view (existing + new), for callers that need an entity's full key set. */
  aliasView: Map<string, string>;
};

export function resolveEntities(records: readonly OrgRecord[], existing: ReadonlyMap<string, string>, options: ResolveOptions): ResolveResult {
  const exclusivePrefix = `${options.exclusiveScheme}:`;
  const aliasMap = new Map(existing);
  const mergedInto = new Map<string, string>();
  const exclusiveOf = new Map<string, Set<string>>();
  const created = new Map<string, string>();
  const merges: Array<{ from: string; into: string }> = [];
  const entityOf = new Map<string, string>();

  const find = (id: string): string => {
    let current = id;
    for (let hops = 0; hops < 50; hops += 1) {
      const next = mergedInto.get(current);
      if (!next) return current;
      current = next;
    }
    return current;
  };
  const exclusive = (id: string): Set<string> => {
    let set = exclusiveOf.get(id);
    if (!set) {
      set = new Set();
      exclusiveOf.set(id, set);
    }
    return set;
  };
  for (const [key, id] of existing) if (key.startsWith(exclusivePrefix)) exclusive(id).add(key);

  const compatible = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size === 0 || b.size === 0) return true;
    for (const key of a) if (b.has(key)) return true;
    return false;
  };

  // Deterministic order: the outcome must not depend on how the batch happens to be sorted.
  const ordered = [...records].sort((a, b) => {
    const left = a.keys.join("|");
    const right = b.keys.join("|");
    return left < right ? -1 : left > right ? 1 : a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });

  for (const record of ordered) {
    const keys = [...new Set(record.keys)].filter(Boolean);
    if (keys.length === 0) continue;
    const ownExclusive = new Set(keys.filter((key) => key.startsWith(exclusivePrefix)));

    const hits: string[] = [];
    for (const key of keys) {
      const hit = aliasMap.get(key);
      if (!hit) continue;
      const root = find(hit);
      if (!hits.includes(root)) hits.push(root);
    }

    let target = hits.find((id) => compatible(ownExclusive, exclusive(id)));
    if (!target) {
      target = stableId(options.idPrefix, keys[0]!);
      if (!created.has(target)) created.set(target, keys[0]!);
    } else {
      for (const other of hits) {
        if (other === target) continue;
        if (!compatible(exclusive(target), exclusive(other)) || !compatible(ownExclusive, exclusive(other))) continue;
        mergedInto.set(other, target);
        merges.push({ from: other, into: target });
        for (const key of exclusive(other)) exclusive(target).add(key);
        created.delete(other);
      }
    }

    for (const key of keys) {
      const current = aliasMap.get(key);
      if (current === undefined) {
        aliasMap.set(key, target);
      } else if (find(current) === target) {
        aliasMap.set(key, target);
      }
      // else: the key belongs to an entity we may not merge with; leave it there.
    }
    for (const key of ownExclusive) if (find(aliasMap.get(key)!) === target) exclusive(target).add(key);
    entityOf.set(record.ref, target);
  }

  // Follow merges made later in the batch.
  for (const [ref, id] of entityOf) entityOf.set(ref, find(id));
  const aliases = new Map<string, string>();
  for (const [key, id] of aliasMap) {
    const root = find(id);
    aliasMap.set(key, root);
    if (existing.get(key) !== root) aliases.set(key, root);
  }
  // Collapse merge chains (a -> b, b -> c  =>  a -> c, b -> c).
  const flatMerges = merges.map((merge) => ({ from: merge.from, into: find(merge.into) })).filter((merge) => merge.from !== merge.into);
  return { entityOf, aliases, merges: flatMerges, created, aliasView: aliasMap };
}
