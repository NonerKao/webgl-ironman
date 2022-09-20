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
      cosmos: 'http://0.0.0.0:8080/linen.jpg',
      red: 'http://0.0.0.0:8080/red.jpeg',
      orange: 'http://0.0.0.0:8080/orange.jpeg',
      blue: 'http://0.0.0.0:8080/blue.jpeg',
      green: 'http://0.0.0.0:8080/green.jpeg',
      yellow: 'http://0.0.0.0:8080/yellow.jpeg',
      white: 'http://0.0.0.0:8080/white.jpeg',
      pink: 'http://0.0.0.0:8080/pink.jpeg',
      coffee: 'http://0.0.0.0:8080/coffee.jpeg',
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

  { // regular tetrahedron
    var d = 0.0;
    const attribs = {
	    /*
      position: new Float32Array([-1.5, -1.5, -1.5, -1.5, -0.5, -0.5, -0.5, -0.5, -1.5,
	                          -1.5, -1.5, -1.5, -0.5, -0.5, -1.5, -0.5, -1.5, -0.5,
	                          -1.5, -1.5, -1.5, -0.5, -1.5, -0.5, -1.5, -0.5, -0.5,
	                          -1.5, -0.5, -0.5, -0.5, -1.5, -0.5, -0.5, -0.5, -1.5,]),
				*/
      normal: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1,
	                        1, 1, -1, 1, 1, -1, 1, 1, -1,
	                        -1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        -1, -1, 1, -1, -1, 1, -1, -1, 1]),
				
      position: new Float32Array([0+d, 0+d, -1-d, 0+d, 1+d, 0-d, 1+d, 1+d, -1-d,
	                          0+d, 0+d, -1-d, 1+d, 1+d, -1-d, 1+d, 0+d, 0-d,
	                          0+d, 0+d, -1-d, 1+d, 0+d, 0-d, 0+d, 1+d, 0-d,
	                          0+d, 1+d, 0-d, 1+d, 0+d, 0-d, 1+d, 1+d, -1-d,]),
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

  { // edge tetrahedron
    var d = 0.01;
    const attribs = {
      position: new Float32Array([-1, -1-d, -1-d, 0, -1-d, 0-d, 0, 0-d, -1-d,
	                          0, -1-d, 0-d, 1, -1-d, -1-d, 0, 0-d, -1-d,
	                          -1, -1-d, -1-d, 1, -1-d, -1-d, 0, -1-d, 0-d,
	                          -1, -1-d, -1-d, 0, 0-d, -1-d, 1, -1-d, -1-d,]),
      normal: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1,
	                        1, 1, -1, 1, 1, -1, 1, 1, -1,
	                        -1, -1, -1, -1, -1, -1, -1, -1, -1,
	                        -1, -1, 1, -1, -1, 1, -1, -1, 1]),
      texcoord: new Float32Array([0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1]),
    };
	  
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.edte = {
      attribs,
      bufferInfo,
      vao,
    };
  }

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
      texcoord: new Float32Array([0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1,
	                          0, 0, 1, 0, 0, 1]),
    };
	  
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, attribs);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    objects.octa = {
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

  var puzzle = reset(textures);

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

function reset(textures) {
  var textureArray = new Array(8).fill(0);
  textureArray[0] = textures.orange; // X-
  textureArray[1] = textures.red;    // X+
  textureArray[2] = textures.green;  // Y-
  textureArray[3] = textures.blue;   // Y+
  textureArray[4] = textures.yellow; // Z-
  textureArray[5] = textures.white;  // Z+
  textureArray[6] = textures.pink;   // W-
  textureArray[7] = textures.coffee; // W+, invisible by default

  var puzzle = new Array(8).fill(0).map(() => new Array(21).fill(0));
  for (var i = 0; i < 8; i++) { 
    for (var j = 0; j < 21; j++) { 
      puzzle[i][j] = textureArray[i];
    }
  }

  return puzzle;
}

function scramble(textures) {
  var textureArray = new Array(8).fill(0);
  textureArray[0] = textures.orange; // X-
  textureArray[1] = textures.red;    // X+
  textureArray[2] = textures.green;  // Y-
  textureArray[3] = textures.blue;   // Y+
  textureArray[4] = textures.yellow; // Z-
  textureArray[5] = textures.white;  // Z+
  textureArray[6] = textures.pink;   // W-
  textureArray[7] = textures.coffee; // W+, invisible by default

  var puzzle = new Array(8).fill(0).map(() => new Array(21).fill(0));
  for (var i = 0; i < 8; i++) { 
    for (var j = 0; j < 21; j++) { 
      puzzle[i][j] = textureArray[Math.floor(Math.random()*8)];
    }
  }

  return puzzle;
}

/***
*
*       *-8--*
*  9<--/4   /7
*     *-10-* |
*     5 *--6-*  --> 0
*     |1   |3
*     *-2--*
*
*/
function renderEdgeTetrahedron(app, viewMatrix, cellID) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;
  for (var i = 0; i < 12; i++) { // edge tetrahedron 
    gl.bindVertexArray(objects.edte.vao);

    const worldMatrix = (i < 4) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad(i*90)),
      matrix4.translate(0, -state.explode1, -state.explode1),
      matrix4.scale(1, 1, 1),
    ) : (i < 8) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad((i-4)*90)),
      matrix4.zRotate(degToRad(270)),
      matrix4.translate(0, -state.explode1, -state.explode1),
      matrix4.scale(1, 1, 1),
    ) : matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad((i-4)*90)),
      matrix4.zRotate(degToRad(180)),
      matrix4.translate(0, -state.explode1, -state.explode1),
      matrix4.scale(1, 1, 1),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle[cellID][i],
    });

    twgl.drawBufferInfo(gl, objects.edte.bufferInfo);
  }
}

