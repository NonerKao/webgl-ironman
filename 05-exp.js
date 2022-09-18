import * as twgl from 'https://unpkg.com/twgl.js@4.19.2/dist/4.x/twgl-full.module.js';
import { loadImage } from './lib/utils.js';
import { matrix4 } from './lib/matrix.js';

const vertexShaderSource = `
attribute vec4 a_position;
attribute vec2 a_texcoord;
attribute vec4 a_normal;

uniform mat4 u_matrix;
uniform mat4 u_normalMatrix;

varying vec2 v_texcoord;
varying vec3 v_normal;

void main() {
  gl_Position = u_matrix * a_position;
  v_texcoord = vec2(a_texcoord.x, 1.0 - a_texcoord.y);
  v_normal = (u_normalMatrix * a_normal).xyz;
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec3 u_diffuse;
uniform sampler2D u_texture;
uniform vec3 u_lightDir;

varying vec2 v_texcoord;
varying vec3 v_normal;

void main() {
  vec3 diffuse = u_diffuse + texture2D(u_texture, v_texcoord).rgb;
  vec3 normal = normalize(v_normal);
  vec3 surfaceToLightDir = normalize(-u_lightDir);
  float diffuseBrightness = clamp(dot(surfaceToLightDir, normal), 0.7, 1.0);
  gl_FragColor = vec4(diffuse * diffuseBrightness, 1);
}
`;

const CAMERA_MOVE_SPEED = 0.005;

