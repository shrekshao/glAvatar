var MinimalGLTFLoader = require('Lib/minimal-gltf-loader.js');
import {glAvatarViewer} from './gl-avatar-viewer.js';
import GUI from 'dat.gui';

var initGltfUrl = 'models/saber-body-walk/saber-body-walk.gltf';
var BODY_VISIBILITY_LENGTH = glAvatarViewer.glAvatarConfig.BODY_VISIBILITY_LENGTH;

var skeletonGltfScene = null;

var glTFLoader = new MinimalGLTFLoader.glTFLoader();

var glAvatarSystem = {

    curSkeleton: {
        name: null,
        scene: null,
        sceneID: null
    },

    curVisibilityArray: null,

    curAccessories: {
        clothes: {
            name: null,
            scene: null,
            sceneID: null
        },
        hair: {
            name: null,
            scene: null,
            sceneID: null
        }
    },

    


    // assets
    skeletons: {},

    accessories: {
        clothes: {},
        hair: {}
    },


    initVisibilityArray: function() {
        for (var i = 0, len = BODY_VISIBILITY_LENGTH; i < len; i++) {
            this.curVisibilityArray[i * 4] = 1;
        }
        // glAvatarViewer.glAvatarConfig.updateBodyVisibilityBuffer(this.curVisibilityArray);
        glAvatarViewer.glAvatarConfig.curVisibilityArray = this.curVisibilityArray;
    },

    updateVisibilityArray: function(cat, v) {

        if (this.accessories[cat][this.curAccessories[cat].name]) {
            var oldVisibility = this.accessories[cat][this.curAccessories[cat].name].json.extensions.gl_avatar.visibility;
            for (var i = 0, len = BODY_VISIBILITY_LENGTH; i < len; i++) {
                this.curVisibilityArray[i * 4] = (this.curVisibilityArray[i * 4] || !oldVisibility[i]) && v[i];
            }
        } else {
            for (var i = 0, len = BODY_VISIBILITY_LENGTH; i < len; i++) {
                this.curVisibilityArray[i * 4] = this.curVisibilityArray[i * 4] && v[i];
            }
        }
        

        

        // update uniform block
        glAvatarViewer.glAvatarConfig.updateBodyVisibilityBuffer(this.curVisibilityArray);
        
    }

    ,
    init: function(canvas) {
        
        
        glAvatarViewer.init(canvas);
    },
    render: function() {
        glTFLoader.loadGLTF(initGltfUrl, function(glTF) {
            glAvatarSystem.curSkeleton.name = 'saber';
            skeletonGltfScene = glAvatarSystem.curSkeleton.scene = glAvatarViewer.setupScene(glTF);
            
            glAvatarViewer.renderer.render();
        });
    }
};




glAvatarSystem.curVisibilityArray = new Uint32Array(BODY_VISIBILITY_LENGTH * 4); // fit 16 byte padding
glAvatarSystem.initVisibilityArray();






