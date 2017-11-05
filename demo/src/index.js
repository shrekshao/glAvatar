


import {glAvatarSystem} from './gl-avatar-system.js';
import '../css/style.css';
// import dat from 'dat.gui-mirror';



var canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);




glAvatarSystem.init(canvas);
glAvatarSystem.render();

// glAvatarViewer.init(canvas);
// glAvatarViewer.render();