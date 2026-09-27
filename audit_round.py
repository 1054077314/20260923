# -*- coding: utf-8 -*-
"""轮次审计：对比采集前后的快照，输出总数/新增/下架/重复/坐标成功率"""
import json, sys
from collections import Counter

before_path, after_path, label = sys.argv[1], sys.argv[2], sys.argv[3]

before = json.load(open(before_path, encoding="utf-8"))
after = json.load(open(after_path, encoding="utf-8"))

b_ids = {x["id"]: x for x in before}
a_ids = {x["id"]: x for x in after}

added = sorted(set(a_ids) - set(b_ids))
removed = sorted(set(b_ids) - set(a_ids))
kept = set(b_ids) & set(a_ids)

id_list = [x["id"] for x in after]
dup_ids = {k: v for k, v in Counter(id_list).items() if v > 1}

def coord_stats(recs):
    total = len(recs)
    with_c = [x for x in recs if x.get("coordinates")]
    amap = [x for x in with_c if x.get("coordinateSource") == "amap"]
    dict_s = [x for x in with_c if x.get("coordinateSource") == "local_dict"]
    return {"total": total, "with_coords": len(with_c),
            "amap": len(amap), "local_dict": len(dict_s),
            "unresolved": total - len(with_c),
            "rate": f"{len(with_c)*100//total}%" if total else "0%"}

# 检查被保留的记录字段是否被污染（kept 记录内容应不变，除非坐标新增——允许）
field_changed = []
for i in kept:
    b, a = b_ids[i], a_ids[i]
    diff = [k for k in set(b) | set(a) if b.get(k) != a.get(k)]
    if diff:
        field_changed.append({"id": i, "changed": diff})

print(json.dumps({
    "round": label,
    "total_before": len(before),
    "total_after": len(after),
    "by_mode_after": dict(Counter(x["rentMode"] for x in after)),
    "by_capturedAt_after": dict(Counter(x.get("capturedAt") for x in after)),
    "added": len(added), "added_sample": added[:5],
    "removed": len(removed), "removed_sample": removed[:5],
    "kept_unchanged": len(kept) - len(field_changed),
    "kept_field_changed": len(field_changed),
    "field_changed_detail": field_changed[:5],
    "duplicate_ids": len(dup_ids),
    "dup_detail": dict(list(dup_ids.items())[:5]),
    "coords_before": coord_stats(before),
    "coords_after": coord_stats(after),
}, ensure_ascii=False, indent=1))