// ------------------------------------------------
//                     GUI
// ------------------------------------------------
var gui = new GUI.GUI();
var glAvatarControl = function() {


    function setupAccessory(category, name, gltf) {
        var v = gltf.json.extensions.gl_avatar.visibility;
        if (v) {
            glAvatarSystem.updateVisibilityArray(category, v);
        }

        gltf.skeletonGltfRuntimeScene = skeletonGltfScene;
        glAvatarSystem.accessories[category][name] = gltf;
        glAvatarSystem.curAccessories[category].name = name;
        glAvatarSystem.curAccessories[category].scene = glAvatarViewer.setupScene(gltf, glAvatarSystem.curAccessories[category].scene);
        glAvatarSystem.curAccessories[category].sceneID = glAvatarViewer.scenes.length - 1;

    }

    function selectAccessory(category, name, uri) {
        if (glAvatarSystem.curAccessories[category].name != name) {
            var loadedAccessory = glAvatarSystem.accessories[category][name];
            if (!loadedAccessory) {
                // load gltf first
                console.log('first load ' + uri);
                glTFLoader.loadGLTF_GL_Avatar_Skin(uri
                    , skeletonGltfScene.glTF
                    , function(gltf) {
                        setupAccessory(category, name, gltf);
                    }
                );
            } else {
                setupAccessory(category, name, loadedAccessory);
            }
        }
        // else {
        //     // test
        //     console.log('no need to change');
        // }
    }

    function setupSkeleton(name, gltf) {
        if (skeletonGltfScene) {
            // unload all current skins(accessories)

            for (var c in glAvatarSystem.curAccessories) {
                glAvatarSystem.curAccessories[c].name = null;
                glAvatarSystem.curAccessories[c].scene = null;
                glAvatarViewer.scenes[glAvatarSystem.curAccessories[c].sceneID] = null;
                glAvatarSystem.curAccessories[c].sceneID = null;
            }
        }

        glAvatarSystem.skeletons[name] = gltf;
        glAvatarSystem.curSkeleton.name = name;
        glAvatarSystem.curSkeleton.scene = skeletonGltfScene = glAvatarViewer.setupScene(gltf, skeletonGltfScene);
        glAvatarSystem.curSkeleton.sceneID = glAvatarViewer.scenes.length - 1;
    }

    function selectSkeleton(name, uri) {
        var loadedSkeleton = glAvatarSystem.skeletons[name];
        if (!loadedSkeleton) {
            console.log('first load ' + uri);
            glTFLoader.loadGLTF(uri
                , function(gltf) {
                    setupSkeleton(name, gltf);
                }
            );
        } else {
            setupSkeleton(name, loadedSkeleton);
        }
    }


    // this.VC = function() {
    //     console.log("load VC");
    //     // glTFLoader.loadGLTF("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf"
    //     glTFLoader.loadGLTF("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/VC/glTF/VC.gltf"
    //         , setupScene
    //     )
    // };


    this.patrick = function() {
        selectSkeleton(
            'patrick'
            , 'models/patrick_no_shirt/patrick-no-shirt.gltf'
        );

        // TODO: change dat.gui accessories
    };

    this.saber = function() {
        selectSkeleton(
            'saber'
            , 'models/saber-body/saber-body.gltf'
            // , 'models/saber-body-old-test/saber-body.gltf'
        );

        // TODO: change dat.gui accessories
    };



    this.gltfShirt = function() {
        selectAccessory(
            'clothes'
            , 'gltfShirt'
            , 'models/gltf_shirt_glavatar_fix/gltf_shirt.gltf');
    };

    this.batman_armor = function() {
        selectAccessory(
            'clothes'
            , 'batman_armor'
            , 'models/batman_armor_glavatar/batman_armor.gltf');
    };

    this.redHair = function() {
        selectAccessory(
            'hair'
            , 'red_hair'
            , 'models/hair_glavatar/hair.gltf');
    };


    // saber accessory ----------------
    this.maidHair = function() {
        selectAccessory(
            'hair'
            , 'maid_hair'
            , 'models/saber-maid-hair/saber-maid-hair.gltf');
    };

    this.lilyHair = function() {
        selectAccessory(
            'hair'
            , 'pony_tail_hair'
            , 'models/saber-lily-hair/saber-lily-hair.gltf');
    };

    this.proHair = function() {
        selectAccessory(
            'hair'
            , 'pro_hair'
            , 'models/saber-pro-hair/saber-pro-hair.gltf');
    };

    this.maidDress = function() {
        selectAccessory(
            'clothes'
            , 'maid_dress'
            , 'models/saber-maid-dress/saber-maid-dress.gltf');
    };

    this.suit = function() {
        selectAccessory(
            'clothes'
            , 'suit'
            , 'models/saber-suit/saber-suit.gltf');
    };
};
var avatarControl = new glAvatarControl();


var folderScene = gui.addFolder('scene');
// folderScene.add(avatarControl, 'VC');




var folderSkeleton = gui.addFolder('skeletons');
folderSkeleton.add(avatarControl, 'patrick');
folderSkeleton.add(avatarControl, 'saber');



var folderHair = gui.addFolder('hair');
// folderHair.add(avatarControl, 'redHair');
folderHair.add(avatarControl, 'maidHair');
folderHair.add(avatarControl, 'lilyHair');
folderHair.add(avatarControl, 'proHair');

var folderClothes = gui.addFolder('clothes');
// folderClothes.add(avatarControl, 'gltfShirt');
// folderClothes.add(avatarControl, 'batman_armor');
folderClothes.add(avatarControl, 'maidDress');
folderClothes.add(avatarControl, 'suit');



export { glAvatarSystem };