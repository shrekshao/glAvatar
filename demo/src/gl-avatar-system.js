var MinimalGLTFLoader = require('Lib/minimal-gltf-loader.js');
import {glAvatarViewer} from './gl-avatar-viewer.js';


var initGltfUrl = 'models/saber-body-walk/saber-body-walk.gltf';
// var initGltfUrl = 'models/saber-mixamo-animation-test/saber-animation.gltf';
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

    selectAnimation: function(id) {
        if (this.curSkeleton.scene) {
            this.curSkeleton.scene.curAnimationId = id;
        }
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
        
    },

    init: function(canvas) {
        glAvatarViewer.init(canvas);
    },
    render: function() {
        // glTFLoader.loadGLTF(initGltfUrl, function(glTF) {
        //     glAvatarSystem.curSkeleton.name = 'saber';
        //     skeletonGltfScene = glAvatarSystem.curSkeleton.scene = glAvatarViewer.setupScene(glTF);
            
        //     glAvatarViewer.renderer.render();
        // });
        

        glAvatarSystem.selectSkeleton('saber', initGltfUrl, function(gltf){
            if (glAvatarSystem.onload) {
                glAvatarSystem.onload(gltf);
            }
            glAvatarViewer.renderer.render();
        });
    },

    onload: null
};

glAvatarViewer.finishLoadingCallback = glAvatarSystem.render;
glAvatarSystem.curVisibilityArray = new Uint32Array(BODY_VISIBILITY_LENGTH * 4);
glAvatarSystem.initVisibilityArray();



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


glAvatarSystem.selectAccessory = function(category, name, uri) {
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

glAvatarSystem.selectSkeleton = function (name, uri, callback) {
    var loadedSkeleton = glAvatarSystem.skeletons[name];
    if (!loadedSkeleton) {
        console.log('first load ' + uri);
        glTFLoader.loadGLTF(uri
            , function(gltf) {
                
                setupSkeleton(name, gltf);

                if (callback) {
                    callback(gltf);
                }
            }
        );
    } else {
        setupSkeleton(name, loadedSkeleton);

        if (callback) {
            callback(loadedSkeleton);
        }
    }
}









export { glAvatarSystem };