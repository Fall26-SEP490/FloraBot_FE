"""Original conceptual cabinet model. Not a photograph of manufactured FloraBot hardware."""
import bpy
import math
import os
import random
from mathutils import Vector

random.seed(17)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = .36
    return m

yellow = material('Powder-coated leaf green', (.28, .58, .19))
ink = material('Graphite', (.025, .033, .031))
white = material('Porcelain', (.9, .93, .92))
green = material('Leaves', (.025, .20, .06))
paper = material('Bouquet paper', (.56, .38, .20))
petals = [material('Petal '+str(i), c) for i,c in enumerate([(.86,.10,.12),(.98,.61,.02),(.93,.65,.68),(.9,.87,.77)])]

def box(name, loc, scale, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object; obj.name=name
    obj.dimensions=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Manufactured edge','BEVEL'); mod.width=bevel; mod.segments=3
        obj.modifiers.new('Normals','WEIGHTED_NORMAL')
    return obj

def sphere(loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=loc)
    obj=bpy.context.object; obj.scale=scale; obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def text(body, loc, size, mat):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi/2,0,0))
    obj=bpy.context.object; obj.data.body=body; obj.data.size=size
    obj.data.extrude=.001; obj.data.materials.append(mat)

box('Insulated cabinet',(0,0,1.7),(1.8,.76,3.3),yellow,.09)
box('Front interior',(0,-.39,1.71),(1.60,.06,2.74),ink)
for col in range(2):
    for row in range(3):
        x=-.41+col*.82; z=.69+row*.83
        box('Compartment porcelain',(x,-.425,z),(.75,.045,.75),white,.018)
        box('Refrigerated interior',(x,-.46,z),(.65,.045,.64),ink,.01)
        box('Door handle',(x+.32,-.53,z),(.028,.05,.2),yellow,.01)
        # The actual three-dimensional bouquet is visible in each compartment.
        bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.07,radius2=.22,depth=.29,location=(x,-.52,z-.16))
        bpy.context.object.data.materials.append(paper)
        color=petals[(row+col)%len(petals)]
        for flower in range(6):
            angle=flower*2.4
            fx=x+math.cos(angle)*(.04+.055*(flower%3)); fz=z+.08+math.sin(angle)*.105
            sphere((fx,-.555,fz),(.035,.022,.13),green)
            for petal in range(7):
                a=petal*math.tau/7
                sphere((fx+math.cos(a)*.046,-.60,fz+.09+math.sin(a)*.046),(.044,.025,.039),color)
            sphere((fx,-.625,fz+.09),(.026,.018,.024),yellow)
        text(str(row*2+col+1),(x-.32,-.505,z+.25),.055,white)
text('FloraBot',(-.71,-.425,3.19),.21,ink)
text('FLOWERS. ANYTIME.',(-.67,-.425,3.06),.055,ink)
box('Service rail',(0,-.43,.22),(1.56,.035,.16),ink)
for x in [-.63,.63]: box('Adjustable foot',(x,0,.035),(.19,.52,.11),ink)

world=bpy.data.worlds.new('Studio')
bpy.context.scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
for loc,power,size in [((-4,-5,7),950,5),((4,-1,5),650,4),((0,3,5),800,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,1.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4,-8,3.8))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.66))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=4.1
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=40
scene.render.resolution_x=1000; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.abspath(os.path.join(os.path.dirname(__file__),'../apps/landing/public/images/kiosk-model.png'))
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
bpy.ops.render.render(write_still=True)