function translateCell(explode, cellID) {
  const oddity = (cellID % 2 == 1) ? 1 : -1;
  const mat = (cellID == 6 /*W-*/) ? matrix4.translate(0, 0, 0)
  	: (cellID < 2 /*X*/) ? matrix4.translate(oddity*explode, 0, 0)
  	: (cellID < 4 /*Y*/) ? matrix4.translate(0, oddity*explode, 0)
  	: matrix4.translate(0, 0, oddity*explode);
  return mat;
}

function renderOctahedron(app, viewMatrix, cellID) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;

  { // octahedron 
    gl.bindVertexArray(objects.octa.vao);

    const worldMatrix = translateCell(state.explode2, cellID);

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle[cellID][20],
    });

    twgl.drawBufferInfo(gl, objects.octa.bufferInfo);
  }
}

/***
*
*       1----0 
*      /|   /|
*     2----3 |
*     | 6--|-7        
*     |/   |/
*     5----4
*
*/
function renderRegularTetrahedron(app, viewMatrix, cellID) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
    puzzle,
  } = app;

  for (var i = 0; i < 8; i++ ){ // regular tetrahedron 
    gl.bindVertexArray(objects.rete.vao);

    const worldMatrix = (i < 4) ? matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad(i*90)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    ) : matrix4.multiply(
      translateCell(state.explode2, cellID),
      matrix4.yRotate(degToRad((i-4)*90)),
      matrix4.zRotate(degToRad(-90)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle[cellID][i+12],
    });

    twgl.drawBufferInfo(gl, objects.rete.bufferInfo);
  };
}

function renderCell(app, viewMatrix) {
  const {
    gl,
    programInfo,
    textures, objects,
    state,
  } = app;

  for (var i = 0; i < 7; i++ ){ 
    renderOctahedron(app, viewMatrix, i);
    renderRegularTetrahedron(app, viewMatrix, i);
    renderEdgeTetrahedron(app, viewMatrix, i);
  }
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

  // The effect of a cosmos box is funny
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
      u_texture: textures.cosmos,
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
      u_texture: textures.cosmos,
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
      u_texture: textures.cosmos,
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
      u_texture: textures.cosmos,
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
      u_texture: textures.cosmos,
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
      u_texture: textures.cosmos,
    });

    twgl.drawBufferInfo(gl, objects.ground.bufferInfo);
  }
}

