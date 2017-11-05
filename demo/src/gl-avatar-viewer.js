'use strict';

import {vec3, vec4, quat, mat4} from 'gl-matrix';
import {Utils} from './utls.js';

// skybox
import img_px from '../textures/environment/px.jpg';
import img_nx from '../textures/environment/nx.jpg';
import img_py from '../textures/environment/py.jpg';
import img_ny from '../textures/environment/ny.jpg';
import img_pz from '../textures/environment/pz.jpg';
import img_nz from '../textures/environment/nz.jpg';

// ibl diffuse
import img_diffuse_01 from '../textures/environment/diffuse/bakedDiffuse_01.jpg';
import img_diffuse_02 from '../textures/environment/diffuse/bakedDiffuse_02.jpg';
import img_diffuse_03 from '../textures/environment/diffuse/bakedDiffuse_03.jpg';
import img_diffuse_04 from '../textures/environment/diffuse/bakedDiffuse_04.jpg';
import img_diffuse_05 from '../textures/environment/diffuse/bakedDiffuse_05.jpg';
import img_diffuse_06 from '../textures/environment/diffuse/bakedDiffuse_06.jpg';

// brdfLUT
import img_brdf_lut from '../textures/brdfLUT.png';

var glAvatarViewer = {
    canvas: null
};

var canvas;
var gl;
var defaultSampler;



var BRDF_LUT, CUBE_MAP;


var glAvatarConfig = glAvatarViewer.glAvatarConfig = {
    BODY_VISIBILITY_LENGTH: 60,
    BODY_PART_UNIFORM_BLOCK_ID: 16,
    bodyPartVisibilityUniformBuffer: null,
    visibilityArray: null,

    updateBodyVisibilityBuffer: function (visibilityArray) {
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.bodyPartVisibilityUniformBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, visibilityArray);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        
    }
};


var drawBoundingBox = false;
var boundingBoxType = 'obb';

// -- Initialize vertex array
var POSITION_LOCATION = 0; // set with GLSL layout qualifier
var NORMAL_LOCATION = 1; // set with GLSL layout qualifier
var TEXCOORD_0_LOCATION = 2; // set with GLSL layout qualifier
var JOINTS_0_LOCATION = 3; // set with GLSL layout qualifier
var JOINTS_1_LOCATION = 5; // set with GLSL layout qualifier
var WEIGHTS_0_LOCATION = 4; // set with GLSL layout qualifier
var WEIGHTS_1_LOCATION = 6; // set with GLSL layout qualifier

// -- Mouse Behaviour
var isDisplayRotation = true;
var s = 1;
var eulerX = 0;
var eulerY = 0;
// var s = 1;
// var t = -100;
var translate = vec3.create();
// var t = -5;
var modelMatrix = mat4.create();
var mouseDown = false;
var mouseButtonId = 0;
var lastMouseY = 0;
var lastMouseX = 0;
var identityQ = quat.create();



var glTFModelCount = 1;
var scenes = glAvatarViewer.scenes = [];


var isFaceCulling = true;




// Scene object for runtime renderer
var Scene = glAvatarViewer.Scene = function(glTFScene, glTF, id) {
    this.glTFScene = glTFScene;
    this.glTF = glTF;
    this.id = id;

    // runtime renderer context
    this.rootTransform = mat4.create();
    // @temp, assume every node is in current scene
    this.nodeMatrix = new Array(glTF.nodes.length);
    var i, len;
    for(i = 0, len = this.nodeMatrix.length; i < len; i++) {
        this.nodeMatrix[i] = mat4.create();
    }

    // TODO: runtime joint matrix
};

var Shader_Static = glAvatarViewer.Shader_Static = {
    shaderVersionLine: '#version 300 es\n',
    
    bitMasks: {
        // vertex shader
        HAS_SKIN: 1,
        SKIN_VEC8: 2,

        // fragment shader
        HAS_BASECOLORMAP: 4,
        HAS_NORMALMAP: 8,
        HAS_METALROUGHNESSMAP: 16,
        HAS_OCCLUSIONMAP: 32,
        HAS_EMISSIVEMAP: 64,

        // for gl avatar
        GLAVATAR_HAS_BODY_ID_LUT: 128,
        GLAVATAR_BODY_VISIBILITY_LENGTH: 256    // this will remain the same in a deployment
    },

    vsMasterCode: require('./shaders/vs-pbr-master.glsl'),
    // fsMasterCode: require('./shaders/fs-pbr-master.glsl'),
    fsMasterCode: require('./shaders/fs-pbr-master-glavatar.glsl'),

    programObjects: {}    // < flags, Shader Object >
};

var Shader = glAvatarViewer.Shader = function() {
    this.flags = 0;
    this.programObject = null;
};

Shader.prototype.hasSkin = function() {
    return this.flags & Shader_Static.bitMasks.HAS_SKIN;
};
Shader.prototype.hasBaseColorMap = function() {
    return this.flags & Shader_Static.bitMasks.HAS_BASECOLORMAP;
};
Shader.prototype.hasNormalMap = function() {
    return this.flags & Shader_Static.bitMasks.HAS_NORMALMAP;
};
Shader.prototype.hasMetalRoughnessMap = function() {
    return this.flags & Shader_Static.bitMasks.HAS_METALROUGHNESSMAP;
};
Shader.prototype.hasOcclusionMap = function() {
    return this.flags & Shader_Static.bitMasks.HAS_OCCLUSIONMAP;
};
Shader.prototype.hasEmissiveMap = function() {
    return this.flags & Shader_Static.bitMasks.HAS_EMISSIVEMAP;
};
Shader.prototype.hasBodyIdLUT = function() {
    return this.flags & Shader_Static.bitMasks.GLAVATAR_HAS_BODY_ID_LUT;
};

