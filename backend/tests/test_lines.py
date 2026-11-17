from bangkok_ai.lines import build_routes


def _rel(rid, ref, node_ids, roles=None):
    roles = roles or ["stop"] * len(node_ids)
    return {
        "type": "relation",
        "id": rid,
        "tags": {"ref": ref, "route": "subway"},
        "members": [
            {"type": "node", "ref": nid, "role": role}
            for nid, role in zip(node_ids, roles)
        ],
    }


def test_ordered_stops_follow_relation_members():
    relations = [
        _rel(1, "สุขุมวิท", [101, 102, 103]),
        _rel(2, "สุขุมวิท", [103, 102, 101]),  # reverse direction
    ]
    id_name = {101: "อา", 102: "บี", 103: "ซี"}
    station_lines = {
        "อา": ["สุขุมวิท"], "บี": ["สุขุมวิท"], "ซี": ["สุขุมวิท"],
    }
    routes = build_routes(relations, id_name, station_lines)
    assert routes["สุขุมวิท"] == ["อา", "บี", "ซี"]


def test_picks_longer_relation_and_dedupes_consecutive():
    relations = [
        _rel(1, "MRT-BL", [201, 202, 203, 204, 205]),
        # longer relation wins even though it comes second
        _rel(2, "MRT-BL", [201, 202, 202, 203, 204, 205, 206],
             roles=["stop", "stop", "platform", "stop", "stop", "stop", "stop"]),
    ]
    id_name = {201: "หนึ่ง", 202: "สอง", 203: "สาม",
               204: "สี่", 205: "ห้า", 206: "หก"}
    station_lines = {n: ["MRT-BL"] for n in id_name.values()}
    routes = build_routes(relations, id_name, station_lines)
    assert routes["MRT-BL"] == ["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก"]


def test_drops_unknown_and_waypoint_nodes():
    relations = [_rel(1, "สีลม", [301, 302, 303, 304])]
    id_name = {301: "ก", 302: "ข", 303: "ค", 304: "ง"}
    # node 304 (ง) is a waypoint, not a known station of the line
    station_lines = {"ก": ["สีลม"], "ข": ["สีลม"], "ค": ["สีลม"]}
    routes = build_routes(relations, id_name, station_lines)
    assert routes["สีลม"] == ["ก", "ข", "ค"]


def test_ignores_unrelated_relations():
    relations = [_rel(1, "not-a-tracked-line", [401, 402])]
    id_name = {401: "x", 402: "y"}
    assert build_routes(relations, id_name, {}) == {}