async function setup() {
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');

  const oesVaoExt = gl.getExtension('OES_vertex_array_object');
  if (oesVaoExt) {
    gl.createVertexArray = (...args) => oesVaoExt.createVertexArrayOES(...args);
    gl.deleteVertexArray = (...args) => oesVaoExt.deleteVertexArrayOES(...args);
    gl.isVertexArray = (...args) => oesVaoExt.isVertexArrayOES(...args);
    gl.bindVertexArray = (...args) => oesVaoExt.bindVertexArrayOES(...args);
  } else {
    throw new Error('Your browser does not support WebGL ext: OES_vertex_array_object')
  }

  twgl.setAttributePrefix('a_');

  const programInfo = twgl.createProgramInfo(gl, [vertexShaderSource, fragmentShaderSource]);

  const textures = Object.fromEntries(
    await Promise.all(Object.entries({
      linen: 'http://0.0.0.0:8082/linen.jpg',
      red: 'http://0.0.0.0:8082/red.jpeg',
      orange: 'http://0.0.0.0:8082/orange.jpeg',
      blue: 'http://0.0.0.0:8082/blue.jpeg',
      green: 'http://0.0.0.0:8082/green.jpeg',
      yellow: 'http://0.0.0.0:8082/yellow.jpeg',
      white: 'http://0.0.0.0:8082/white.jpeg',
      pink: 'http://0.0.0.0:8082/pink.jpeg',
      coffee: 'http://0.0.0.0:8082/coffee.jpeg',
    }).map(async ([name, url]) => {
      const image = await loadImage(url);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0, // level
        gl.RGB, // internalFormat
        gl.RGB, // format
        gl.UNSIGNED_BYTE, // type
        image, // data
      );

      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

      return [name, texture];
    }))
  );

  { // null texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      1, // width
      1, // height
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      new Uint8Array([
        0, 0, 0, 255
      ])
    );

    textures.nil = texture;
  }

  const objects = {};
  { // octahedron
    const attribs = {
      position: new Float32Array([-1, 0, 0, 0, 0, -1, 0, -1, 0,
	                          -1, 0, 0, 0, -1, 0, 0, 0, 1,
	                          -1, 0, 0, 0, 0, 1, 0, 1, 0,
	                          -1, 0, 0, 0, 1, 0, 0, 0, -1,
	                          1, 0, 0, 0, -1, 0, 0, 0, -1,
	                          1, 0, 0, 0, 0, 1, 0, -1, 0,
	                          1, 0, 0, 0, 1, 0, 0, 0, 1,
	                          1, 0, 0, 0, 0, -1, 0, 1, 0,]),
      normal: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1,
	                        1, 1, -1, 1, 1, -1, 1, 1, -1,
	                        1, -1, -1, 1, -1, -1, 1, -1, -1,
	                        1, -1, 1, 1, -1, 1, 1, -1, 1,
	                        -1, 1, 1, -1, 1, 1, -1, 1, 1,
	                        -1, 1, -1, -1, 1, -1, -1, 1, -1,
	                        -1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        -1, -1, 1, -1, -1, 1, -1, -1, 1]),
      texcoord: new Float32Array([0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2,
	                          0, 0, 0.2, 0, 0, 0.2]),
    };
	  
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.octa = {
      attribs,
      bufferInfo,
      vao,
    };
  }

  { // regular tetrahedron
    const attribs = {
      normal: new Float32Array([-1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        1, 1, -1, 1, 1, -1, 1, 1, -1,
	                        -1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        -1, -1, 1, -1, -1, 1, -1, -1, 1]),
      position: new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, -1,
	                          -1, -1, 1, 1, -1, 1, -1, 1, 1,
	                          -1, -1, 1, -1, -1, -1, 1, -1, 1,
	                          1, -1, 1, -1, -1, -1, -1, 1, 1,]),
      position: new Float32Array([0, 2, 0, 0, 0, -2, 2, 0, 0,
	                          0, 2, 0, 4/3, 4/3, -4/3, 0, 0, -2,
	                          0, 2, 0, 2, 0, 0, 4/3, 4/3, -4/3,
	                          4/3, 4/3, -4/3, 2, 0, 0, 0, 0, -2,]),
      texcoord: new Float32Array([0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1]),
    };
	  
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.rete = {
      attribs,
      bufferInfo,
      vao,
    };
  }

  { // resthedron
    const attribs = {
      position: new Float32Array([-1, -1, 1, -1, 1, -1, -1, -1, -1,
	                          -1, -1, 1, -1, 1, 1, -1, 1, -1,
	                          -1, -1, 1, 1, 1, 1, -1, 1, 1,
	                          -1, -1, 1, 1, -1, 1, 1, 1, 1,
	                          -1, -1, 1, 1, -1, -1, 1, -1, 1,
	                          -1, -1, 1, -1, -1, -1, 1, -1, -1,
	                          -1, 1, 1, 1, 1, 1, -1, 1, -1,
	                          1, 1, 1, 1, -1, 1, 1, -1, -1,
	                          1, 1, 1, 1, -1, -1, -1, 1, -1,
	                          -1, 1, -1, 1, -1, -1, -1, -1, -1,]),
      normal: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1,
	                        1, 1, -1, 1, 1, -1, 1, 1, -1,
	                        1, -1, -1, 1, -1, -1, 1, -1, -1,
	                        1, -1, 1, 1, -1, 1, 1, -1, 1,
	                        1, -1, 1, 1, -1, 1, 1, -1, 1,
	                        -1, 1, 1, -1, 1, 1, -1, 1, 1,
	                        -1, 1, 1, -1, 1, 1, -1, 1, 1,
	                        -1, 1, -1, -1, 1, -1, -1, 1, -1,
	                        -1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        -1, -1, 1, -1, -1, 1, -1, -1, 1]),
      texcoord: new Float32Array([0.9, 0, 0, 0.9, 0, 0,
	                          0, 0.9, 0, 0, 0.9, 0,
	                          0.9, 0, 0, 0.9, 0, 0,
	                          0, 0.9, 0, 0, 0.9, 0,
	                          0.9, 0, 0, 0.9, 0, 0,
	                          0, 0.9, 0, 0, 0.9, 0,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1]),
    };
	  
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.rest = {
      attribs,
      bufferInfo,
      vao,
    };
  }

  { // ground
    const attribs = twgl.primitives.createPlaneVertices()
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.ground = {
      attribs,
      bufferInfo,
      vao,
    };
  }

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  var textureArray = new Array(8).fill(0);
  textureArray[0] = textures.orange; // X-
  textureArray[1] = textures.red;    // X+
  textureArray[2] = textures.green;  // Y-
  textureArray[3] = textures.blue;   // Y+
  textureArray[4] = textures.yellow; // Z-
  textureArray[5] = textures.white;  // Z+
  textureArray[6] = textures.pink;   // W-
  textureArray[7] = textures.coffee; // W+, invisible by default

  var puzzle = new Array(8).fill(0).map(() => new Array(2).fill(0));
  for (var i = 0; i < 8; i++) { 
    for (var j = 0; j < 2; j++) { 
      puzzle[i][j] = textureArray[i];
    }
  }

  return {
    gl,
    programInfo,
    textures, objects,
    state: {
      fieldOfView: degToRad(45),
      lightDir: [0, -1, 0],
      cameraPosition: [15, 9, 21],
      cameraVelocity: [0, 0, 0],
      explode1: 0.5,
      explode2: 4,
    },
    time: 0,
    puzzle: puzzle,
  };
}