Shader.prototype.defineMacro = function(macro) {
    if (Shader_Static.bitMasks[macro] !== undefined) {
        this.flags = Shader_Static.bitMasks[macro] | this.flags;
    } else {
        console.log('WARNING: ' + macro + ' is not a valid macro');
    }
};

Shader.prototype.compile = function() {
    var existingProgramObject = Shader_Static.programObjects[this.flags];
    if (existingProgramObject) {
        this.programObject = existingProgramObject;
        return;
    }

    // new program

    var vsDefine = '';
    var fsDefine = '';

    // define macros

    if (this.flags & Shader_Static.bitMasks.HAS_SKIN) {
        vsDefine += '#define HAS_SKIN\n';
    }
    if (this.flags & Shader_Static.bitMasks.SKIN_VEC8) {
        vsDefine += '#define SKIN_VEC8\n';
    }

    if (this.flags & Shader_Static.bitMasks.HAS_BASECOLORMAP) {
        fsDefine += '#define HAS_BASECOLORMAP\n';
    }
    if (this.flags & Shader_Static.bitMasks.HAS_NORMALMAP) {
        fsDefine += '#define HAS_NORMALMAP\n';
    }
    if (this.flags & Shader_Static.bitMasks.HAS_METALROUGHNESSMAP) {
        fsDefine += '#define HAS_METALROUGHNESSMAP\n';
    }
    if (this.flags & Shader_Static.bitMasks.HAS_OCCLUSIONMAP) {
        fsDefine += '#define HAS_OCCLUSIONMAP\n';
    }
    if (this.flags & Shader_Static.bitMasks.HAS_EMISSIVEMAP) {
        fsDefine += '#define HAS_EMISSIVEMAP\n';
    }

    if (this.flags & Shader_Static.bitMasks.GLAVATAR_HAS_BODY_ID_LUT) {
        fsDefine += '#define GLAVATAR_HAS_BODY_ID_LUT\n';
    }
    if (this.flags & Shader_Static.bitMasks.GLAVATAR_BODY_VISIBILITY_LENGTH) {
        fsDefine += '#define GLAVATAR_BODY_VISIBILITY_LENGTH ' + glAvatarConfig.BODY_VISIBILITY_LENGTH + 'u\n';
    }


    // concat
    var vertexShaderSource = 
        Shader_Static.shaderVersionLine +
        vsDefine +
        Shader_Static.vsMasterCode;
    
    var fragmentShaderSource = 
        Shader_Static.shaderVersionLine +
        fsDefine +
        Shader_Static.fsMasterCode;

    // compile
    var program = Utils.createProgram(gl, vertexShaderSource, fragmentShaderSource);
    this.programObject = {
        program: program,

        uniformLocations: {},

        uniformBlockIndices: {}
    };

    // uniform block id
    if (this.flags & Shader_Static.bitMasks.HAS_SKIN) {
        this.programObject.uniformBlockIndices.JointMatrix = gl.getUniformBlockIndex(program, "JointMatrix");
    }

    // uniform locations
    var us = this.programObject.uniformLocations;

    us.MVP = gl.getUniformLocation(program, 'u_MVP');
    us.MVNormal = gl.getUniformLocation(program, 'u_MVNormal');
    us.MV = gl.getUniformLocation(program, 'u_MV');
    us.baseColorFactor = gl.getUniformLocation(program, 'u_baseColorFactor');
    us.metallicFactor = gl.getUniformLocation(program, 'u_metallicFactor');
    us.roughnessFactor = gl.getUniformLocation(program, 'u_roughnessFactor');

    if (this.flags & Shader_Static.bitMasks.HAS_BASECOLORMAP) {
        us.baseColorTexture = gl.getUniformLocation(program, 'u_baseColorTexture');
    }
    if (this.flags & Shader_Static.bitMasks.HAS_NORMALMAP) {
        us.normalTexture = gl.getUniformLocation(program, 'u_normalTexture');
        us.normalTextureScale = gl.getUniformLocation(program, 'u_normalTextureScale');
    }
    if (this.flags & Shader_Static.bitMasks.HAS_METALROUGHNESSMAP) {
        us.metallicRoughnessTexture = gl.getUniformLocation(program, 'u_metallicRoughnessTexture');
    }
    if (this.flags & Shader_Static.bitMasks.HAS_OCCLUSIONMAP) {
        us.occlusionTexture = gl.getUniformLocation(program, 'u_occlusionTexture');
        us.occlusionStrength = gl.getUniformLocation(program, 'u_occlusionStrength');
    }
    if (this.flags & Shader_Static.bitMasks.HAS_EMISSIVEMAP) {
        us.emissiveTexture = gl.getUniformLocation(program, 'u_emissiveTexture');
        us.emissiveFactor = gl.getUniformLocation(program, 'u_emissiveFactor');
    }


    if (this.flags & Shader_Static.bitMasks.GLAVATAR_HAS_BODY_ID_LUT) {
        us.bodyIdLUT = gl.getUniformLocation(program, 'u_bodyIdLUT');
        this.programObject.uniformBlockIndices.BodyPartVisibility = gl.getUniformBlockIndex(program, "BodyPartVisibility");
    }


    us.diffuseEnvSampler = gl.getUniformLocation(program, 'u_DiffuseEnvSampler');
    us.specularEnvSampler = gl.getUniformLocation(program, 'u_SpecularEnvSampler');
    us.brdfLUT = gl.getUniformLocation(program, 'u_brdfLUT');

    // set static uniform values in cubemap
    gl.useProgram(program);
    gl.uniform1i(us.brdfLUT, BRDF_LUT.textureIndex);
    gl.uniform1i(us.specularEnvSampler, CUBE_MAP.textureIndex);
    gl.uniform1i(us.diffuseEnvSampler, CUBE_MAP.textureIBLDiffuseIndex);
    gl.useProgram(null);

    Shader_Static.programObjects[this.flags] = this.programObject;
};