function startLoop(app, now = 0) {
  const timeDiff = 10* (now - app.time);
  app.time = now;

  var l = app.state.cameraPosition[2]*app.state.cameraPosition[2]+app.state.cameraPosition[0]*app.state.cameraPosition[0];
  l = Math.sqrt(l)

  app.state.cameraPosition[0] += (app.state.cameraVelocity[0] * (app.state.cameraPosition[2]) + app.state.cameraVelocity[2] * (-app.state.cameraPosition[0])) * timeDiff / l;
  app.state.cameraPosition[1] += app.state.cameraVelocity[1] * timeDiff;
  app.state.cameraPosition[2] += (app.state.cameraVelocity[0] * (-app.state.cameraPosition[0]) + app.state.cameraVelocity[2] * (-app.state.cameraPosition[2])) * timeDiff / l;

  render(app, timeDiff);
  requestAnimationFrame(now => startLoop(app, now));
}

function Z(puzzle){
  /* Z- --> W- --> Z+ --> W+ */
  var temp = puzzle[3];
  puzzle[3] = puzzle[6];
  puzzle[6] = puzzle[2];
  puzzle[2] = puzzle[7];
  puzzle[7] = temp;

  /* X+ */
  /* edge */
  temp = puzzle[1][0];
  puzzle[1][0] = puzzle[1][7];
  puzzle[1][7] = puzzle[1][8];
  puzzle[1][8] = puzzle[1][4];
  puzzle[1][4] = temp;
  temp = puzzle[1][1];
  puzzle[1][1] = puzzle[1][3];
  puzzle[1][3] = puzzle[1][11];
  puzzle[1][11] = puzzle[1][9];
  puzzle[1][9] = temp;
  temp = puzzle[1][2];
  puzzle[1][2] = puzzle[1][6];
  puzzle[1][6] = puzzle[1][10];
  puzzle[1][10] = puzzle[1][5];
  puzzle[1][5] = temp;
  /* center */
  temp = puzzle[1][12];
  puzzle[1][12] = puzzle[1][13];
  puzzle[1][13] = puzzle[1][18];
  puzzle[1][18] = puzzle[1][19];
  puzzle[1][19] = temp;
  temp = puzzle[1][14];
  puzzle[1][14] = puzzle[1][17];
  puzzle[1][17] = puzzle[1][16];
  puzzle[1][16] = puzzle[1][15];
  puzzle[1][15] = temp;
  /* X- */
  /* edge */
  temp = puzzle[0][0];
  puzzle[0][0] = puzzle[0][4];
  puzzle[0][4] = puzzle[0][8];
  puzzle[0][8] = puzzle[0][7];
  puzzle[0][7] = temp;
  temp = puzzle[0][1];
  puzzle[0][1] = puzzle[0][9];
  puzzle[0][9] = puzzle[0][11];
  puzzle[0][11] = puzzle[0][3];
  puzzle[0][3] = temp;
  temp = puzzle[0][2];
  puzzle[0][2] = puzzle[0][5];
  puzzle[0][5] = puzzle[0][10];
  puzzle[0][10] = puzzle[0][6];
  puzzle[0][6] = temp;
  /* center */
  temp = puzzle[0][12];
  puzzle[0][12] = puzzle[0][19];
  puzzle[0][19] = puzzle[0][18];
  puzzle[0][18] = puzzle[0][13];
  puzzle[0][13] = temp;
  temp = puzzle[0][14];
  puzzle[0][14] = puzzle[0][15];
  puzzle[0][15] = puzzle[0][16];
  puzzle[0][16] = puzzle[0][17];
  puzzle[0][17] = temp;
  /* Y- */
  /* edge */
  temp = puzzle[5][0];
  puzzle[5][0] = puzzle[5][2];
  puzzle[5][2] = puzzle[5][10];
  puzzle[5][10] = puzzle[5][8];
  puzzle[5][8] = temp;
  temp = puzzle[5][1];
  puzzle[5][1] = puzzle[5][5];
  puzzle[5][5] = puzzle[5][9];
  puzzle[5][9] = puzzle[5][4];
  puzzle[5][4] = temp;
  temp = puzzle[5][3];
  puzzle[5][3] = puzzle[5][6];
  puzzle[5][6] = puzzle[5][11];
  puzzle[5][11] = puzzle[5][7];
  puzzle[5][7] = temp;
  /* center */
  temp = puzzle[5][12];
  puzzle[5][12] = puzzle[5][19];
  puzzle[5][19] = puzzle[5][16];
  puzzle[5][16] = puzzle[5][15];
  puzzle[5][15] = temp;
  temp = puzzle[5][13];
  puzzle[5][13] = puzzle[5][18];
  puzzle[5][18] = puzzle[5][17];
  puzzle[5][17] = puzzle[5][14];
  puzzle[5][14] = temp;
  /* Y+ */
  /* edge */
  temp = puzzle[4][0];
  puzzle[4][0] = puzzle[4][8];
  puzzle[4][8] = puzzle[4][10];
  puzzle[4][10] = puzzle[4][2];
  puzzle[4][2] = temp;
  temp = puzzle[4][1];
  puzzle[4][1] = puzzle[4][4];
  puzzle[4][4] = puzzle[4][9];
  puzzle[4][9] = puzzle[4][5];
  puzzle[4][5] = temp;
  temp = puzzle[4][3];
  puzzle[4][3] = puzzle[4][7];
  puzzle[4][7] = puzzle[4][11];
  puzzle[4][11] = puzzle[4][6];
  puzzle[4][6] = temp;
  /* center */
  temp = puzzle[4][12];
  puzzle[4][12] = puzzle[4][15];
  puzzle[4][15] = puzzle[4][16];
  puzzle[4][16] = puzzle[4][19];
  puzzle[4][19] = temp;
  temp = puzzle[4][13];
  puzzle[4][13] = puzzle[4][14];
  puzzle[4][14] = puzzle[4][17];
  puzzle[4][17] = puzzle[4][18];
  puzzle[4][18] = temp;
}