function translateCell(explode, cellID) {
  const oddity = (cellID % 2 == 1) ? 1 : -1;
  const mat = (cellID == 7 /*W+*/) ? matrix4.translate(0, explode*-2, 0)
        : (cellID == 6 /*W-*/) ? matrix4.translate(0, 0, 0)
  	: (cellID < 2 /*X*/) ? matrix4.translate(oddity*explode, 0, 0)
  	: (cellID < 4 /*Y*/) ? matrix4.translate(0, oddity*explode, 0)
  	: matrix4.translate(0, 0, oddity*explode);
  return mat;
}

function renderOctahedron(app, viewMatrix) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;

  { 
    gl.bindVertexArray(objects.octa.vao);

    const worldMatrix = matrix4.scale(2, 2, 2);

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.white,
    });

    twgl.drawBufferInfo(gl, objects.octa.bufferInfo);
  }
}


function renderRest(app, viewMatrix, cellID) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;

  { // resthedron 
    gl.bindVertexArray(objects.rest.vao);

    const worldMatrix = (cellID == 7) ? translateCell(state.explode2, cellID)
      : (cellID == 0) ? matrix4.multiply(
        matrix4.translate(-1-state.explode1/2, -1-state.explode1/2, 1+state.explode1/2),
        matrix4.scale(1, 1, 1),
      ) : (cellID == 1) ? matrix4.multiply(
        translateCell(state.explode2, cellID),
        matrix4.xRotate(degToRad(90)),
        matrix4.yRotate(degToRad(180)),
        matrix4.scale(1, 1, 1),
      ) : (cellID == 5 /*shit, Z+ as Y-*/) ? matrix4.multiply(
        matrix4.xRotate(degToRad(180)),
        matrix4.translate(-1-state.explode1/2, -1-state.explode1/2, 1+state.explode1/2),
        matrix4.scale(1, 1, 1),
      ) : (cellID == 4 /*shit, Z- as Y+*/) ? matrix4.multiply(
        translateCell(state.explode2, cellID),
        matrix4.xRotate(degToRad(90)),
        matrix4.yRotate(degToRad(180)),
        matrix4.scale(1, 1, 1),
      ) : (cellID == 2 /*shit, Y- as Z-*/) ? matrix4.multiply(
        matrix4.yRotate(degToRad(180)),
        matrix4.translate(-1-state.explode1/2, -1-state.explode1/2, 1+state.explode1/2),
        matrix4.scale(1, 1, 1),
      ) : (cellID == 3 /*shit, Y+ as Z+*/) ? matrix4.multiply(
        translateCell(state.explode2, cellID),
        matrix4.xRotate(degToRad(90)),
        matrix4.yRotate(degToRad(180)),
        matrix4.scale(1, 1, 1),
      ) : matrix4.multiply(
        matrix4.zRotate(degToRad(180)),
        matrix4.translate(-1-state.explode1/2, -1-state.explode1/2, 1+state.explode1/2),
        matrix4.scale(1, 1, 1),
      );


    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle[cellID][0],
    });

    twgl.drawBufferInfo(gl, objects.rest.bufferInfo);
  }
}