glAvatarViewer.init = function (v_canvas) {
    this.canvas = canvas = v_canvas;

    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };

    gl = canvas.getContext( 'webgl2', { antialias: true } );
    var isWebGL2 = !!gl;
    if(!isWebGL2) {
        // document.getElementById('info').innerHTML = 'WebGL 2 is not available.  See <a href="https://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">How to get a WebGL 2 implementation</a>';
        console.error('WebGL 2 is not available.  See <a href="https://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">How to get a WebGL 2 implementation</a>');
        return;
    }


    Renderer.init();


    // --------------------------------------------------------------------
    
    defaultSampler = gl.createSampler();
    gl.samplerParameteri(defaultSampler, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.samplerParameteri(defaultSampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(defaultSampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.samplerParameteri(defaultSampler, gl.TEXTURE_WRAP_T, gl.REPEAT);

    // ----------------------------------------------------------------------

    var BOUNDING_BOX = this.BOUNDING_BOX = {
        vertexData: new Float32Array([
            0.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 0.0,
            0.0, 0.0, 1.0,
    
            0.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            0.0, 1.0, 1.0,
            0.0, 1.0, 0.0,
            0.0, 1.0, 1.0,
            0.0, 0.0, 1.0,
    
            1.0, 1.0, 0.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            1.0, 1.0, 0.0,
            1.0, 0.0, 0.0,
    
            1.0, 0.0, 1.0,
            1.0, 0.0, 0.0,
            1.0, 0.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 0.0, 1.0,
            0.0, 0.0, 1.0
        ]),
    
        vertexArray: gl.createVertexArray(),
        vertexBuffer: gl.createBuffer(),
    
        program: Utils.createProgram(gl, require('./shaders/vs-bbox.glsl'), require('./shaders/fs-bbox.glsl')),
        positionLocation: 0,
        uniformMvpLocation: 0, 
    
        
        draw: (function() {
            var MVP = mat4.create();
            return (function(bbox, nodeTransform, V, P) {
                // gl.useProgram(this.program);
    
                mat4.mul(MVP, nodeTransform, bbox.transform);
                mat4.mul(MVP, V, MVP);
                mat4.mul(MVP, P, MVP);
    
                gl.uniformMatrix4fv(this.uniformMvpLocation, false, MVP);
                // gl.bindVertexArray(this.vertexArray);
                gl.drawArrays(gl.LINES, 0, 24);
                // gl.bindVertexArray(null);
            });
        })()
    };
    
    BOUNDING_BOX.uniformMvpLocation = gl.getUniformLocation(BOUNDING_BOX.program, "u_MVP");
    
    gl.bindVertexArray(BOUNDING_BOX.vertexArray);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, BOUNDING_BOX.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, BOUNDING_BOX.vertexData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(BOUNDING_BOX.positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(BOUNDING_BOX.positionLocation);
    
    gl.bindVertexArray(null);

    // -------------------------------------------------------------------------

    BRDF_LUT = this.BRDF_LUT = {
        texture: null,
        textureIndex: 29,
    
        createTexture: function (img) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(
                gl.TEXTURE_2D,  // assumed
                0,        // Level of details
                gl.RG16F, // Format
                gl.RG,
                // gl.RGBA, // Format
                // gl.RGBA,
                // gl.UNSIGNED_BYTE, // Size of each channel
                gl.FLOAT,
                img
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    };

    // --------------------------------------------------------------------------

    CUBE_MAP = this.CUBE_MAP = {
        textureIndex: 31,
        texture: null,
    
        // IBL
        textureIBLDiffuseIndex: 30,
        textureIBLDiffuse: null,
    
        // loading asset --------------------
        // // TODO: use webpack to pack these
        // uris: [
        //     'textures/environment/px.jpg',
        //     'textures/environment/nx.jpg',
        //     'textures/environment/py.jpg',
        //     'textures/environment/ny.jpg',
        //     'textures/environment/pz.jpg',
        //     'textures/environment/nz.jpg',
    
        //     // ibl diffuse
        //     'textures/environment/diffuse/bakedDiffuse_01.jpg',
        //     'textures/environment/diffuse/bakedDiffuse_02.jpg',
        //     'textures/environment/diffuse/bakedDiffuse_03.jpg',
        //     'textures/environment/diffuse/bakedDiffuse_04.jpg',
        //     'textures/environment/diffuse/bakedDiffuse_05.jpg',
        //     'textures/environment/diffuse/bakedDiffuse_06.jpg',
    
        //     // @tmp, ugly, load brdfLUT here
        //     'textures/brdfLUT.png'
        // ],
    
        uris: [
            img_px,
            img_nx,
            img_py,
            img_ny,
            img_pz,
            img_nz,

            img_diffuse_01,
            img_diffuse_02,
            img_diffuse_03,
            img_diffuse_04,
            img_diffuse_05,
            img_diffuse_06,

            img_brdf_lut
        ],

        images: [],
    
        loadAll: function() {
            Utils.loadImages(this.uris, this.onloadAll.bind(this));
        },
        // loadAll: function() {
        //     for (var i = 0, len = this.uris.length; i < len; i++) { 
        //         this.images[i] = new Image();
        //         this.images[i].src = this.uris[i];
        //     }
        //     this.onloadAll(this.images);
        // },
    
        onloadAll: function(imgs) {
            this.images = imgs;
            console.log('all cube maps loaded');
    
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.NONE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    
            for (var i = 0; i < 6; i++) {
                gl.texImage2D(
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    this.images[i]
                );
            }
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    
    
    
            this.textureIBLDiffuse = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.textureIBLDiffuse);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.NONE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    
            for (var i = 0; i < 6; i++) {
                gl.texImage2D(
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    this.images[i + 6]
                );
            }
    
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    
    
    
            // @tmp
            BRDF_LUT.createTexture(this.images[this.images.length - 1]);
    
            if (this.finishLoadingCallback) {
                this.finishLoadingCallback();
            }
        },
    
        // finishLoadingCallback: null,
    
    
        // runtime stuffs -------------------------
        vertexData: new Float32Array([         
            -1.0,  1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
    
            -1.0, -1.0,  1.0,
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
            -1.0, -1.0,  1.0,
    
            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0, -1.0,
            1.0, -1.0, -1.0,
    
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
    
            -1.0,  1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
    
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0
        ]),
    
        
        vertexArray: gl.createVertexArray(),
        vertexBuffer: gl.createBuffer(),
    
        program: Utils.createProgram(gl, require('./shaders/vs-cube-map.glsl'), require('./shaders/fs-cube-map.glsl')),
        positionLocation: 0,
        uniformMvpLocation: 0, 
        uniformEnvironmentLocation: 0,
    
        
        draw: (function() {
            var MVP = mat4.create();
            return (function(V, P) {
                mat4.copy(MVP, V);
                MVP[12] = 0.0;
                MVP[13] = 0.0;
                MVP[14] = 0.0;
                MVP[15] = 1.0;
                mat4.mul(MVP, P, MVP);
    
                gl.useProgram(this.program);
                gl.activeTexture(gl.TEXTURE0 + this.textureIndex);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
                gl.uniformMatrix4fv(this.uniformMvpLocation, false, MVP);
                gl.uniform1i(this.uniformEnvironmentLocation, this.textureIndex);
                gl.bindVertexArray(this.vertexArray);
                gl.drawArrays(gl.TRIANGLES, 0, 36);
                gl.bindVertexArray(null);
            });
        })()
    };
    
    CUBE_MAP.uniformMvpLocation = gl.getUniformLocation(CUBE_MAP.program, "u_MVP");
    CUBE_MAP.uniformEnvironmentLocation = gl.getUniformLocation(CUBE_MAP.program, "u_environment");
    
    gl.bindVertexArray(CUBE_MAP.vertexArray);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, CUBE_MAP.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CUBE_MAP.vertexData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(CUBE_MAP.positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(CUBE_MAP.positionLocation);
    
    gl.bindVertexArray(null);
    
    // ---------------------------------------------------------------

    
    window.onmousedown = function(event) {
        mouseDown = true;
        mouseButtonId = event.which;
        lastMouseY = event.clientY;
        lastMouseX = event.clientX;
        if (mouseButtonId === 1) {
            isDisplayRotation = false;
        }
    };
    window.onmouseup = function(event) {
        mouseDown = false;
        isDisplayRotation = true;
    };
    window.onmousemove = function(event) {
        if(!mouseDown) {
            return;
        }
        var newY = event.clientY;
        var newX = event.clientX;
        
        var deltaY = newY - lastMouseY;
        var deltaX = newX - lastMouseX;
        
        // s *= (1 + deltaY / 1000);
    
        switch(mouseButtonId) {
            case 1:
            // left: rotation
            eulerX += -deltaY * 0.01;
            eulerY += deltaX * 0.01;
            break;
            case 3:
            // right
            translate[0] += deltaX * 0.001;
            translate[1] += -deltaY * 0.001;
            break;
        }
        
        
        lastMouseY = newY;
        lastMouseX = newX;
    };
    window.onwheel = function(event) {
        translate[2] += -event.deltaY * 0.001;
        // translate[2] *= 1 + (-event.deltaY * 0.01);
    };

    // ------------------------------------------------
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // ------------------------------------------------



    
    CUBE_MAP.loadAll();
};



function setupAttribuite(attrib, location) {
    if (attrib !== undefined) {
        // var accessor = glTF.accessors[ attrib ];
        var accessor = attrib;
        var bufferView = accessor.bufferView;
        if (bufferView.target === null) {
            // console.log('WARNING: the bufferview of this accessor should have a target, or it should represent non buffer data (like animation)');
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferView.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, bufferView.data, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(bufferView.target, bufferView.buffer);
        }
        accessor.prepareVertexAttrib(location, gl);
        return true;
    }
    return false;
}

var setupScene = glAvatarViewer.setupScene = function(glTF, replaceScene) {
    var i, len;
    
            
    var curGltfScene = glTF.scenes[glTF.defaultScene];

    var sceneDeltaTranslate = vec3.fromValues(curGltfScene.boundingBox.transform[0] * 1.2, 0, 0);
    var tmpVec3Translate = vec3.create();

    var newGltfRuntimeScene;
    if (!replaceScene) {
        newGltfRuntimeScene = new Scene(curGltfScene, glTF, scenes.length);
        scenes.push(newGltfRuntimeScene);
    } else {
        newGltfRuntimeScene = scenes[replaceScene.id] = new Scene(curGltfScene, glTF, replaceScene.id);
    }
    
    // for (i = 0, len = glTFModelCount; i < len; i++) {
    //     scenes.push(new Scene(curGltfScene, glTF));
    //     // vec3.scale(tmpVec3Translate, sceneDeltaTranslate, i);
    //     // mat4.fromTranslation(scenes[i].rootTransform, tmpVec3Translate);
    // }
    

    
    if (scenes.length === 1) {
        // first model, adjust camera
        mat4.identity(modelMatrix);
        
        // center
        s = 1.0 / Math.max( curGltfScene.boundingBox.transform[0], Math.max(curGltfScene.boundingBox.transform[5], curGltfScene.boundingBox.transform[10]) );
        mat4.getTranslation(translate, curGltfScene.boundingBox.transform);
        vec3.scale(translate, translate, -1);
        translate[0] += - 0.5 * curGltfScene.boundingBox.transform[0];
        translate[1] += - 0.5 * curGltfScene.boundingBox.transform[5];
        translate[2] += - 0.5 * curGltfScene.boundingBox.transform[10];

        s *= 0.5;

        modelMatrix[0] = s;
        modelMatrix[5] = s;
        modelMatrix[10] = s;
        mat4.translate(modelMatrix, modelMatrix, translate);

        vec3.set(translate, 0, 0, -1.5);
        s = 1;
    }
    


    // var in loop
    var mesh;
    var primitive;
    var vertexBuffer;
    var indexBuffer;
    var vertexArray;

    var nid, lenNodes;
    var mid, lenMeshes;
    
    var attribute;

    var image, texture, sampler;

    var accessor, bufferView;

    var animation, animationSampler, channel;

    var skin;
    var material;


    // create buffers
    for (i = 0, len = glTF.bufferViews.length; i < len; i++) {
        bufferView = glTF.bufferViews[i];
        bufferView.createBuffer(gl);
        bufferView.bindData(gl);
    }

    
    // create textures
    if (glTF.textures) {
        for (i = 0, len = glTF.textures.length; i < len; i++) {
            texture = glTF.textures[i];

            if (texture.extensions) {
                if (texture.extensions.gl_avatar == 'bodyIdLUT') {
                    texture.texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture.texture);
                    gl.texImage2D(
                        gl.TEXTURE_2D,  // assumed
                        0,        // Level of details
                        gl.RGBA8UI, // Format
                        gl.RGBA_INTEGER,
                        gl.UNSIGNED_BYTE,
                        texture.source
                    );
                    // gl.generateMipmap(gl.TEXTURE_2D);
                    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

                    gl.bindTexture(gl.TEXTURE_2D, null);

                    continue;
                }
            }

            texture.createTexture(gl);
        }
    }

    // create samplers
    if (glTF.samplers) {
        for (i = 0, len = glTF.samplers.length; i < len; i++) {
            sampler = glTF.samplers[i];
            
            sampler.createSampler(gl);
        }
    }

    if (glTF.skins) {
        // gl.useProgram(programSkinBaseColor.program);
        // gl.uniformBlockBinding(programSkinBaseColor.program, programSkinBaseColor.uniformBlockIndexJointMatrix, 0);
        // gl.useProgram(null);
        for (i = 0, len = glTF.skins.length; i < len; i++) {
            skin = glTF.skins[i];
            
            skin.jointMatrixUniformBuffer = gl.createBuffer();

            // gl.bindBufferBase(gl.UNIFORM_BUFFER, i, skin.jointMatrixUniformBuffer);
            gl.bindBufferBase(gl.UNIFORM_BUFFER, skin.uniformBlockID, skin.jointMatrixUniformBuffer);

            gl.bindBuffer(gl.UNIFORM_BUFFER, skin.jointMatrixUniformBuffer);
            gl.bufferData(gl.UNIFORM_BUFFER, skin.jointMatrixUnidormBufferData, gl.DYNAMIC_DRAW);
            // gl.bufferSubData(gl.UNIFORM_BUFFER, 0, skin.jointMatrixUnidormBufferData);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        }
    }



    

    // create vao & materials shader source setup
    for (mid = 0, lenMeshes = glTF.meshes.length; mid < lenMeshes; mid++) {
        mesh = glTF.meshes[mid];

        for (i = 0, len = mesh.primitives.length; i < len; ++i) {
            primitive = mesh.primitives[i];
            primitive.shader = new Shader();
            // WebGL2: create vertexArray
            primitive.vertexArray = vertexArray = gl.createVertexArray();
            gl.bindVertexArray(vertexArray);
            
            
            setupAttribuite(primitive.attributes.POSITION, POSITION_LOCATION);
            setupAttribuite(primitive.attributes.NORMAL, NORMAL_LOCATION);

            // @tmp, should consider together with material
            setupAttribuite(primitive.attributes.TEXCOORD_0, TEXCOORD_0_LOCATION);
            

            if (
                setupAttribuite(primitive.attributes.JOINTS_0, JOINTS_0_LOCATION) &&
                setupAttribuite(primitive.attributes.WEIGHTS_0, WEIGHTS_0_LOCATION)
            ) {
                // assume these two attributes always appear together
                primitive.shader.defineMacro('HAS_SKIN');
            }
            

            if (
                setupAttribuite(primitive.attributes.JOINTS_1, JOINTS_1_LOCATION) &&
                setupAttribuite(primitive.attributes.WEIGHTS_1, WEIGHTS_1_LOCATION)
            ) {
                // assume these two attributes always appear together
                primitive.shader.defineMacro('SKIN_VEC8');
            }

            

            // indices ( assume use indices )
            if (primitive.indices !== undefined) {
                accessor = glTF.accessors[ primitive.indices ];
                bufferView = accessor.bufferView;
                if (bufferView.target === null) {
                    // console.log('WARNING: the bufferview of this accessor should have a target, or it should represent non buffer data (like animation)');
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferView.buffer);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bufferView.data, gl.STATIC_DRAW);
                } else {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferView.buffer);
                }
            }
            
            

            gl.bindVertexArray(null);

            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            // material shader setup
            material = primitive.material;
            if (material) {
                if (material.pbrMetallicRoughness.baseColorTexture) {
                    primitive.shader.defineMacro('HAS_BASECOLORMAP');
                }
                if (material.pbrMetallicRoughness.metallicRoughnessTexture) {
                    primitive.shader.defineMacro('HAS_METALROUGHNESSMAP');
                }
                if (material.normalTexture) {
                    primitive.shader.defineMacro('HAS_NORMALMAP');
                }
                if (material.occlusionTexture) {
                    primitive.shader.defineMacro('HAS_OCCLUSIONMAP');
                }
                if (material.emissiveTexture) {
                    primitive.shader.defineMacro('HAS_EMISSIVEMAP');
                }
            }


            // gl avatar
            if (primitive.extensions) {
                if (primitive.extensions.gl_avatar.bodyIdTexture !== undefined) {
                    primitive.shader.defineMacro('GLAVATAR_HAS_BODY_ID_LUT');
                    primitive.shader.defineMacro('GLAVATAR_BODY_VISIBILITY_LENGTH');

                    // bind uniform block
                    // assume there's only one primitive with this per scene
                    var ub = glAvatarConfig.bodyPartVisibilityUniformBuffer = gl.createBuffer();

                    gl.bindBufferBase(gl.UNIFORM_BUFFER, glAvatarConfig.BODY_PART_UNIFORM_BLOCK_ID, ub);
    
                    gl.bindBuffer(gl.UNIFORM_BUFFER, ub);
                    gl.bufferData(gl.UNIFORM_BUFFER, glAvatarConfig.curVisibilityArray, gl.STATIC_DRAW);
                    gl.bindBuffer(gl.UNIFORM_BUFFER, null);


                    // primitive.hasBodyIdLUT = true;
                }
            }


            primitive.shader.compile();
        }
        
    }


    return newGltfRuntimeScene;
};












var Renderer = glAvatarViewer.renderer = {};

(function() {
    'use strict';

    var scale = vec3.create();
    
    var r = 0.0;
    // var rotationSpeedY= 0.01;
    var rotationSpeedY= 0.0;

    var perspective = mat4.create();
    

    var modelView = mat4.create();

    var localMV = mat4.create();
    var localMVP = mat4.create();
    var localMVNormal = mat4.create();

    var VP = mat4.create();

    var hasIndices = true;

    var hasSkin = false;
    var uniformBlockID;     // same for uniform block binding id

    var curScene;
    var program = null;

    Renderer.init = function() {
        mat4.perspective(perspective, 0.785, canvas.width / canvas.height, 0.01, 100);
    };

    function activeAndBindTexture(uniformLocation, index) {
        gl.uniform1i(uniformLocation, index);
        gl.activeTexture(gl.TEXTURE0 + index);
        var texture = curScene.glTF.textures[ index ];
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        var sampler;
        if (texture.sampler) {
            sampler = texture.sampler.sampler;
        } else {
            sampler = defaultSampler;
        }

        gl.bindSampler(index, sampler);
    }
    

    var defaultColor = [1.0, 1.0, 1.0, 1.0];
    var drawPrimitive = Renderer.drawPrimitive = function(primitive, matrix) {
        mat4.multiply(localMV, modelView, matrix);
        mat4.multiply(localMVP, perspective, localMV);
        // mat4.multiply(localMVP, VP, matrix);

        mat4.invert(localMVNormal, localMV);
        mat4.transpose(localMVNormal, localMVNormal);

        var texture, sampler;
        var baseColor = defaultColor;

        var shader = primitive.shader;
        var material = primitive.material;

        if (material !== null) {
            var pbrMetallicRoughness = material.pbrMetallicRoughness;
            baseColor = pbrMetallicRoughness.baseColorFactor;
            
            if (primitive.material.doubleSided === isFaceCulling) {
                isFaceCulling = !primitive.material.doubleSided;
                if (isFaceCulling) {
                    gl.enable(gl.CULL_FACE);
                } else {
                    gl.disable(gl.CULL_FACE);
                }
            }
        }
        

        if (program != primitive.shader.programObject) {
            program = primitive.shader.programObject;
            gl.useProgram(program.program);
        }

        if (material) {
            // base color texture
            if (shader.hasBaseColorMap()) {
                activeAndBindTexture(program.uniformLocations.baseColorTexture, pbrMetallicRoughness.baseColorTexture.index);
            }

            // normal texture
            if (shader.hasNormalMap()) {
                activeAndBindTexture(program.uniformLocations.normalTexture, material.normalTexture.index);
                gl.uniform1f(program.uniformLocations.normalTextureScale, material.normalTexture.scale);
            }

            // metallic roughness texture
            if (shader.hasMetalRoughnessMap()) {
                activeAndBindTexture(program.uniformLocations.metallicRoughnessTexture, pbrMetallicRoughness.metallicRoughnessTexture.index);
            }
            
            gl.uniform1f(program.uniformLocations.metallicFactor, pbrMetallicRoughness.metallicFactor);
            gl.uniform1f(program.uniformLocations.roughnessFactor, pbrMetallicRoughness.roughnessFactor);

            // occlusion texture
            if (shader.hasOcclusionMap()) {
                activeAndBindTexture(program.uniformLocations.occlusionTexture, material.occlusionTexture.index);
                gl.uniform1f(program.uniformLocations.occlusionStrength, material.occlusionTexture.strength);
            }

            // emissive texture
            if (shader.hasEmissiveMap()) {
                activeAndBindTexture(program.uniformLocations.emissiveTexture, material.emissiveTexture.index);
                gl.uniform3fv(program.uniformLocations.emissiveFactor, material.emissiveFactor);
            }
        }
        
        
        // TODO: skin JointMatrix uniform block
        if (shader.hasSkin()) {
            gl.uniformBlockBinding(program.program, program.uniformBlockIndices.JointMatrix, uniformBlockID);
        }


        if (shader.hasBodyIdLUT()) {
            // activeAndBindTexture(program.uniformLocations.bodyIdLUT, primitive.extensions.gl_avatar.bodyIdTexture);
            var index = primitive.extensions.gl_avatar.bodyIdTexture
            gl.uniform1i(program.uniformLocations.bodyIdLUT, index);
            gl.activeTexture(gl.TEXTURE0 + index);
            var texture = curScene.glTF.textures[ index ];
            gl.bindTexture(gl.TEXTURE_2D, texture.texture);

            gl.uniformBlockBinding(program.program, program.uniformBlockIndices.BodyPartVisibility, glAvatarConfig.BODY_PART_UNIFORM_BLOCK_ID);

            // gl.getActiveUniformBlockParameter(program.program, program.uniformBlockIndices.BodyPartVisibility, gl.UNIFORM_BLOCK_DATA_SIZE);
        }


        gl.activeTexture(gl.TEXTURE0 + BRDF_LUT.textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, BRDF_LUT.texture);

        gl.activeTexture(gl.TEXTURE0 + CUBE_MAP.textureIndex);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, CUBE_MAP.texture);

        gl.activeTexture(gl.TEXTURE0 + CUBE_MAP.textureIBLDiffuseIndex);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, CUBE_MAP.textureIBLDiffuse);
        

        gl.uniform4fv(program.uniformLocations.baseColorFactor, baseColor);
        
        gl.uniformMatrix4fv(program.uniformLocations.MV, false, localMV);
        gl.uniformMatrix4fv(program.uniformLocations.MVP, false, localMVP);
        gl.uniformMatrix4fv(program.uniformLocations.MVNormal, false, localMVNormal);

        gl.bindVertexArray(primitive.vertexArray);

        if (primitive.indices !== null) {
            gl.drawElements(primitive.mode, primitive.indicesLength, primitive.indicesComponentType, primitive.indicesOffset);
        } else {
            gl.drawArrays(primitive.mode, primitive.drawArraysOffset, primitive.drawArraysCount);
        }

        gl.bindVertexArray(null);

    }

    // function drawMesh(mesh, matrix) {
    // }
    var tmpMat4 = mat4.create();
    var inverseTransformMat4 = mat4.create();
    
    // @todo: 
    // in a real engine, it is better to simply parse the node tree stucture
    // to compute transform matrices,
    // then sort node array by material and render use a for loop
    // to minimize context switch
    var drawNode = Renderer.drawNode = function (node, nodeID, parentModelMatrix) {
        var matrix = curScene.nodeMatrix[nodeID];
        
        if (parentModelMatrix !== undefined) {
            mat4.mul(matrix, parentModelMatrix, node.matrix);
        } else {
            // from scene root, parent is identity
            mat4.copy(matrix, node.matrix);
        }
        // mat4.mul(matrix, parentModelMatrix, node.matrix);

        hasSkin = false;
        if (node.skin !== null) {
            // mesh node with skin
            hasSkin = true;
            var skin = node.skin;
            uniformBlockID = skin.uniformBlockID;
            var joints = node.skin.joints;
            var jointNode;

            mat4.invert(inverseTransformMat4, matrix);


            // @tmp: assume joint nodes are always in the front of the scene node list
            // so that their matrices are ready to use

            // TODO: possible optimizations
            // separate into two uniform buffers
            for (i = 0, len = joints.length; i < len; i++) {
                jointNode = joints[i];
                if (skin.isLink) {
                    // gl_avatar
                    mat4.mul(tmpMat4, curScene.glTF.skeletonGltfRuntimeScene.nodeMatrix[jointNode.nodeID], skin.inverseBindMatrix[i]);
                } else {
                    mat4.mul(tmpMat4, curScene.nodeMatrix[jointNode.nodeID], skin.inverseBindMatrix[i]);
                }
                
                
                mat4.mul(tmpMat4, inverseTransformMat4, tmpMat4);

                skin.jointMatrixUnidormBufferData.set(tmpMat4, i * 16);
            }

            gl.bindBuffer(gl.UNIFORM_BUFFER, skin.jointMatrixUniformBuffer);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, skin.jointMatrixUnidormBufferData, 0, skin.jointMatrixUnidormBufferData.length);
            
        }


        var i, len;

        // draw cur node's mesh
        if (node.mesh !== null) {
            // drawMesh(glTF.meshes[node.mesh], matrix);

            // var mesh = glTF.meshes[node.mesh];
            var mesh = node.mesh;
            for (i = 0, len = mesh.primitives.length; i < len; i++) {
                // draw primitive
                drawPrimitive(mesh.primitives[i], matrix);
            }

            // BOUNDING_BOX.draw(mesh.boundingBox, matrix, modelView, perspective);
            // gl.useProgram(program);
        }
        
        if (node.skin !== null) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        }
        

        // draw children
        
        var childNodeID;
        for (i = 0, len = node.children.length; i < len; i++) {
            // childNodeID = node.children[i];
            // drawNode(glTF.nodes[childNodeID], childNodeID, matrix);
            drawNode(node.children[i], node.children[i].nodeID, matrix);
        }
    }


    var drawScene = Renderer.drawScene = function (scene) {
        // for (var i = 0, len = scene.nodes.length; i < len; i++) {
        //     drawNode( scene.nodes[i], scene.nodes[i].nodeID, rootTransform );
        // }
        // animation
        var animation;
        var i, len, j, lenj;
        var channel, animationSampler, node;

        var glTF = scene.glTF;
        if (glTF.animations) {
            for (i = 0, len = glTF.animations.length; i < len; i++) {
                animation = glTF.animations[i];
                for (j = 0, lenj = animation.samplers.length; j < lenj; j++) {
                    animation.samplers[j].getValue(timeParameter);
                }

                for (j = 0, lenj = animation.channels.length; j < lenj; j++) {
                    channel = animation.channels[j];
                    animationSampler = channel.sampler;
                    node = glTF.nodes[channel.target.nodeID];

                    switch (channel.target.path) {
                        case 'rotation':
                        vec4.copy(node.rotation, animationSampler.curValue);
                        break;

                        case 'translation':
                        vec3.copy(node.translation, animationSampler.curValue);
                        break;

                        case 'scale':
                        vec3.copy(node.scale, animationSampler.curValue);
                        break;
                    }

                    // node.updateMatrixFromTRS();
                    
                }
            }
        }

        for (i = 0, len = glTF.nodes.length; i < len; i++) {
            glTF.nodes[i].updateMatrixFromTRS();
        }

        for (i = 0, len = scene.glTFScene.nodes.length; i < len; i++) {
            drawNode( scene.glTFScene.nodes[i], scene.glTFScene.nodes[i].nodeID, scene.rootTransform );
        }
    }

    var drawSceneBBox = Renderer.drawSceneBBox = function (glTF, scene, bboxType) {
        var node, mesh, bbox;
        // @temp: assume all nodes are in cur scene
        // @potential fix: can label each node's scene at the setup
        var i, len;
        for (i = 0, len = scene.nodeMatrix.length; i < len; i++) {
            node = glTF.nodes[i];

            if (bboxType == 'bvh') {
                // bvh
                mat4.mul(localMVP, scene.rootTransform, node.bvh.transform);
                mat4.mul(localMVP, VP, localMVP);
                gl.uniformMatrix4fv(BOUNDING_BOX.uniformMvpLocation, false, localMVP);
                gl.drawArrays(gl.LINES, 0, 24);
            }
            else if (node.mesh !== null) {
                // mesh = glTF.meshes[node.mesh];
                mesh = node.mesh;

                if (bboxType == 'aabb') {
                    // aabb
                    mat4.mul(localMVP, scene.rootTransform, node.aabb.transform);
                    mat4.mul(localMVP, VP, localMVP);
                } else {
                    // obb (assume object node is static)
                    mat4.mul(localMVP, scene.nodeMatrix[i], mesh.boundingBox.transform);
                    mat4.mul(localMVP, VP, localMVP);
                }

                gl.uniformMatrix4fv(BOUNDING_BOX.uniformMvpLocation, false, localMVP);
                    
                gl.drawArrays(gl.LINES, 0, 24);

            }   
        }

        // // scene bounding box
        // mat4.mul(localMVP, scene.rootTransform, scene.glTFScene.boundingBox.transform);
        // mat4.mul(localMVP, VP, localMVP);
        // gl.uniformMatrix4fv(BOUNDING_BOX.uniformMvpLocation, false, localMVP);
        // gl.drawArrays(gl.LINES, 0, 24);
    }
    

    var timeStampZero = performance.now();
    var timeParameter = 0;

    // -- Render loop
    // function render() {
    var render = Renderer.render = function(timestamp) {
        var i, len;
        var j, lenj;
        var node;


        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        vec3.set(scale, s, s, s);
        // mat4.identity(modelView);
        // mat4.translate(modelView, modelView, translate);
        // mat4.scale(modelView, modelView, scale);
        // mat4.fromRotationTranslationScale(modelView, identityQ, translate, scale);
        // mat4.mul(modelView, modelView, modelMatrix);
        mat4.identity(modelView);
        mat4.translate(modelView, modelView, translate);
        if (isDisplayRotation) {
            r += rotationSpeedY;
        }
        
        
        mat4.rotateX(modelView, modelView, eulerX);
        mat4.rotateY(modelView, modelView, r);    
        mat4.scale(modelView, modelView, scale);

        mat4.mul(modelView, modelView, modelMatrix);

        mat4.rotateY(modelView, modelView, eulerY); 
        

        mat4.mul(VP, perspective, modelView);

        

        for (i = 0, len = scenes.length; i < len; i++) {
            curScene = scenes[i];

            if (curScene) {
                drawScene(curScene);
            }
            
        }

        if (drawBoundingBox) {
            gl.useProgram(BOUNDING_BOX.program);
            gl.bindVertexArray(BOUNDING_BOX.vertexArray);

            for (i = 0, len = scenes.length; i < len; i++) {
                drawSceneBBox(scenes[i].glTF, scenes[i], boundingBoxType);
            }


            gl.bindVertexArray(null);
        }

        // cube map

        CUBE_MAP.draw(modelView, perspective);
        
        program = null;

        timeParameter = (timestamp - timeStampZero) * 0.001;
        requestAnimationFrame(render);
    }

})();







export { glAvatarViewer };