"""Create an original stylized mute swan, then export public/models/swan.glb.

Reproduce from the project root with Blender on PATH:
  blender --background --python scripts/create_bird.py

Authoring axes: Blender Z up, bird faces -Y, water surface Z = 0.
glTF axes: Y up, bird faces +Z, water surface Y = 0.
No external meshes, textures, add-ons, or random variation are required.
"""

import json
import math
from pathlib import Path
import struct

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / "public" / "models" / "swan.glb"


def material(name, color, roughness=0.78):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name + "_geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def sphere(name, center, scale, mat, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=center
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def interpolate(controls, steps=8):
    """Uniform Catmull-Rom samples of tuples, including cross-section radii."""
    result = []
    for segment in range(len(controls) - 1):
        p0 = controls[max(segment - 1, 0)]
        p1 = controls[segment]
        p2 = controls[segment + 1]
        p3 = controls[min(segment + 2, len(controls) - 1)]
        for step in range(steps):
            t = step / steps
            values = []
            for a, b, c, d in zip(p0, p1, p2, p3):
                values.append(
                    0.5
                    * (
                        2 * b
                        + (-a + c) * t
                        + (2 * a - 5 * b + 4 * c - d) * t * t
                        + (-a + 3 * b - 3 * c + d) * t * t * t
                    )
                )
            result.append(tuple(values))
    result.append(tuple(controls[-1]))
    return result