function Y(puzzle){
  /* Y- --> W- --> Y+ --> W+ */
  var temp = puzzle[4];
  puzzle[4] = puzzle[6];
  puzzle[6] = puzzle[5];
  puzzle[5] = puzzle[7];
  puzzle[7] = temp;

  /* X+ */
  /* edge */
  temp = puzzle[1][0];
  puzzle[1][0] = puzzle[1][1];
  puzzle[1][1] = puzzle[1][2];
  puzzle[1][2] = puzzle[1][3];
  puzzle[1][3] = temp;
  temp = puzzle[1][4];
  puzzle[1][4] = puzzle[1][5];
  puzzle[1][5] = puzzle[1][6];
  puzzle[1][6] = puzzle[1][7];
  puzzle[1][7] = temp;
  temp = puzzle[1][8];
  puzzle[1][8] = puzzle[1][9];
  puzzle[1][9] = puzzle[1][10];
  puzzle[1][10] = puzzle[1][11];
  puzzle[1][11] = temp;
  /* center */
  temp = puzzle[1][12];
  puzzle[1][12] = puzzle[1][13];
  puzzle[1][13] = puzzle[1][14];
  puzzle[1][14] = puzzle[1][15];
  puzzle[1][15] = temp;
  temp = puzzle[1][16];
  puzzle[1][16] = puzzle[1][19];
  puzzle[1][19] = puzzle[1][18];
  puzzle[1][18] = puzzle[1][17];
  puzzle[1][17] = temp;
  /* X- */
  /* edge */
  temp = puzzle[0][0];
  puzzle[0][0] = puzzle[0][3];
  puzzle[0][3] = puzzle[0][2];
  puzzle[0][2] = puzzle[0][1];
  puzzle[0][1] = temp;
  temp = puzzle[0][4];
  puzzle[0][4] = puzzle[0][7];
  puzzle[0][7] = puzzle[0][6];
  puzzle[0][6] = puzzle[0][5];
  puzzle[0][5] = temp;
  temp = puzzle[0][8];
  puzzle[0][8] = puzzle[0][11];
  puzzle[0][11] = puzzle[0][10];
  puzzle[0][10] = puzzle[0][9];
  puzzle[0][9] = temp;
  /* center */
  temp = puzzle[0][12];
  puzzle[0][12] = puzzle[0][15];
  puzzle[0][15] = puzzle[0][14];
  puzzle[0][14] = puzzle[0][13];
  puzzle[0][13] = temp;
  temp = puzzle[0][16];
  puzzle[0][16] = puzzle[0][17];
  puzzle[0][17] = puzzle[0][18];
  puzzle[0][18] = puzzle[0][19];
  puzzle[0][19] = temp;
  /* Z+ */
  /* edge */
  temp = puzzle[3][0];
  puzzle[3][0] = puzzle[3][2];
  puzzle[3][2] = puzzle[3][10];
  puzzle[3][10] = puzzle[3][8];
  puzzle[3][8] = temp;
  temp = puzzle[3][1];
  puzzle[3][1] = puzzle[3][5];
  puzzle[3][5] = puzzle[3][9];
  puzzle[3][9] = puzzle[3][4];
  puzzle[3][4] = temp;
  temp = puzzle[3][3];
  puzzle[3][3] = puzzle[3][6];
  puzzle[3][6] = puzzle[3][11];
  puzzle[3][11] = puzzle[3][7];
  puzzle[3][7] = temp;
  /* center */
  temp = puzzle[3][12];
  puzzle[3][12] = puzzle[3][19];
  puzzle[3][19] = puzzle[3][16];
  puzzle[3][16] = puzzle[3][15];
  puzzle[3][15] = temp;
  temp = puzzle[3][13];
  puzzle[3][13] = puzzle[3][18];
  puzzle[3][18] = puzzle[3][17];
  puzzle[3][17] = puzzle[3][14];
  puzzle[3][14] = temp;
  /* Z- */
  /* edge */
  temp = puzzle[2][0];
  puzzle[2][0] = puzzle[2][8];
  puzzle[2][8] = puzzle[2][10];
  puzzle[2][10] = puzzle[2][2];
  puzzle[2][2] = temp;
  temp = puzzle[2][1];
  puzzle[2][1] = puzzle[2][4];
  puzzle[2][4] = puzzle[2][9];
  puzzle[2][9] = puzzle[2][5];
  puzzle[2][5] = temp;
  temp = puzzle[2][3];
  puzzle[2][3] = puzzle[2][7];
  puzzle[2][7] = puzzle[2][11];
  puzzle[2][11] = puzzle[2][6];
  puzzle[2][6] = temp;
  /* center */
  temp = puzzle[2][12];
  puzzle[2][12] = puzzle[2][15];
  puzzle[2][15] = puzzle[2][16];
  puzzle[2][16] = puzzle[2][19];
  puzzle[2][19] = temp;
  temp = puzzle[2][13];
  puzzle[2][13] = puzzle[2][14];
  puzzle[2][14] = puzzle[2][17];
  puzzle[2][17] = puzzle[2][18];
  puzzle[2][18] = temp;
}