function renderTetrahedron(app, viewMatrix, cellID) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;

    gl.bindVertexArray(objects.rete.vao);

    const worldMatrix = (cellID == 6) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.xRotate(degToRad(90)),
      matrix4.yRotate(degToRad(180)),
      matrix4.translate(-state.explode1/2, -state.explode1/2, state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 0) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.zRotate(degToRad(-90)),
      matrix4.yRotate(degToRad(-90)),
      matrix4.translate(-state.explode1/2, -state.explode1/2, state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 1) ? matrix4.multiply(
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 5) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.xRotate(degToRad(-90)),
      matrix4.zRotate(degToRad(90)),
      matrix4.translate(-state.explode1/2, -state.explode1/2, state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 4) ? matrix4.multiply(
      matrix4.xRotate(degToRad(180)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 2) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad(180)),
      matrix4.translate(-state.explode1/2, -state.explode1/2, state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : (cellID == 3) ? matrix4.multiply(
      matrix4.yRotate(degToRad(180)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : matrix4.multiply(
      matrix4.zRotate(degToRad(180)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle[cellID][1],
    });

    twgl.drawBufferInfo(gl, objects.rete.bufferInfo);
}

function renderCell(app, viewMatrix) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
  } = app;

    renderOctahedron(app, viewMatrix);
    renderRest(app, viewMatrix, 0);
    renderTetrahedron(app, viewMatrix, 1);
    renderRest(app, viewMatrix, 5);
    renderTetrahedron(app, viewMatrix, 4);
    renderRest(app, viewMatrix, 2);
    renderTetrahedron(app, viewMatrix, 3);
    renderRest(app, viewMatrix, 6);
    renderTetrahedron(app, viewMatrix, 7);
}

function render(app) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
  } = app;

  gl.canvas.width = gl.canvas.clientWidth;
  gl.canvas.height = gl.canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.useProgram(programInfo.program);

  const cameraMatrix = matrix4.lookAt(state.cameraPosition, [0, 0, 0], [0, 1, 0]);

  const viewMatrix = matrix4.multiply(
    matrix4.perspective(state.fieldOfView, gl.canvas.width / gl.canvas.height, 0.1, 2000),
    matrix4.inverse(cameraMatrix),
  );

  twgl.setUniforms(programInfo, {
    u_lightDir: state.lightDir,
  });

  renderCell(app, viewMatrix);

  // The effect of a linen box is funny
  { // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(-100, 0, 0),
      matrix4.scale(0, 200, 200),
      matrix4.zRotate(degToRad(270)),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }{ // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(100, 0, 0),
      matrix4.scale(0, 200, 200),
      matrix4.zRotate(degToRad(90)),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }{ // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(0, 0, 100),
      matrix4.scale(200, 200, 0),
      matrix4.xRotate(degToRad(270)),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }{ // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(0, 0, -100),
      matrix4.scale(200, 200, 0),
      matrix4.xRotate(degToRad(90)),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }{ // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(0, 100, 0),
      matrix4.scale(200, 1, 200),
      matrix4.xRotate(degToRad(180)),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }{ // ground
    gl.bindVertexArray(objects.ground.vao);

    const worldMatrix = matrix4.multiply(
      matrix4.translate(0, -100, 0),
      matrix4.scale(200, 1, 200),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: textures.linen,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }
}

