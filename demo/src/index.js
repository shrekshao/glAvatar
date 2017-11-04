

// var glAvatarViewer = require('./gl-avatar-viewer.js');
import {glAvatarViewer} from './gl-avatar-viewer.js';
import '../css/style.css';
// import dat from 'dat.gui-mirror';



var canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);




glAvatarViewer.init(canvas);
glAvatarViewer.render();