function X(puzzle){
  /* X- --> W- --> X+ --> W+ */
  var temp = puzzle[1];
  puzzle[1] = puzzle[6];
  puzzle[6] = puzzle[0];
  puzzle[0] = puzzle[7];
  puzzle[7] = temp;

  /* Y- */
  /* edge */
  temp = puzzle[5][0];
  puzzle[5][0] = puzzle[5][1];
  puzzle[5][1] = puzzle[5][2];
  puzzle[5][2] = puzzle[5][3];
  puzzle[5][3] = temp;
  temp = puzzle[5][4];
  puzzle[5][4] = puzzle[5][5];
  puzzle[5][5] = puzzle[5][6];
  puzzle[5][6] = puzzle[5][7];
  puzzle[5][7] = temp;
  temp = puzzle[5][8];
  puzzle[5][8] = puzzle[5][9];
  puzzle[5][9] = puzzle[5][10];
  puzzle[5][10] = puzzle[5][11];
  puzzle[5][11] = temp;
  /* center */
  temp = puzzle[5][12];
  puzzle[5][12] = puzzle[5][13];
  puzzle[5][13] = puzzle[5][14];
  puzzle[5][14] = puzzle[5][15];
  puzzle[5][15] = temp;
  temp = puzzle[5][16];
  puzzle[5][16] = puzzle[5][19];
  puzzle[5][19] = puzzle[5][18];
  puzzle[5][18] = puzzle[5][17];
  puzzle[5][17] = temp;
  /* Y+ */
  /* edge */
  temp = puzzle[4][0];
  puzzle[4][0] = puzzle[4][3];
  puzzle[4][3] = puzzle[4][2];
  puzzle[4][2] = puzzle[4][1];
  puzzle[4][1] = temp;
  temp = puzzle[4][4];
  puzzle[4][4] = puzzle[4][7];
  puzzle[4][7] = puzzle[4][6];
  puzzle[4][6] = puzzle[4][5];
  puzzle[4][5] = temp;
  temp = puzzle[4][8];
  puzzle[4][8] = puzzle[4][11];
  puzzle[4][11] = puzzle[4][10];
  puzzle[4][10] = puzzle[4][9];
  puzzle[4][9] = temp;
  /* center */
  temp = puzzle[4][12];
  puzzle[4][12] = puzzle[4][15];
  puzzle[4][15] = puzzle[4][14];
  puzzle[4][14] = puzzle[4][13];
  puzzle[4][13] = temp;
  temp = puzzle[4][16];
  puzzle[4][16] = puzzle[4][17];
  puzzle[4][17] = puzzle[4][18];
  puzzle[4][18] = puzzle[4][19];
  puzzle[4][19] = temp;
  /* Z+ */
  /* edge */
  temp = puzzle[3][0];
  puzzle[3][0] = puzzle[3][4];
  puzzle[3][4] = puzzle[3][8];
  puzzle[3][8] = puzzle[3][7];
  puzzle[3][7] = temp;
  temp = puzzle[3][1];
  puzzle[3][1] = puzzle[3][9];
  puzzle[3][9] = puzzle[3][11];
  puzzle[3][11] = puzzle[3][3];
  puzzle[3][3] = temp;
  temp = puzzle[3][2];
  puzzle[3][2] = puzzle[3][5];
  puzzle[3][5] = puzzle[3][10];
  puzzle[3][10] = puzzle[3][6];
  puzzle[3][6] = temp;
  /* center */
  temp = puzzle[3][12];
  puzzle[3][12] = puzzle[3][19];
  puzzle[3][19] = puzzle[3][18];
  puzzle[3][18] = puzzle[3][13];
  puzzle[3][13] = temp;
  temp = puzzle[3][14];
  puzzle[3][14] = puzzle[3][15];
  puzzle[3][15] = puzzle[3][16];
  puzzle[3][16] = puzzle[3][17];
  puzzle[3][17] = temp;
  /* Z- */
  /* edge */
  temp = puzzle[2][0];
  puzzle[2][0] = puzzle[2][7];
  puzzle[2][7] = puzzle[2][8];
  puzzle[2][8] = puzzle[2][4];
  puzzle[2][4] = temp;
  temp = puzzle[2][1];
  puzzle[2][1] = puzzle[2][3];
  puzzle[2][3] = puzzle[2][11];
  puzzle[2][11] = puzzle[2][9];
  puzzle[2][9] = temp;
  temp = puzzle[2][2];
  puzzle[2][2] = puzzle[2][6];
  puzzle[2][6] = puzzle[2][10];
  puzzle[2][10] = puzzle[2][5];
  puzzle[2][5] = temp;
  /* center */
  temp = puzzle[2][12];
  puzzle[2][12] = puzzle[2][13];
  puzzle[2][13] = puzzle[2][18];
  puzzle[2][18] = puzzle[2][19];
  puzzle[2][19] = temp;
  temp = puzzle[2][14];
  puzzle[2][14] = puzzle[2][17];
  puzzle[2][17] = puzzle[2][16];
  puzzle[2][16] = puzzle[2][15];
  puzzle[2][15] = temp;
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

  /* puzzle control */
  /* pure rotation */
  const XButton = document.getElementById('x-button');
  XButton.addEventListener('click', event => {
    X(app.puzzle);
  });
  const YButton = document.getElementById('y-button');
  YButton.addEventListener('click', event => {
    Y(app.puzzle);
  });
  const ZButton = document.getElementById('z-button');
  ZButton.addEventListener('click', event => {
    Z(app.puzzle);
  });
  /* twist */
  /* state */
  const Scramble = document.getElementById('scramble');
  Scramble.addEventListener('click', event => {
    app.puzzle = scramble(app.textures);
  });
  const Reset = document.getElementById('reset');
  Reset.addEventListener('click', event => {
    app.puzzle = reset(app.textures);
  });

  /* view control */
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