def swept_mesh(name, sections, mat, sides=24):
    """Sweep elliptical rings through a planar curve with smooth tangents.

    Each section is (x, y, z, side_radius, bend_plane_radius). These centerlines
    live in the YZ plane, allowing a stable X axis with no twisting frame.
    """
    vertices, faces = [], []
    for i, section in enumerate(sections):
        center = Vector(section[:3])
        previous = Vector(sections[max(0, i - 1)][:3])
        following = Vector(sections[min(len(sections) - 1, i + 1)][:3])
        tangent = (following - previous).normalized()
        side = Vector((1.0, 0.0, 0.0))
        other = tangent.cross(side).normalized()
        width, height = max(section[3], 0.001), max(section[4], 0.001)
        for ring in range(sides):
            angle = math.tau * ring / sides
            v = center + side * math.cos(angle) * width + other * math.sin(angle) * height
            vertices.append(tuple(v))
        if i:
            for ring in range(sides):
                a = (i - 1) * sides + ring
                b = (i - 1) * sides + (ring + 1) % sides
                c = i * sides + (ring + 1) % sides
                d = i * sides + ring
                faces.append((a, b, c, d))
    # Close the two ends. Winding is corrected globally below.
    faces.append(tuple(reversed(range(sides))))
    final = (len(sections) - 1) * sides
    faces.append(tuple(final + j for j in range(sides)))
    obj = mesh_object(name, vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


def feather(name, start, end, width, depth, mat, arch=0.035):
    """A closed sculptural feather: one slim lens, tapered rather than spherical."""
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    side = Vector((-axis.y, axis.x, 0.0)).normalized()
    up = side.cross(axis).normalized()
    if up.z < 0:
        up = -up
    vertices, faces = [], []
    count, sides = 19, 10
    for i in range(count):
        t = i / (count - 1)
        center = start.lerp(end, t) + Vector((0, 0, arch * math.sin(math.pi * t)))
        # The broad middle, slender root, and pointed tip read as overlapping
        # primary feathers, with no detached bead-like shapes.
        profile = max(0.008, math.sin(math.pi * t) ** 0.76)
        profile *= 0.88 + 0.20 * t
        for j in range(sides):
            angle = math.tau * j / sides
            point = center + side * (width * profile * math.cos(angle))
            point += up * (depth * profile * math.sin(angle))
            vertices.append(tuple(point))
        if i:
            for j in range(sides):
                faces.append(
                    (
                        (i - 1) * sides + j,
                        (i - 1) * sides + (j + 1) % sides,
                        i * sides + (j + 1) % sides,
                        i * sides + j,
                    )
                )
    faces.append(tuple(reversed(range(sides))))
    offset = (count - 1) * sides
    faces.append(tuple(offset + j for j in range(sides)))
    obj = mesh_object(name, vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


def build_swan():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)

    ivory = material("body_ivory", (0.94, 0.925, 0.86))
    warm_white = material("wing_warm_white", (0.98, 0.97, 0.92))
    wing_shadow = material("wing_blue_grey_shadow", (0.70, 0.76, 0.78))
    wing_middle = material("wing_soft_ivory", (0.88, 0.89, 0.85))
    orange = material("beak_muted_orange", (0.94, 0.37, 0.105), 0.56)
    dark = material("dark_charcoal", (0.026, 0.035, 0.042), 0.5)
    eye = material("dark_eye", (0.008, 0.013, 0.016), 0.28)

    # The full body is a single shaped shell, including its narrow tail root.
    # Its tip-to-breast length is 2.30 m, max width ~1.08 m, and belly dips
    # slightly below the water surface rather than floating above it.
    body_controls = [
        (0, 1.28, 0.43, 0.008, 0.012),
        (0, 1.12, 0.38, 0.16, 0.10),
        (0, 0.87, 0.31, 0.35, 0.25),
        (0, 0.45, 0.30, 0.50, 0.39),
        (0, 0.00, 0.30, 0.54, 0.42),
        (0, -0.42, 0.34, 0.48, 0.38),
        (0, -0.74, 0.39, 0.34, 0.29),
        (0, -0.94, 0.43, 0.16, 0.19),
        (0, -1.02, 0.45, 0.008, 0.018),
    ]
    body = swept_mesh("body_main", interpolate(body_controls, 7), ivory, 32)

    # A single continuous swept neck AND head. No stack of spheres and no
    # head/neck seam. Radii swell gently at the head, then meet the bill base.
    neck_controls = [
        (0, -0.48, 0.43, 0.235, 0.245),
        (0, -0.67, 0.61, 0.186, 0.205),
        (0, -0.88, 0.82, 0.130, 0.143),
        (0, -0.91, 1.02, 0.104, 0.113),
        (0, -0.79, 1.23, 0.092, 0.102),
        (0, -0.70, 1.42, 0.092, 0.104),
        (0, -0.78, 1.55, 0.099, 0.111),
        (0, -0.94, 1.58, 0.122, 0.128),
        (0, -1.10, 1.56, 0.135, 0.121),
        (0, -1.23, 1.51, 0.085, 0.073),
    ]
    neck = swept_mesh("body_continuous_S_neck_and_head", interpolate(neck_controls, 9), ivory, 24)
    # Union the two closed shells so their normals share a real attachment
    # boundary rather than displaying an intersecting-sphere seam at the chest.
    bpy.context.view_layer.objects.active = body
    union = body.modifiers.new("Continuous_chest_attachment", "BOOLEAN")
    union.operation = "UNION"
    union.solver = "EXACT"
    union.object = neck
    bpy.ops.object.modifier_apply(modifier=union.name)
    bpy.data.objects.remove(neck, do_unlink=True)
    for polygon in body.data.polygons:
        polygon.use_smooth = True

    # Lifted wings have one underlying shell and three restrained overlapping
    # primaries each. Dark blue-grey appears only in the lower layer.
    for sign, side_name in [(-1, "left"), (1, "right")]:
        shell = sphere(
            f"wing_{side_name}_underlayer",
            (sign * 0.395, 0.22, 0.595),
            (0.185, 0.69, 0.135),
            wing_shadow,
            28,
            14,
        )
        shell.rotation_euler.x = math.radians(7)
        feather_specs = [
            ((0.465, -0.24, 0.60), (0.545, 1.015, 0.695), 0.116, 0.030, wing_middle),
            ((0.388, -0.40, 0.655), (0.490, 0.93, 0.745), 0.126, 0.034, warm_white),
            ((0.290, -0.43, 0.695), (0.390, 0.76, 0.790), 0.130, 0.036, warm_white),
            ((0.245, -0.42, 0.715), (0.325, 0.46, 0.765), 0.112, 0.030, ivory),
        ]
        for index, (start, end, width, depth, mat) in enumerate(feather_specs):
            start = (start[0] * sign, start[1], start[2])
            end = (end[0] * sign, end[1], end[2])
            feather(f"wing_{side_name}_feather_{index + 1}", start, end, width, depth, mat, arch=0.018)

    # Three tiny pointed tail feathers keep the back silhouette natural.
    for index, x in enumerate((-0.105, 0, 0.105)):
        feather(
            f"body_tail_feather_{index + 1}",
            (x * 0.6, 0.72, 0.49),
            (x, 1.28 + (0.075 if index == 1 else 0.025), 0.535),
            0.090,
            0.027,
            ivory if index == 1 else wing_middle,
            arch=0.018,
        )

    # Small black facial patches and a black basal knob distinguish a mute
    # swan without oversized cartoon eyes or separate white eyeballs.
    for sign, side_name in [(-1, "left"), (1, "right")]:
        patch = sphere(
            f"dark_{side_name}_face_patch",
            (sign * 0.078, -1.215, 1.530),
            (0.014, 0.055, 0.025),
            dark,
            20,
            10,
        )
        patch.rotation_euler.x = math.radians(18)
        sphere(
            f"dark_{side_name}_eye",
            (sign * 0.129, -1.104, 1.594),
            (0.014, 0.014, 0.014),
            eye,
            16,
            8,
        )

    bill_base = [
        (0, -1.205, 1.505, 0.082, 0.054),
        (0, -1.266, 1.491, 0.081, 0.050),
        (0, -1.289, 1.481, 0.076, 0.043),
    ]
    swept_mesh("dark_beak_base", interpolate(bill_base, 4), dark, 16)
    bill = [
        (0, -1.267, 1.486, 0.077, 0.042),
        (0, -1.350, 1.462, 0.066, 0.037),
        (0, -1.424, 1.436, 0.045, 0.027),
        (0, -1.462, 1.426, 0.016, 0.013),
    ]
    swept_mesh("beak_orange_bill", interpolate(bill, 5), orange, 18)
    sphere("dark_beak_knob", (0, -1.251, 1.535), (0.028, 0.035, 0.024), dark, 20, 10)
    for sign, side_name in [(-1, "left"), (1, "right")]:
        sphere(
            f"dark_{side_name}_nostril",
            (sign * 0.060, -1.354, 1.478),
            (0.0055, 0.013, 0.006),
            dark,
            12,
            6,
        )

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    root = bpy.data.objects.new("Swan", None)
    bpy.context.collection.objects.link(root)
    root["authoring"] = "Original procedural model; no external assets"
    root["front_axis_gltf"] = "+Z"
    root["waterline_gltf_y"] = 0.0
    for obj in meshes:
        obj.parent = root
        obj.select_set(True)
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    return meshes


def export_and_report(meshes):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_materials="EXPORT",
        export_normals=True,
        export_texcoords=False,
    )

    # Independently read the export container and check that it has no texture
    # assets, cameras, or extensions requiring optional decoders.
    data = OUTPUT.read_bytes()
    magic, version, total_size = struct.unpack_from("<4sII", data)
    json_size, json_type = struct.unpack_from("<II", data, 12)
    payload = json.loads(data[20 : 20 + json_size])
    assert magic == b"glTF" and version == 2 and total_size == len(data)
    assert json_type == 0x4E4F534A
    assert not payload.get("textures")
    assert not payload.get("cameras")
    assert not payload.get("extensionsRequired")
    assert all(
        any(part in mat["name"] for part in ("body", "wing", "beak", "dark"))
        for mat in payload["materials"]
    )

    world_positions = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    # Blender (x, y, z) maps to glTF (x, z, -y).
    positions = [(v.x, v.z, -v.y) for v in world_positions]
    low = [min(v[axis] for v in positions) for axis in range(3)]
    high = [max(v[axis] for v in positions) for axis in range(3)]
    triangles = sum(
        max(0, len(face.vertices) - 2) for obj in meshes for face in obj.data.polygons
    )
    print(
        "SWAN_EXPORT "
        + json.dumps(
            {
                "path": str(OUTPUT),
                "bytes": len(data),
                "mesh_count": len(payload.get("meshes", [])),
                "triangles": triangles,
                "materials": [mat["name"] for mat in payload["materials"]],
                "gltf_bounds_min": [round(v, 4) for v in low],
                "gltf_bounds_max": [round(v, 4) for v in high],
                "gltf_size_xyz": [round(b - a, 4) for a, b in zip(low, high)],
                "front": "+Z",
                "up": "+Y",
                "waterline_y": 0,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    export_and_report(build_swan())
