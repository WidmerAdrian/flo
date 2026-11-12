"""Build a textured, posed, web-ready human (MPFB2 / MakeHuman CC0 assets) and export body.glb.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python make_body.py

Needs the MPFB extension (extensions.blender.org id "mpfb") and the MakeHuman system asset
pack (makehuman_system_assets_cc0.zip) unpacked into MPFB's user data dir. See SOURCES.md.

Output: ONE mesh / ONE primitive / ONE material (alphaMode MASK, double-sided) with one
2048x2048 RGBA PNG atlas holding skin, eyes, baked eyebrows, hair and the modelled shorts.
Writes body.glb + preview-{front,threequarter,back,head,hips}.png next to this script.
"""
import os
import json
import math
import struct
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.assetservice import AssetService
from bl_ext.user_default.mpfb.services.objectservice import ObjectService

OUT = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(OUT, "body.glb")

# ---- tunables -------------------------------------------------------------------------------
HEIGHT = 1.80
SKIN = "young_caucasian_male.mhmat"
EYES = "high-poly.mhclo"
EYE_MAT = "brownlight.mhmat"
BROWS = "eyebrow002.mhclo"
HAIR = "short02.mhclo"
HAIR_TINT = (0.42, 0.34, 0.30)   # multiplies the (mid brown) hair texture -> dark brown
UPPERARM_DEG = 18      # upper arm angle from vertical (A-pose)
FOREARM_DEG = 21       # forearm angle from vertical
FOREARM_FWD = 0.12     # slight natural elbow bend (forward component of forearm direction)
LEG_SPREAD_DEG = -3.0  # per-leg abduction (negative = bring feet closer; MH rest stance is wide)
# shorts (metres, final scale)
WAIST_BELOW_NAVEL = 0.035
BAND = 0.035           # waistband height
SPLIT_ABOVE_CROTCH = 0.05   # where the pelvis tube splits into two legs (front/back centre seam)
CROTCH_GAP = 0.035     # shorts crotch hangs this far below the body's crotch
HEM_BELOW_CROTCH = 0.16     # ~mid-thigh
FLARE = 0.028          # leg opening stand-off at the hem
CLEAR_BAND, CLEAR_HIP, CLEAR_LEG = 0.006, 0.013, 0.017   # min distance fabric <-> skin
FABRIC = "#0f3a2c"     # deep forest green
BAND_LIGHTEN = 1.6
TEX = 2048
QUANT = 4              # PNG colour quantisation step (1 = lossless)
BG = "#0b2219"


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def select_only(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


# ---- 1. character ---------------------------------------------------------------------------
def build_human():
    info = HumanService._create_default_human_info_dict()
    info["phenotype"].update(gender=1.0, age=0.5, muscle=0.68, weight=0.5, proportions=1.0, height=0.6)
    info["phenotype"]["race"] = {"asian": 0.0, "caucasian": 1.0, "african": 0.0}
    info["rig"] = "default"
    info["eyes"] = EYES
    info["eyebrows"] = BROWS
    info["hair"] = HAIR
    info["skin_material_type"] = "NONE"   # we build our own single material
    s = HumanService.get_default_deserialization_settings()
    s["subdiv_levels"] = 0
    body = HumanService.deserialize_from_dict(info, s)
    find = ObjectService.find_object_of_type_amongst_nearest_relatives
    return body, body.parent, find(body, "Eyes"), find(body, "Eyebrows"), find(body, "Hair")


def rotate_bone(rig, name, q):
    """Rotate pose bone `name` by world quaternion q about its head."""
    pb = rig.pose.bones[name]
    m = pb.matrix.copy()
    h = m.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ m
    bpy.context.view_layer.update()


def aim_bone(rig, name, d):
    pb = rig.pose.bones[name]
    cur = (pb.tail - pb.head).normalized()
    rotate_bone(rig, name, cur.rotation_difference(d.normalized()))


def pose(rig):
    for side, sx in (("L", 1), ("R", -1)):
        up = Vector((sx * math.sin(math.radians(UPPERARM_DEG)), 0.02, -math.cos(math.radians(UPPERARM_DEG))))
        fa = Vector((sx * math.sin(math.radians(FOREARM_DEG)), -FOREARM_FWD, -math.cos(math.radians(FOREARM_DEG))))
        for b in ("upperarm01", "upperarm02"):
            aim_bone(rig, f"{b}.{side}", up)
        for b in ("lowerarm01", "lowerarm02", "wrist"):
            aim_bone(rig, f"{b}.{side}", fa)
        # twist forearm so the palm faces the thigh: index->pinky knuckle vector should point backwards (+Y)
        P = rig.pose.bones
        axis = (P[f"lowerarm02.{side}"].tail - P[f"lowerarm01.{side}"].head).normalized()
        a = P[f"finger5-1.{side}"].head - P[f"finger2-1.{side}"].head
        a = (a - axis * a.dot(axis)).normalized()
        want = Vector((0, 1, 0))
        want = (want - axis * want.dot(axis)).normalized()
        ang = math.atan2(axis.dot(a.cross(want)), a.dot(want))
        for b in ("lowerarm01", "lowerarm02"):
            rotate_bone(rig, f"{b}.{side}", Quaternion(axis, ang / 2))
        # legs: MH rest stance is wide; bring the feet in a little, keep the soles flat
        rotate_bone(rig, f"upperleg01.{side}", Quaternion(Vector((0, 1, 0)), -sx * math.radians(LEG_SPREAD_DEG)))
        rotate_bone(rig, f"foot.{side}", Quaternion(Vector((0, 1, 0)), sx * math.radians(LEG_SPREAD_DEG)))


def bake_down(objs):
    """Apply shape keys + all modifiers (mask, armature) -> plain meshes."""
    for o in objs:
        select_only([o])
        bpy.ops.object.convert(target="MESH")
        o.parent = None


def rest_coords(body):
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    co = np.array([v.co[:] for v in me.vertices])
    ev.to_mesh_clear()
    return co


def load_tex(mhmat_path, key="diffuseTexture"):
    name = next(l.split(None, 1)[1].strip() for l in open(mhmat_path) if l.startswith(key))
    return bpy.data.images.load(os.path.join(os.path.dirname(mhmat_path), os.path.basename(name)))


def img_np(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


# ---- 2. landmarks ---------------------------------------------------------------------------
def navel_z(body, skin_img):
    """Darkest texel around the navel in the skin texture -> nearest body vertex by UV -> its height."""
    px = img_np(skin_img)[..., :3].mean(-1)
    h, w = px.shape
    u0, v0, r = 0.375, 0.5625, 0.035
    sub = px[int((v0 - r) * h):int((v0 + r) * h), int((u0 - r) * w):int((u0 + r) * w)]
    iy, ix = np.unravel_index(np.argmin(sub), sub.shape)
    uv = Vector(((int((u0 - r) * w) + ix) / w, (int((v0 - r) * h) + iy) / h))
    uvl = body.data.uv_layers.active.data
    best = min(body.data.loops, key=lambda l: (Vector(uvl[l.index].uv) - uv).length)
    return body.data.vertices[best.vertex_index].co.z


# ---- 3. loose shorts, built as rings around the body and relaxed against it -----------------
def build_shorts(body, keep, crotch, waist):
    """keep[i]: body vertex i belongs to torso/legs (not arms). Returns a new mesh object."""
    bm = bmesh.new(); bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    faces = [f for f in bm.faces if all(keep[v.index] for v in f.verts)]
    co = np.array([v.co[:] for v in bm.verts])
    bvh = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in faces])
    bm.free()

    def ray_out(c, d, inward=True):
        """Distance from centre c to the body surface along horizontal dir d."""
        if inward:  # from outside towards c: outermost surface (bridges hidden folds)
            hit = bvh.ray_cast(c + d * 0.5, -d, 0.5)
            return 0.5 - hit[3] if hit[0] else None
        hit = bvh.ray_cast(c, d, 0.4)
        return hit[3] if hit[0] else None

    z_split = crotch + SPLIT_ABOVE_CROTCH
    z_hem = crotch - HEM_BELOW_CROTCH
    M, m, K = 34, 8, 16            # half-ring columns, crotch-seam segments, leg rings
    zs = [waist, waist - 0.012, waist - 0.024, waist - BAND, waist - BAND - 0.004]
    zs += list(np.linspace(zs[-1], z_split, 6)[1:])

    def clear_at(z):
        return CLEAR_BAND if z > waist - BAND - 0.001 else CLEAR_HIP

    P = []
    for z in zs:
        sl = keep & (np.abs(co[:, 2] - z) < 0.012) & (np.abs(co[:, 0]) < 0.25)
        yc = (co[sl, 1].min() + co[sl, 1].max()) / 2
        c = Vector((0, yc, z))
        th = np.linspace(0, math.pi, M + 1)
        r = np.array([ray_out(c, Vector((math.sin(t), -math.cos(t), 0))) or 0.0 for t in th])
        r = np.concatenate([r[3:0:-1], r, r[-2:-5:-1]])          # mirror-extend for the window ops
        r = np.array([r[i:i + 7].max() for i in range(M + 1)])   # dilate: bridge cleft and navel
        r = np.convolve(np.pad(r, 1, mode="edge"), [0.25, 0.5, 0.25], "valid")
        ring = [c + Vector((math.sin(t), -math.cos(t), 0)) * (ri + clear_at(z)) for t, ri in zip(th, r)]
        ring[0].x = ring[-1].x = 0.0
        P.append(ring)

    # crotch seam (x = 0) from back-centre to front-centre, dipping below the body's crotch
    F, B = P[-1][0], P[-1][-1]
    depth = z_split - (crotch - CROTCH_GAP)
    S = [Vector((0, B.y + (F.y - B.y) * (j / m), z_split - depth * math.sin(math.pi * j / m))) for j in range(1, m)]
    top = P[-1] + S                                   # closed left-leg top ring
    cT = sum((p for p in top), Vector()) / len(top)
    sl = keep & (np.abs(co[:, 2] - z_hem) < 0.012) & (co[:, 0] > 0.01)
    cH = Vector((co[sl, 0].mean(), co[sl, 1].mean(), z_hem))
    hem = []
    for p in top:
        d = Vector((p.x - cT.x, p.y - cT.y, 0)).normalized()
        R = ray_out(cH, d, inward=False) or 0.07
        q = cH + d * (R + FLARE)
        q.x = max(q.x, 0.008)                         # never cross the midline (gap between legs)
        hem.append(q)
    L = [[top[j].lerp(hem[j], k / K) for j in range(len(top))] for k in range(K + 1)]

    # assemble left half, mirror to the right, weld the x = 0 seams
    verts, quads = [], []

    def grid(rows, closed):
        base = len(verts)
        n = len(rows[0])
        for row in rows:
            verts.extend(row)
        for k in range(len(rows) - 1):
            for j in range(n if closed else n - 1):
                j2 = (j + 1) % n
                quads.append((base + k * n + j, base + k * n + j2, base + (k + 1) * n + j2, base + (k + 1) * n + j))
    grid(P, False)
    grid(L, True)
    nh = len(verts)
    verts += [Vector((-v.x, v.y, v.z)) for v in verts]
    quads += [tuple(i + nh for i in reversed(q)) for q in quads]

    bm = bmesh.new()
    bv = [bm.verts.new(v) for v in verts]
    for q in quads:
        try:
            bm.faces.new([bv[i] for i in q])
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    # relax: Laplacian smooth (drape) + keep a minimum distance to the skin (no poke-through)
    bm.verts.ensure_lookup_table()
    boundary = {v.index for v in bm.verts if v.is_boundary}
    nb = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    X = np.array([v.co[:] for v in bm.verts])
    for it in range(8):
        Y = X.copy()
        for i, n in enumerate(nb):
            if i not in boundary:
                Y[i] = X[i] * 0.4 + X[n].mean(0) * 0.6
        X = Y
        for i in range(len(X)):
            p = Vector(X[i])
            loc, nrm, _, dist = bvh.find_nearest(p)
            if loc is None:
                continue
            want = CLEAR_BAND if p.z > waist - BAND - 0.001 else (CLEAR_HIP if p.z > crotch else CLEAR_LEG)
            off = (p - loc).dot(nrm)
            if off < want:
                X[i] = loc + nrm * want
    # soft vertical folds on the legs, growing towards the hem
    for i in range(len(X)):
        z = X[i][2]
        if z < crotch:
            t = min(1.0, (crotch - z) / (crotch - z_hem))
            c = np.array([math.copysign(cH.x, X[i][0]), cH.y])
            d = X[i][:2] - c
            phi = math.atan2(d[1], d[0])
            X[i][:2] += d / (np.linalg.norm(d) + 1e-9) * 0.004 * t ** 1.5 * (math.sin(6 * phi + 0.8) + 0.4)
    for v, x in zip(bm.verts, X):
        v.co = x

    # rolled edges: turn the waist and hem boundaries inwards (visible thickness, rounded lip)
    for loop_edges in _boundary_loops(bm):
        vs = loop_edges
        is_waist = vs[0].co.z > crotch
        ctr = sum((v.co for v in vs), Vector()) / len(vs)
        sgn = 1 if is_waist else -1
        A, Bv = {}, {}
        for v in vs:
            inward = ctr - v.co; inward.z = 0; inward.normalize()
            A[v] = bm.verts.new(v.co + inward * 0.003 + Vector((0, 0, sgn * 0.003)))
            Bv[v] = bm.verts.new(v.co + inward * 0.006 - Vector((0, 0, sgn * (0.03 if is_waist else 0.02))))
        for a, b in zip(vs, vs[1:] + vs[:1]):
            for f in ((a, b, A[b], A[a]), (A[a], A[b], Bv[b], Bv[a])):
                try:
                    bm.faces.new(f)
                except ValueError:
                    pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("Shorts")
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("Shorts", me)
    bpy.context.scene.collection.objects.link(ob)
    # band attribute for the fabric shader: 1 on the waistband (outside and folded inside)
    band = np.array([float(v.co.z > waist - BAND - 0.001) for v in me.vertices], np.float32)
    me.attributes.new("band", "FLOAT", "POINT").data.foreach_set("value", band)
    select_only([ob])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers[0].name = "UVMap"
    return ob


