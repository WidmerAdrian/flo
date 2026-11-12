# Prepares the body model in Blender. Source: Blender Studio's "Human Base Meshes" bundle (CC0, free for any use):
# https://www.blender.org/download/demo-files/#assets  ->  model/src/human-base-meshes-bundle-v1.4.1/
# The realistic male and female bodies share one topology, so they are averaged into a gender-neutral figure.
# Face and fingers are then softened into a calm, featureless body and exported as model/body.glb, which
# scripts/make-body.mjs turns into the site's mesh.  Run headless:  npm run blender
import bpy, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "model", "src", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend")
OUT_GLB = os.path.join(ROOT, "model", "body.glb")
A, B, MIX = "GEO-body_male_realistic", "GEO-body_female_realistic", 0.0   # MIX 0 = all A (male), 1 = all B (female), 0.5 = neutral blend
HEIGHT = 1.8                  # the site's camera expects this
VOXEL, SMOOTH = 0.01, 16      # how much detail is melted away: larger voxel and more passes = simpler figure

bpy.ops.wm.open_mainfile(filepath=SRC)
a, b = bpy.data.objects[A], bpy.data.objects[B]
assert len(a.data.vertices) == len(b.data.vertices), "the two bodies no longer share a topology"

def normalised(o):
    # vertices with the feet at 0, centred, scaled to one height
    co = [v.co.copy() for v in o.data.vertices]
    zs = [c.z for c in co]; xs = [c.x for c in co]
    z0, h, cx = min(zs), max(zs) - min(zs), (max(xs) + min(xs)) / 2
    return [((c.x - cx) * HEIGHT / h, c.y * HEIGHT / h, (c.z - z0) * HEIGHT / h) for c in co]

pa, pb = normalised(a), normalised(b)
mesh = a.data.copy()
for v, p, q in zip(mesh.vertices, pa, pb):
    v.co = tuple(p[i] * (1 - MIX) + q[i] * MIX for i in range(3))
body = bpy.data.objects.new("body", mesh)
bpy.context.scene.collection.objects.link(body)
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True); bpy.context.view_layer.objects.active = body
sub = body.modifiers.new("subsurf", "SUBSURF"); sub.levels = 2
bpy.ops.object.modifier_apply(modifier="subsurf")
body.data.remesh_voxel_size = VOXEL
bpy.ops.object.voxel_remesh()
sm = body.modifiers.new("smooth", "SMOOTH"); sm.factor = 0.5; sm.iterations = SMOOTH
bpy.ops.object.modifier_apply(modifier="smooth")
# the face and the crotch get more: a calm head, no anatomy
soft = body.vertex_groups.new(name="soft")
for v in body.data.vertices:
    head = min(1.0, max(0.0, (v.co.z - 1.5) / 0.07))
    lap = (1.0 - min(1.0, abs(v.co.x) / 0.1)) * max(0.0, 1.0 - abs(v.co.z - 0.86) / 0.1) if v.co.y < 0.02 else 0.0
    w = max(head, lap)
    if w > 0: soft.add([v.index], w, "REPLACE")
sm2 = body.modifiers.new("soften", "SMOOTH"); sm2.factor = 0.5; sm2.iterations = 60; sm2.vertex_group = "soft"
bpy.ops.object.modifier_apply(modifier="soften")
bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action="DESELECT"); body.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_materials="NONE")
print("exported", OUT_GLB, len(body.data.vertices), "verts", [round(v, 3) for v in body.dimensions])

try:  # three quick looks, so the result can be judged without opening Blender
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 500, 900
    for o in bpy.data.objects: o.hide_render = o is not body
    cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"; cam_data.ortho_scale = 2.0
    cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
    for name, loc, rot in (("front", (0, -5, 0.9), (1.5708, 0, 0)), ("turn", (-3.2, -3.8, 0.9), (1.5708, 0, -0.7)), ("back", (0, 5, 0.9), (1.5708, 0, 3.1416))):
        cam.location, cam.rotation_euler = loc, rot
        scene.render.filepath = os.path.join(ROOT, "model", f"preview-{name}.png")
        bpy.ops.render.render(write_still=True)
except Exception as e:
    print("preview skipped:", e)
