# glAvatar

(Potentially) a glTF extension (extra?) for avatar with switchable skeletons, skins, clothes, etc.

An open source assest library of 3D avatar content creation where artists can contribute.

## Demo

TODO

## Overview

3D avatar content creation is widely used but can be expensive. 

A switchable avatar system is very useful in games, 3D apps, VR and AR, etc.

glAvatar will make the contents and skeletons contributed by artists work together in an engine or app/game logic - agnostic way, and meanwhile keeps the switchable feature if wanted.

The system has two types of glTF files: 
* skeleton file
    * is a valid renderable glTF file by itself
    * contains joint nodes
    * usually doesn't contain a skinned mesh
* content file
    * is a valid renderable glTF file by itself (e.g. can be used to render icons)
    * contains skinned mesh on certain skeleton
    * node with skinned mesh uses the extension to link to skins from skeleton file


A combination of skeleton file and several content files will be rendered as an complete avatar with switchable skin meshes, or can be merged and output as one glTF file.

glAvatar is an extension that is not necessary to support by engine to render these files separately.


## Use case

* glTF 3D avatar model generator for 3D app, indie game dev, etc.
* Avatars for VR social experience: [Facebook Spaces](https://www.facebook.com/spaces), [AltspaceVR](https://altvr.com/)
* 3D contents for AR apps: [Google-ARCore](https://experiments.withgoogle.com/ar)
* Avatar for virtual performers (Live Show, Streammer, [MMD](https://learnmmd.com/downloads/)): [Miku](https://www.youtube.com/watch?v=dhYaX01NOfA), [Kizuna AI](https://www.youtube.com/channel/UC4YaOt1yT-ZeyB0OmxHgolA)
* 3D Avatars, [3D Memes](https://github.com/shrekshao/gltf-emoji) for traditional online community: [glTF html tag renderer](https://github.com/AVGP/gltf-viewer)

## Motivation


## Example


### A skeleton glTF file
```json
{
    "extensionsUsed": [
        "gl_avatar"
    ],
    "nodes": [
        {
            "name": "scene-root",
            "children": [2, 1]
        },
        {
            "name": "pelvis",
            "children": [3, 4, 5],
            "translation": [0.0, 1.0, 0.0],
            "rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0]
        },
        {
            "name": "chest",
            "children": [6],
            "translation": [0.0, 0.5, 0.0]
        },
        {
            "name": "left-leg"
        },
        {
            "name": "right-leg"
        },
        {
            "head": "head"
        }
    ],
    "skins": [
        {
            "name": "chibi-human",

            "inverseBindMatrix": 0,
            "joints": [2, 3, 4, 5, 6],

            "extensions": {
                "gl_avatar": {
                    "joints? might not be useful": {
                        "head": 6,
                        "chest": 3,
                        "pelvis": 2,
                        "left-leg": 4,
                        "right-leg": 5
                    }
                }
            }
        }
    ],
    "...": "..."
}
```

### A content (clothes, armor, weapon, skins, etc.) glTF file
```json
{
    "extensionsUsed": [
        "gl_avatar"
    ],
    "nodes": [
        {
            "name": "jeans",
            "mesh": 0

            "extensions": {
                "gl_avatar": {
                    "bindings": [
                        "chibi-human"
                    ]
                }
            }
        }
    ],
    "meshes": [
        {
            "primitives": [
                {
                    "attributes" : {
                        "POSITION": 0,
                        "...": "...",
                        "JOINTS_0": 1,
                        "WEIGHTS_0": 2
                    }
                }
            ]
        }
    ],
    "...": "..."
}
```





## Spec