def _boundary_loops(bm):
    """Ordered vertex loops along the open boundaries of bm."""
    left = {v for v in bm.verts if v.is_boundary}
    loops = []
    while left:
        cur = left.pop(); loop = [cur]
        while True:
            nxt = next((e.other_vert(cur) for e in cur.link_edges if e.is_boundary and e.other_vert(cur) in left), None)
            if nxt is None:
                break
            left.discard(nxt); loop.append(nxt); cur = nxt
        loops.append(loop)
    return loops


# ---- 4. bake materials ----------------------------------------------------------------------
def node_img(nt, img, uv="UVMap"):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    u = nt.nodes.new("ShaderNodeUVMap"); u.uv_map = uv
    nt.links.new(u.outputs[0], t.inputs[0])
    return t


def emission_mat(name, color_fn, target):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs[0], out.inputs[0])
    nt.links.new(color_fn(nt), em.inputs[0])
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = target
    nt.nodes.active = t
    return m


def rgb(nt, c):
    n = nt.nodes.new("ShaderNodeRGB"); n.outputs[0].default_value = (*c, 1)
    return n.outputs[0]


def mix(nt, a, b, fac=1.0, mode="MIX"):
    n = nt.nodes.new("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = mode
    if isinstance(fac, float):
        n.inputs["Factor"].default_value = fac
    else:
        nt.links.new(fac, n.inputs["Factor"])
    for sock, val in ((n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(val, tuple):
            sock.default_value = (*val, 1)
        else:
            nt.links.new(val, sock)
    return n.outputs[2]


def tex_color(img):
    return lambda nt: node_img(nt, img).outputs["Color"]


def tex_alpha(img):
    def fn(nt):
        a = node_img(nt, img).outputs["Alpha"]
        c = nt.nodes.new("ShaderNodeCombineColor")
        for i in range(3):
            nt.links.new(a, c.inputs[i])
        return c.outputs[0]
    return fn


def const(c):
    return lambda nt: rgb(nt, c)


def hair_color(img):
    def fn(nt):
        t = node_img(nt, img)
        tinted = mix(nt, t.outputs["Color"], HAIR_TINT, 1.0, "MULTIPLY")
        # transparent texels get dark brown, so the MASK edge never shows a white fringe
        return mix(nt, (0.035, 0.022, 0.015), tinted, t.outputs["Alpha"])
    return fn


def fabric_color(nt):
    L = nt.links
    base = hex_lin(FABRIC)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 700.0
    L.new(geo.outputs["Position"], noise.inputs["Vector"])
    nr = nt.nodes.new("ShaderNodeMapRange"); nr.inputs[3].default_value = 0.88; nr.inputs[4].default_value = 1.12
    L.new(noise.outputs["Fac"], nr.inputs[0])
    attr = nt.nodes.new("ShaderNodeAttribute"); attr.attribute_name = "band"
    shade = nt.nodes.new("ShaderNodeMapRange"); shade.inputs[3].default_value = 1.0; shade.inputs[4].default_value = BAND_LIGHTEN
    L.new(attr.outputs["Fac"], shade.inputs[0])
    f = nt.nodes.new("ShaderNodeMath"); f.operation = "MULTIPLY"
    L.new(nr.outputs[0], f.inputs[0]); L.new(shade.outputs[0], f.inputs[1])
    return mix(nt, base, f.outputs[0], 1.0, "MULTIPLY")


def brow_premul(img):
    def fn(nt):
        t = node_img(nt, img)
        return mix(nt, t.outputs["Color"], t.outputs["Alpha"], 1.0, "MULTIPLY")
    return fn


def new_img(name, fill):
    img = bpy.data.images.new(name, TEX, TEX, alpha=True, float_buffer=True)
    img.generated_color = (*fill, 1)
    return img


def main():
    clear_scene()
    body, rig, eyes, brows, hair = build_human()
    parts = [body, eyes, brows, hair]

    co_rest = rest_coords(body)
    pose(rig)
    bake_down(parts)
    bpy.data.objects.remove(rig, do_unlink=True)
    assert len(body.data.vertices) == len(co_rest)

    # scale to HEIGHT, feet on z=0, centred on x=0
    zs = np.array([v.co.z for v in body.data.vertices])
    xs = np.array([v.co.x for v in body.data.vertices])
    s = HEIGHT / (zs.max() - zs.min())
    off = Vector(((-(xs.max() + xs.min()) / 2), 0, -zs.min()))
    for o in parts:
        o.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(off))
        o.data.update()
    co_rest = (co_rest + np.array(off)) * s

    for o in parts:
        o.data.uv_layers.active.name = "UVMap"
        for i in range(len(o.data.uv_layers) - 1, -1, -1):
            if o.data.uv_layers[i].name != "UVMap":
                o.data.uv_layers.remove(o.data.uv_layers[i])

    skin_img = load_tex(AssetService.find_asset_absolute_path(SKIN, "skins"))
    eye_img = load_tex(AssetService.find_asset_absolute_path(EYE_MAT, "eyes"))
    brow_img = load_tex(AssetService.find_asset_absolute_path(BROWS.replace(".mhclo", ".mhmat"), "eyebrows"))
    hair_img = load_tex(AssetService.find_asset_absolute_path(HAIR.replace(".mhclo", ".mhmat"), "hair"))

    # landmarks (final coordinates) and the shorts
    co = np.array([v.co[:] for v in body.data.vertices])
    # crotch from the rest pose (legs apart); in the final pose the inner thighs touch near x = 0
    torso = (np.abs(co_rest[:, 0]) < 0.03) & (co_rest[:, 2] > 0.35 * HEIGHT) & (co_rest[:, 2] < 0.62 * HEIGHT)
    crotch = co_rest[torso, 2].min()
    waist = navel_z(body, skin_img) - WAIST_BELOW_NAVEL
    keep = (np.abs(co_rest[:, 0]) < 0.26) & (co_rest[:, 2] < waist + 0.15)   # rest pose: arms far from hips
    print(f"LANDMARKS crotch={crotch:.3f} waist={waist:.3f}")
    shorts = build_shorts(body, keep, crotch, waist)

    # eyes: drop the cornea shell; its UVs sit on the transparent dot in the eye texture corner
    bm = bmesh.new(); bm.from_mesh(eyes.data)
    uvl = bm.loops.layers.uv.active
    cornea = [f for f in bm.faces if sum(l[uvl].uv.x for l in f.loops) / len(f.loops) > 0.8
              and sum(l[uvl].uv.y for l in f.loops) / len(f.loops) < 0.2]
    bmesh.ops.delete(bm, geom=cornea, context="FACES")
    bm.to_mesh(eyes.data); bm.free()

    # ---- join everything (except brows, they get baked) and pack one atlas UV ----
    rgb_img = new_img("atlas_rgb", (0.5, 0.4, 0.35))
    a_img = new_img("atlas_a", (1, 1, 1))
    scale = {"body": (body, 1.0), "eyes": (eyes, 0.16), "hair": (hair, 0.42), "shorts": (shorts, 0.35)}  # texel density
    for k, (name, (o, f)) in enumerate(scale.items()):
        o.data.materials.clear()
        o.data.materials.append(bpy.data.materials.new("part_" + name))
        at = o.data.uv_layers.new(name="atlas")
        for l in at.data:
            l.uv = (l.uv[0] * f + 2 * k, l.uv[1] * f)   # parts side by side: islands of different parts never overlap
    select_only([o for o, f in scale.values()], body)
    bpy.ops.object.join()
    me = body.data
    me.uv_layers.active = me.uv_layers["atlas"]
    me.uv_layers["atlas"].active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(udim_source="ACTIVE_UDIM", rotate=True, scale=True, merge_overlap=True, margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    slots = {m.name[5:]: i for i, m in enumerate(me.materials)}   # "body", "eyes", "hair", "shorts"

    def bake(fns, target):
        for name, fn in fns.items():
            me.materials[slots[name]] = emission_mat("bake_" + name, fn, target)
        select_only([body])
        bpy.ops.object.bake(type="EMIT", use_clear=False, margin=6)

    bake({"body": tex_color(skin_img), "eyes": tex_color(eye_img), "hair": hair_color(hair_img),
          "shorts": fabric_color}, rgb_img)
    bake({"body": const((1, 1, 1)), "eyes": const((1, 1, 1)), "hair": tex_alpha(hair_img),
          "shorts": const((1, 1, 1))}, a_img)
    base = img_np(rgb_img)
    alpha = img_np(a_img)[..., 0]

    # eyebrows: selected-to-active bake (premultiplied colour + alpha) onto the forehead
    browc, browa = new_img("browc", (0, 0, 0)), new_img("browa", (0, 0, 0))
    for img, fn in ((browc, brow_premul(brow_img)), (browa, tex_alpha(brow_img))):
        for name in slots:
            me.materials[slots[name]] = emission_mat("tgt", const((0, 0, 0)), img)
        brows.data.materials.clear()
        brows.data.materials.append(emission_mat("src", fn, img))
        select_only([brows, body], body)
        bpy.ops.object.bake(type="EMIT", use_selected_to_active=True, cage_extrusion=0.01,
                            max_ray_distance=0.02, use_clear=False, margin=0)
    a = np.clip(img_np(browa)[..., :1] * 1.4, 0, 1)
    c = img_np(browc)[..., :3] * 1.4 * 0.75
    base[..., :3] = base[..., :3] * (1 - a) + c
    base[..., 3] = alpha
    rgb_img.pixels.foreach_set(base.ravel())
    bpy.data.objects.remove(brows, do_unlink=True)

    atlas_path = os.path.join(OUT, "_atlas.png")
    scene.view_settings.view_transform = "Standard"   # plain linear->sRGB
    st = scene.render.image_settings
    st.file_format, st.color_mode, st.color_depth, st.compression = "PNG", "RGBA", "8", 100
    rgb_img.save_render(atlas_path, scene=scene)
    # ponytail: drop the 2 lowest bits of RGB (invisible on skin, ~25% smaller PNG) to stay under the GLB budget
    png = bpy.data.images.load(atlas_path)
    px = img_np(png)
    px[..., :3] = np.minimum(np.round(px[..., :3] * 255 / QUANT) * QUANT / 255, 1.0)
    png.pixels.foreach_set(px.ravel())
    png.save()

    # ---- final single material ----
    me.uv_layers.remove(me.uv_layers["UVMap"])
    me.uv_layers["atlas"].name = "UVMap"
    me.attributes.remove(me.attributes["band"])
    me.materials.clear()
    mat = bpy.data.materials.new("Body")
    mat.use_nodes = True
    mat.use_backface_culling = False      # hair shell + loose shorts are seen from inside
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(atlas_path)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    rnd = nt.nodes.new("ShaderNodeMath"); rnd.operation = "ROUND"   # glTF exporter -> alphaMode MASK
    nt.links.new(t.outputs["Alpha"], rnd.inputs[0]); nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.68
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0
        p.use_smooth = True
    body.name = me.name = "Body"
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print(f"BODY tris={tris} verts={len(me.vertices)} dims={tuple(round(x, 3) for x in body.dimensions)}")

    select_only([body])
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_yup=True,
                              export_image_format="AUTO", export_animations=False,
                              export_skins=False, export_morph=False, export_apply=True)
    os.remove(atlas_path)
    force_mask(GLB)
    print(f"GLB {os.path.getsize(GLB) / 1e6:.2f} MB")
    render_previews()


def force_mask(path):
    """Make sure the material is alphaMode MASK / cutoff 0.5 / double-sided, whatever the exporter guessed."""
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    for m in j["materials"]:
        m.update(alphaMode="MASK", alphaCutoff=0.5, doubleSided=True)
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    rest = b[20 + jl:]
    out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<I4s", len(js), b"JSON") + js + rest
    open(path, "wb").write(out)


# ---- previews: re-import the GLB, so we judge exactly what ships ----------------------------
def render_previews():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=GLB)
    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            pass
    scene.view_settings.view_transform = "Standard"
    st = scene.render.image_settings
    st.file_format, st.color_mode = "PNG", "RGB"
    scene.render.film_transparent = False
    w = bpy.data.worlds.new("w"); scene.world = w
    w.use_nodes = True
    bgn = w.node_tree.nodes["Background"]
    bgn.inputs[0].default_value = (*hex_lin(BG), 1); bgn.inputs[1].default_value = 1.0

    lights = []
    for name, loc, energy, size in (("key", (-2.2, -3.0, 2.8), 260, 2.5), ("fill", (2.8, -2.0, 1.4), 90, 3.0),
                                    ("rim", (0.5, 3.2, 2.6), 160, 2.0), ("rim2", (-1.0, 3.0, 0.8), 60, 2.0)):
        l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.size = size
        o = bpy.data.objects.new(name, l); scene.collection.objects.link(o)
        lights.append((o, Vector(loc)))

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam)
    scene.camera = cam
    views = (("front", 0, 5.6, 1.0, 0.92, 85, (900, 1400)),
             ("threequarter", 35, 5.6, 1.0, 0.92, 85, (900, 1400)),
             ("back", 180, 5.6, 1.0, 0.92, 85, (900, 1400)),
             ("head", 30, 1.3, 1.70, 1.66, 85, (800, 800)),
             ("hips", 25, 2.4, 0.95, 0.88, 85, (800, 800)))
    for name, ang, r, cz, tz, lens, res in views:
        a = math.radians(ang)
        cam.data.lens = lens
        scene.render.resolution_x, scene.render.resolution_y = res
        cam.location = Vector((r * math.sin(a), -r * math.cos(a), cz))
        cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        rot = Matrix.Rotation(a, 4, "Z")   # lights follow the camera
        for o, loc in lights:
            o.location = rot @ loc
            o.rotation_euler = (Vector((0, 0, 1.0)) - o.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT, f"preview-{name}.png")
        bpy.ops.render.render(write_still=True)


main()