function startLoop(app, now = 0) {
  const timeDiff = (now - app.time);
  app.time = now;

  var l = app.state.cameraPosition[2]*app.state.cameraPosition[2]+app.state.cameraPosition[0]*app.state.cameraPosition[0];
  l = Math.sqrt(l)

  app.state.cameraPosition[0] += (app.state.cameraVelocity[0] * (app.state.cameraPosition[2]) + app.state.cameraVelocity[2] * (-app.state.cameraPosition[0])) * timeDiff / l;
  app.state.cameraPosition[1] += app.state.cameraVelocity[1] * timeDiff;
  app.state.cameraPosition[2] += (app.state.cameraVelocity[0] * (-app.state.cameraPosition[0]) + app.state.cameraVelocity[2] * (-app.state.cameraPosition[2])) * timeDiff / l;

  render(app, timeDiff);
  requestAnimationFrame(now => startLoop(app, now));
}

function X(puzzle){
  var temp = puzzle[1];
  puzzle[1] = puzzle[2];
  puzzle[2] = temp;
}

async function main() {
  const app = await setup();
  window.app = app;
  window.gl = app.gl;

  const controlsForm = document.getElementById('controls');
  controlsForm.addEventListener('input', () => {
    const formData = new FormData(controlsForm);

    app.state.explode1 = parseFloat(formData.get('explode1'));
    app.state.explode2 = parseFloat(formData.get('explode2'));
  });
  const XBut = document.getElementById('x-button');
  XBut.addEventListener('click', event => {
    X(app.puzzle);
  });

  document.addEventListener('keydown', event => {
    handleKeyDown(app, event);
  });
  document.addEventListener('keyup', event => {
    handleKeyUp(app, event);
  });

  startLoop(app);
}
main();

function degToRad(deg) {
  return deg * Math.PI / 180;
}

function handleKeyDown(app, event) {
  switch (event.code) {
    case 'ArrowUp':
      app.state.cameraVelocity[1] = CAMERA_MOVE_SPEED;
      break;
    case 'ArrowDown':
      app.state.cameraVelocity[1] = -CAMERA_MOVE_SPEED;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      app.state.cameraVelocity[0] = -CAMERA_MOVE_SPEED;
      break;
    case 'ArrowRight':
    case 'KeyD':
      app.state.cameraVelocity[0] = CAMERA_MOVE_SPEED;
      break;
    case 'KeyW':
      app.state.cameraVelocity[2] = CAMERA_MOVE_SPEED;
      break;
    case 'KeyS':
      app.state.cameraVelocity[2] = -CAMERA_MOVE_SPEED;
      break;
  }
}

function handleKeyUp(app, event) {
  switch (event.code) {
    case 'KeyA':
    case 'KeyD':
    case 'ArrowRight':
    case 'ArrowLeft':
      app.state.cameraVelocity[0] = 0;
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      app.state.cameraVelocity[1] = 0;
      break;
    case 'KeyW':
    case 'KeyS':
      app.state.cameraVelocity[2] = 0;
      break;
  }
}

function handlePointerDown(app, touchOrMouseEvent) {
  const x = touchOrMouseEvent.pageX - app.gl.canvas.width / 2;
  const y = touchOrMouseEvent.pageY - app.gl.canvas.height / 2;

  if (x * x > y * y) {
    if (x > 0) {
      app.state.cameraVelocity[0] = CAMERA_MOVE_SPEED;
    } else {
      app.state.cameraVelocity[0] = -CAMERA_MOVE_SPEED;
    }
  } else {
    if (y < 0) {
      app.state.cameraVelocity[1] = CAMERA_MOVE_SPEED;
    } else {
      app.state.cameraVelocity[1] = -CAMERA_MOVE_SPEED;
    }
  }
}

function handlePointerUp(app) {
  app.state.cameraVelocity[0] = 0;
  app.state.cameraVelocity[1] = 0;
  app.state.cameraVelocity[2] = 0;
}
