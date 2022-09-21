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
      cosmos: 'http://0.0.0.0:8081/linen.jpg',
      red: 'http://0.0.0.0:8081/red.jpeg',
      orange: 'http://0.0.0.0:8081/orange.jpeg',
      blue: 'http://0.0.0.0:8081/blue.jpeg',
      green: 'http://0.0.0.0:8081/green.jpeg',
      yellow: 'http://0.0.0.0:8081/yellow.jpeg',
      white: 'http://0.0.0.0:8081/white.jpeg',
      pink: 'http://0.0.0.0:8081/pink.jpeg',
      coffee: 'http://0.0.0.0:8081/coffee.jpeg',
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

  var puzzle = {
    sticker:  reset(textures),
    history: [],
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
      explode2: 6,
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

  var sticker = new Array(8).fill(0).map(() => new Array(21).fill(0));
  for (var i = 0; i < 8; i++) { 
    for (var j = 0; j < 21; j++) { 
      sticker[i][j] = textureArray[i];
    }
  }

  return sticker;
}

function twist(puzzle, oct) {
  var temp;
  if (oct == 0) {
    /* W-: 6 */
    temp = puzzle.sticker[6][7];
    puzzle.sticker[6][7] = puzzle.sticker[6][8];
    puzzle.sticker[6][8] = puzzle.sticker[6][11];
    puzzle.sticker[6][11] = temp;
    /* X+ --> Z+ --> Y+ --> X+ */
    temp = puzzle.sticker[1][0];
    puzzle.sticker[1][0] = puzzle.sticker[4][9];
    puzzle.sticker[4][9] = puzzle.sticker[3][6];
    puzzle.sticker[3][6] = temp;
    temp = puzzle.sticker[1][3];
    puzzle.sticker[1][3] = puzzle.sticker[4][4];
    puzzle.sticker[4][4] = puzzle.sticker[3][10];
    puzzle.sticker[3][10] = temp;
    temp = puzzle.sticker[1][4];
    puzzle.sticker[1][4] = puzzle.sticker[4][10];
    puzzle.sticker[4][10] = puzzle.sticker[3][3];
    puzzle.sticker[3][3] = temp;
    temp = puzzle.sticker[1][6];
    puzzle.sticker[1][6] = puzzle.sticker[4][0];
    puzzle.sticker[4][0] = puzzle.sticker[3][9];
    puzzle.sticker[3][9] = temp;
    temp = puzzle.sticker[1][7];
    puzzle.sticker[1][7] = puzzle.sticker[4][8];
    puzzle.sticker[4][8] = puzzle.sticker[3][11];
    puzzle.sticker[3][11] = temp;
    temp = puzzle.sticker[1][8];
    puzzle.sticker[1][8] = puzzle.sticker[4][11];
    puzzle.sticker[4][11] = puzzle.sticker[3][7];
    puzzle.sticker[3][7] = temp;
    temp = puzzle.sticker[1][9];
    puzzle.sticker[1][9] = puzzle.sticker[4][6];
    puzzle.sticker[4][6] = puzzle.sticker[3][0];
    puzzle.sticker[3][0] = temp;
    temp = puzzle.sticker[1][10];
    puzzle.sticker[1][10] = puzzle.sticker[4][3];
    puzzle.sticker[4][3] = puzzle.sticker[3][4];
    puzzle.sticker[3][4] = temp;
    temp = puzzle.sticker[1][11];
    puzzle.sticker[1][11] = puzzle.sticker[4][7];
    puzzle.sticker[4][7] = puzzle.sticker[3][8];
    puzzle.sticker[3][8] = temp;
    temp = puzzle.sticker[1][12];
    puzzle.sticker[1][12] = puzzle.sticker[4][12];
    puzzle.sticker[4][12] = puzzle.sticker[3][12];
    puzzle.sticker[3][12] = temp;
    temp = puzzle.sticker[1][13];
    puzzle.sticker[1][13] = puzzle.sticker[4][15];
    puzzle.sticker[4][15] = puzzle.sticker[3][19];
    puzzle.sticker[3][19] = temp;
    temp = puzzle.sticker[1][14];
    puzzle.sticker[1][14] = puzzle.sticker[4][16];
    puzzle.sticker[4][16] = puzzle.sticker[3][18];
    puzzle.sticker[3][18] = temp;
    temp = puzzle.sticker[1][15];
    puzzle.sticker[1][15] = puzzle.sticker[4][19];
    puzzle.sticker[4][19] = puzzle.sticker[3][13];
    puzzle.sticker[3][13] = temp;
    temp = puzzle.sticker[1][16];
    puzzle.sticker[1][16] = puzzle.sticker[4][18];
    puzzle.sticker[4][18] = puzzle.sticker[3][14];
    puzzle.sticker[3][14] = temp;
    temp = puzzle.sticker[1][18];
    puzzle.sticker[1][18] = puzzle.sticker[4][14];
    puzzle.sticker[4][14] = puzzle.sticker[3][16];
    puzzle.sticker[3][16] = temp;
    temp = puzzle.sticker[1][19];
    puzzle.sticker[1][19] = puzzle.sticker[4][13];
    puzzle.sticker[4][13] = puzzle.sticker[3][15];
    puzzle.sticker[3][15] = temp;
    temp = puzzle.sticker[1][20];
    puzzle.sticker[1][20] = puzzle.sticker[4][20];
    puzzle.sticker[4][20] = puzzle.sticker[3][20];
    puzzle.sticker[3][20] = temp;
    /* X- --> Z- --> Y- --> X- */
    temp = puzzle.sticker[0][4];
    puzzle.sticker[0][4] = puzzle.sticker[5][10];
    puzzle.sticker[5][10] = puzzle.sticker[2][3];
    puzzle.sticker[2][3] = temp;
    temp = puzzle.sticker[0][8];
    puzzle.sticker[0][8] = puzzle.sticker[5][11];
    puzzle.sticker[5][11] = puzzle.sticker[2][7];
    puzzle.sticker[2][7] = temp;
    temp = puzzle.sticker[0][9];
    puzzle.sticker[0][9] = puzzle.sticker[5][6];
    puzzle.sticker[5][6] = puzzle.sticker[2][0];
    puzzle.sticker[2][0] = temp;
    temp = puzzle.sticker[0][13];
    puzzle.sticker[0][13] = puzzle.sticker[5][15];
    puzzle.sticker[5][15] = puzzle.sticker[2][19];
    puzzle.sticker[2][19] = temp;
    /* W+: 7 */
    temp = puzzle.sticker[7][0];
    puzzle.sticker[7][0] = puzzle.sticker[7][3];
    puzzle.sticker[7][3] = puzzle.sticker[7][7];
    puzzle.sticker[7][7] = temp;
    temp = puzzle.sticker[7][1];
    puzzle.sticker[7][1] = puzzle.sticker[7][6];
    puzzle.sticker[7][6] = puzzle.sticker[7][8];
    puzzle.sticker[7][8] = temp;
    temp = puzzle.sticker[7][2];
    puzzle.sticker[7][2] = puzzle.sticker[7][11];
    puzzle.sticker[7][11] = puzzle.sticker[7][4];
    puzzle.sticker[7][4] = temp;
    temp = puzzle.sticker[7][12];
    puzzle.sticker[7][12] = puzzle.sticker[7][18];
    puzzle.sticker[7][18] = puzzle.sticker[7][16];
    puzzle.sticker[7][16] = temp;
    temp = puzzle.sticker[7][13];
    puzzle.sticker[7][13] = puzzle.sticker[7][17];
    puzzle.sticker[7][17] = puzzle.sticker[7][15];
    puzzle.sticker[7][15] = temp;
  } else if (oct == 1) {
    /* W-: 6 */
    temp = puzzle.sticker[6][4];
    puzzle.sticker[6][4] = puzzle.sticker[6][9];
    puzzle.sticker[6][9] = puzzle.sticker[6][8];
    puzzle.sticker[6][8] = temp;
    /* Y+ --> Z+ --> X- --> Y+ */
    temp = puzzle.sticker[4][1];
    puzzle.sticker[4][1] = puzzle.sticker[0][10];
    puzzle.sticker[0][10] = puzzle.sticker[3][7];
    puzzle.sticker[3][7] = temp;
    temp = puzzle.sticker[4][0];
    puzzle.sticker[4][0] = puzzle.sticker[0][5];
    puzzle.sticker[0][5] = puzzle.sticker[3][11];
    puzzle.sticker[3][11] = temp;
    temp = puzzle.sticker[4][5];
    puzzle.sticker[4][5] = puzzle.sticker[0][11];
    puzzle.sticker[0][11] = puzzle.sticker[3][0];
    puzzle.sticker[3][0] = temp;
    temp = puzzle.sticker[4][7];
    puzzle.sticker[4][7] = puzzle.sticker[0][1];
    puzzle.sticker[0][1] = puzzle.sticker[3][10];
    puzzle.sticker[3][10] = temp;
    temp = puzzle.sticker[4][4];
    puzzle.sticker[4][4] = puzzle.sticker[0][9];
    puzzle.sticker[0][9] = puzzle.sticker[3][8];
    puzzle.sticker[3][8] = temp;
    temp = puzzle.sticker[4][9];
    puzzle.sticker[4][9] = puzzle.sticker[0][8];
    puzzle.sticker[0][8] = puzzle.sticker[3][4];
    puzzle.sticker[3][4] = temp;
    temp = puzzle.sticker[4][10];
    puzzle.sticker[4][10] = puzzle.sticker[0][7];
    puzzle.sticker[0][7] = puzzle.sticker[3][1];
    puzzle.sticker[3][1] = temp;
    temp = puzzle.sticker[4][11];
    puzzle.sticker[4][11] = puzzle.sticker[0][0];
    puzzle.sticker[0][0] = puzzle.sticker[3][5];
    puzzle.sticker[3][5] = temp;
    temp = puzzle.sticker[4][8];
    puzzle.sticker[4][8] = puzzle.sticker[0][4];
    puzzle.sticker[0][4] = puzzle.sticker[3][9];
    puzzle.sticker[3][9] = temp;
    temp = puzzle.sticker[4][13];
    puzzle.sticker[4][13] = puzzle.sticker[0][13];
    puzzle.sticker[0][13] = puzzle.sticker[3][13];
    puzzle.sticker[3][13] = temp;
    temp = puzzle.sticker[4][14];
    puzzle.sticker[4][14] = puzzle.sticker[0][12];
    puzzle.sticker[0][12] = puzzle.sticker[3][18];
    puzzle.sticker[3][18] = temp;
    temp = puzzle.sticker[4][15];
    puzzle.sticker[4][15] = puzzle.sticker[0][19];
    puzzle.sticker[0][19] = puzzle.sticker[3][17];
    puzzle.sticker[3][17] = temp;
    temp = puzzle.sticker[4][12];
    puzzle.sticker[4][12] = puzzle.sticker[0][18];
    puzzle.sticker[0][18] = puzzle.sticker[3][14];
    puzzle.sticker[3][14] = temp;
    temp = puzzle.sticker[4][19];
    puzzle.sticker[4][19] = puzzle.sticker[0][17];
    puzzle.sticker[0][17] = puzzle.sticker[3][15];
    puzzle.sticker[3][15] = temp;
    temp = puzzle.sticker[4][17];
    puzzle.sticker[4][17] = puzzle.sticker[0][15];
    puzzle.sticker[0][15] = puzzle.sticker[3][19];
    puzzle.sticker[3][19] = temp;
    temp = puzzle.sticker[4][18];
    puzzle.sticker[4][18] = puzzle.sticker[0][14];
    puzzle.sticker[0][14] = puzzle.sticker[3][12];
    puzzle.sticker[3][12] = temp;
    temp = puzzle.sticker[4][20];
    puzzle.sticker[4][20] = puzzle.sticker[0][20];
    puzzle.sticker[0][20] = puzzle.sticker[3][20];
    puzzle.sticker[3][20] = temp;
    /* Y- --> Z- --> X+ --> Y- */
    temp = puzzle.sticker[5][5];
    puzzle.sticker[5][5] = puzzle.sticker[1][11];
    puzzle.sticker[1][11] = puzzle.sticker[2][0];
    puzzle.sticker[2][0] = temp;
    temp = puzzle.sticker[5][9];
    puzzle.sticker[5][9] = puzzle.sticker[1][8];
    puzzle.sticker[1][8] = puzzle.sticker[2][4];
    puzzle.sticker[2][4] = temp;
    temp = puzzle.sticker[5][10];
    puzzle.sticker[5][10] = puzzle.sticker[1][7];
    puzzle.sticker[1][7] = puzzle.sticker[2][1];
    puzzle.sticker[2][1] = temp;
    temp = puzzle.sticker[5][14];
    puzzle.sticker[5][14] = puzzle.sticker[1][12];
    puzzle.sticker[1][12] = puzzle.sticker[2][18];
    puzzle.sticker[2][18] = temp;
    /* W+: 7 */
    temp = puzzle.sticker[7][1];
    puzzle.sticker[7][1] = puzzle.sticker[7][0];
    puzzle.sticker[7][0] = puzzle.sticker[7][4];
    puzzle.sticker[7][4] = temp;
    temp = puzzle.sticker[7][2];
    puzzle.sticker[7][2] = puzzle.sticker[7][7];
    puzzle.sticker[7][7] = puzzle.sticker[7][9];
    puzzle.sticker[7][9] = temp;
    temp = puzzle.sticker[7][3];
    puzzle.sticker[7][3] = puzzle.sticker[7][7];
    puzzle.sticker[7][7] = puzzle.sticker[7][5];
    puzzle.sticker[7][5] = temp;
    temp = puzzle.sticker[7][13];
    puzzle.sticker[7][13] = puzzle.sticker[7][17];
    puzzle.sticker[7][17] = puzzle.sticker[7][19];
    puzzle.sticker[7][19] = temp;
    temp = puzzle.sticker[7][14];
    puzzle.sticker[7][14] = puzzle.sticker[7][16];
    puzzle.sticker[7][16] = puzzle.sticker[7][12];
    puzzle.sticker[7][12] = temp;
  } else if (oct == 2) {
    /* W-: 6 */
    temp = puzzle.sticker[6][5];
    puzzle.sticker[6][5] = puzzle.sticker[6][10];
    puzzle.sticker[6][10] = puzzle.sticker[6][9];
    puzzle.sticker[6][9] = temp;
    /* X- --> Z+ --> Y- --> X- */
    temp = puzzle.sticker[0][2];
    puzzle.sticker[0][2] = puzzle.sticker[5][11];
    puzzle.sticker[5][11] = puzzle.sticker[3][4];
    puzzle.sticker[3][4] = temp;
    temp = puzzle.sticker[0][1];
    puzzle.sticker[0][1] = puzzle.sticker[5][6];
    puzzle.sticker[5][6] = puzzle.sticker[3][8];
    puzzle.sticker[3][8] = temp;
    temp = puzzle.sticker[0][6];
    puzzle.sticker[0][6] = puzzle.sticker[5][8];
    puzzle.sticker[5][8] = puzzle.sticker[3][1];
    puzzle.sticker[3][1] = temp;
    temp = puzzle.sticker[0][4];
    puzzle.sticker[0][4] = puzzle.sticker[5][2];
    puzzle.sticker[5][2] = puzzle.sticker[3][11];
    puzzle.sticker[3][11] = temp;
    temp = puzzle.sticker[0][5];
    puzzle.sticker[0][5] = puzzle.sticker[5][10];
    puzzle.sticker[5][10] = puzzle.sticker[3][9];
    puzzle.sticker[3][9] = temp;
    temp = puzzle.sticker[0][10];
    puzzle.sticker[0][10] = puzzle.sticker[5][9];
    puzzle.sticker[5][9] = puzzle.sticker[3][5];
    puzzle.sticker[3][5] = temp;
    temp = puzzle.sticker[0][11];
    puzzle.sticker[0][11] = puzzle.sticker[5][4];
    puzzle.sticker[5][4] = puzzle.sticker[3][2];
    puzzle.sticker[3][2] = temp;
    temp = puzzle.sticker[0][8];
    puzzle.sticker[0][8] = puzzle.sticker[5][1];
    puzzle.sticker[5][1] = puzzle.sticker[3][6];
    puzzle.sticker[3][6] = temp;
    temp = puzzle.sticker[0][9];
    puzzle.sticker[0][9] = puzzle.sticker[5][5];
    puzzle.sticker[5][5] = puzzle.sticker[3][10];
    puzzle.sticker[3][10] = temp;
    temp = puzzle.sticker[0][14];
    puzzle.sticker[0][14] = puzzle.sticker[5][14];
    puzzle.sticker[5][14] = puzzle.sticker[3][14];
    puzzle.sticker[3][14] = temp;
    temp = puzzle.sticker[0][15];
    puzzle.sticker[0][15] = puzzle.sticker[5][13];
    puzzle.sticker[5][13] = puzzle.sticker[3][17];
    puzzle.sticker[3][17] = temp;
    temp = puzzle.sticker[0][12];
    puzzle.sticker[0][12] = puzzle.sticker[5][18];
    puzzle.sticker[5][18] = puzzle.sticker[3][16];
    puzzle.sticker[3][16] = temp;
    temp = puzzle.sticker[0][13];
    puzzle.sticker[0][13] = puzzle.sticker[5][17];
    puzzle.sticker[5][17] = puzzle.sticker[3][15];
    puzzle.sticker[3][15] = temp;
    temp = puzzle.sticker[0][18];
    puzzle.sticker[0][18] = puzzle.sticker[5][16];
    puzzle.sticker[5][16] = puzzle.sticker[3][12];
    puzzle.sticker[3][12] = temp;
    temp = puzzle.sticker[0][16];
    puzzle.sticker[0][16] = puzzle.sticker[5][12];
    puzzle.sticker[5][12] = puzzle.sticker[3][18];
    puzzle.sticker[3][18] = temp;
    temp = puzzle.sticker[0][17];
    puzzle.sticker[0][17] = puzzle.sticker[5][15];
    puzzle.sticker[5][15] = puzzle.sticker[3][13];
    puzzle.sticker[3][13] = temp;
    temp = puzzle.sticker[0][20];
    puzzle.sticker[0][20] = puzzle.sticker[5][20];
    puzzle.sticker[5][20] = puzzle.sticker[3][20];
    puzzle.sticker[3][20] = temp;
    /* X+ --> Z- --> Y+ --> X+ */
    temp = puzzle.sticker[1][6];
    puzzle.sticker[1][6] = puzzle.sticker[4][8];
    puzzle.sticker[4][8] = puzzle.sticker[2][1];
    puzzle.sticker[2][1] = temp;
    temp = puzzle.sticker[1][10];
    puzzle.sticker[1][10] = puzzle.sticker[4][9];
    puzzle.sticker[4][9] = puzzle.sticker[2][5];
    puzzle.sticker[2][5] = temp;
    temp = puzzle.sticker[1][11];
    puzzle.sticker[1][11] = puzzle.sticker[4][4];
    puzzle.sticker[4][4] = puzzle.sticker[2][2];
    puzzle.sticker[2][2] = temp;
    temp = puzzle.sticker[1][15];
    puzzle.sticker[1][15] = puzzle.sticker[4][13];
    puzzle.sticker[4][13] = puzzle.sticker[2][17];
    puzzle.sticker[2][17] = temp;
    /* W+: 7 */
    temp = puzzle.sticker[7][2];
    puzzle.sticker[7][2] = puzzle.sticker[7][1];
    puzzle.sticker[7][1] = puzzle.sticker[7][5];
    puzzle.sticker[7][5] = temp;
    temp = puzzle.sticker[7][3];
    puzzle.sticker[7][3] = puzzle.sticker[7][4];
    puzzle.sticker[7][4] = puzzle.sticker[7][10];
    puzzle.sticker[7][10] = temp;
    temp = puzzle.sticker[7][0];
    puzzle.sticker[7][0] = puzzle.sticker[7][4];
    puzzle.sticker[7][4] = puzzle.sticker[7][6];
    puzzle.sticker[7][6] = temp;
    temp = puzzle.sticker[7][14];
    puzzle.sticker[7][14] = puzzle.sticker[7][16];
    puzzle.sticker[7][16] = puzzle.sticker[7][18];
    puzzle.sticker[7][18] = temp;
    temp = puzzle.sticker[7][15];
    puzzle.sticker[7][15] = puzzle.sticker[7][19];
    puzzle.sticker[7][19] = puzzle.sticker[7][13];
    puzzle.sticker[7][13] = temp;
  } else if (oct == 3) {
    /* W-: 6 */
    temp = puzzle.sticker[6][6];
    puzzle.sticker[6][6] = puzzle.sticker[6][11];
    puzzle.sticker[6][11] = puzzle.sticker[6][10];
    puzzle.sticker[6][10] = temp;
    /* Y- --> Z+ --> X+ --> Y- */
    temp = puzzle.sticker[5][3];
    puzzle.sticker[5][3] = puzzle.sticker[1][8];
    puzzle.sticker[1][8] = puzzle.sticker[3][5];
    puzzle.sticker[3][5] = temp;
    temp = puzzle.sticker[5][2];
    puzzle.sticker[5][2] = puzzle.sticker[1][7];
    puzzle.sticker[1][7] = puzzle.sticker[3][9];
    puzzle.sticker[3][9] = temp;
    temp = puzzle.sticker[5][7];
    puzzle.sticker[5][7] = puzzle.sticker[1][9];
    puzzle.sticker[1][9] = puzzle.sticker[3][2];
    puzzle.sticker[3][2] = temp;
    temp = puzzle.sticker[5][5];
    puzzle.sticker[5][5] = puzzle.sticker[1][3];
    puzzle.sticker[1][3] = puzzle.sticker[3][8];
    puzzle.sticker[3][8] = temp;
    temp = puzzle.sticker[5][6];
    puzzle.sticker[5][6] = puzzle.sticker[1][11];
    puzzle.sticker[1][11] = puzzle.sticker[3][10];
    puzzle.sticker[3][10] = temp;
    temp = puzzle.sticker[5][11];
    puzzle.sticker[5][11] = puzzle.sticker[1][10];
    puzzle.sticker[1][10] = puzzle.sticker[3][6];
    puzzle.sticker[3][6] = temp;
    temp = puzzle.sticker[5][8];
    puzzle.sticker[5][8] = puzzle.sticker[1][5];
    puzzle.sticker[1][5] = puzzle.sticker[3][3];
    puzzle.sticker[3][3] = temp;
    temp = puzzle.sticker[5][9];
    puzzle.sticker[5][9] = puzzle.sticker[1][2];
    puzzle.sticker[1][2] = puzzle.sticker[3][7];
    puzzle.sticker[3][7] = temp;
    temp = puzzle.sticker[5][10];
    puzzle.sticker[5][10] = puzzle.sticker[1][6];
    puzzle.sticker[1][6] = puzzle.sticker[3][11];
    puzzle.sticker[3][11] = temp;
    temp = puzzle.sticker[5][15];
    puzzle.sticker[5][15] = puzzle.sticker[1][15];
    puzzle.sticker[1][15] = puzzle.sticker[3][15];
    puzzle.sticker[3][15] = temp;
    temp = puzzle.sticker[5][12];
    puzzle.sticker[5][12] = puzzle.sticker[1][14];
    puzzle.sticker[1][14] = puzzle.sticker[3][16];
    puzzle.sticker[3][16] = temp;
    temp = puzzle.sticker[5][13];
    puzzle.sticker[5][13] = puzzle.sticker[1][17];
    puzzle.sticker[1][17] = puzzle.sticker[3][19];
    puzzle.sticker[3][19] = temp;
    temp = puzzle.sticker[5][14];
    puzzle.sticker[5][14] = puzzle.sticker[1][16];
    puzzle.sticker[1][16] = puzzle.sticker[3][12];
    puzzle.sticker[3][12] = temp;
    temp = puzzle.sticker[5][17];
    puzzle.sticker[5][17] = puzzle.sticker[1][19];
    puzzle.sticker[1][19] = puzzle.sticker[3][13];
    puzzle.sticker[3][13] = temp;
    temp = puzzle.sticker[5][19];
    puzzle.sticker[5][19] = puzzle.sticker[1][13];
    puzzle.sticker[1][13] = puzzle.sticker[3][17];
    puzzle.sticker[3][17] = temp;
    temp = puzzle.sticker[5][16];
    puzzle.sticker[5][16] = puzzle.sticker[1][12];
    puzzle.sticker[1][12] = puzzle.sticker[3][14];
    puzzle.sticker[3][14] = temp;
    temp = puzzle.sticker[5][20];
    puzzle.sticker[5][20] = puzzle.sticker[1][20];
    puzzle.sticker[1][20] = puzzle.sticker[3][20];
    puzzle.sticker[3][20] = temp;
    /* Y+ --> Z- --> X- --> Y+ */
    temp = puzzle.sticker[4][7];
    puzzle.sticker[4][7] = puzzle.sticker[0][9];
    puzzle.sticker[0][9] = puzzle.sticker[2][2];
    puzzle.sticker[2][2] = temp;
    temp = puzzle.sticker[4][11];
    puzzle.sticker[4][11] = puzzle.sticker[0][10];
    puzzle.sticker[0][10] = puzzle.sticker[2][6];
    puzzle.sticker[2][6] = temp;
    temp = puzzle.sticker[4][8];
    puzzle.sticker[4][8] = puzzle.sticker[0][5];
    puzzle.sticker[0][5] = puzzle.sticker[2][3];
    puzzle.sticker[2][3] = temp;
    temp = puzzle.sticker[4][12];
    puzzle.sticker[4][12] = puzzle.sticker[0][14];
    puzzle.sticker[0][14] = puzzle.sticker[2][16];
    puzzle.sticker[2][16] = temp;
    /* W+: 7 */
    temp = puzzle.sticker[7][3];
    puzzle.sticker[7][3] = puzzle.sticker[7][2];
    puzzle.sticker[7][2] = puzzle.sticker[7][6];
    puzzle.sticker[7][6] = temp;
    temp = puzzle.sticker[7][0];
    puzzle.sticker[7][0] = puzzle.sticker[7][5];
    puzzle.sticker[7][5] = puzzle.sticker[7][11];
    puzzle.sticker[7][11] = temp;
    temp = puzzle.sticker[7][1];
    puzzle.sticker[7][1] = puzzle.sticker[7][5];
    puzzle.sticker[7][5] = puzzle.sticker[7][7];
    puzzle.sticker[7][7] = temp;
    temp = puzzle.sticker[7][15];
    puzzle.sticker[7][15] = puzzle.sticker[7][19];
    puzzle.sticker[7][19] = puzzle.sticker[7][17];
    puzzle.sticker[7][17] = temp;
    temp = puzzle.sticker[7][12];
    puzzle.sticker[7][12] = puzzle.sticker[7][18];
    puzzle.sticker[7][18] = puzzle.sticker[7][14];
    puzzle.sticker[7][14] = temp;
  }
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

  var sticker = new Array(8).fill(0).map(() => new Array(21).fill(0));
  for (var i = 0; i < 8; i++) { 
    for (var j = 0; j < 21; j++) { 
      sticker[i][j] = textureArray[Math.floor(Math.random()*8)];
    }
  }

  return sticker;
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
      u_texture: puzzle.sticker[cellID][i],
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
      u_texture: puzzle.sticker[cellID][20],
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
      matrix4.yRotate(degToRad((i-3)*(-90))),
      matrix4.zRotate(degToRad(-90)),
      matrix4.translate(state.explode1/2, state.explode1/2, -state.explode1/2),
      matrix4.scale(1, 1, 1),
    );

    twgl.setUniforms(programInfo, {
      u_matrix: matrix4.multiply(viewMatrix, worldMatrix),
      u_normalMatrix: matrix4.transpose(matrix4.inverse(worldMatrix)),
      u_diffuse: [0, 0, 0],
      u_texture: puzzle.sticker[cellID][i+12],
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
  var temp = puzzle.sticker[3];
  puzzle.sticker[3] = puzzle.sticker[6];
  puzzle.sticker[6] = puzzle.sticker[2];
  puzzle.sticker[2] = puzzle.sticker[7];
  puzzle.sticker[7] = temp;

  /* X+ */
  /* edge */
  temp = puzzle.sticker[1][0];
  puzzle.sticker[1][0] = puzzle.sticker[1][7];
  puzzle.sticker[1][7] = puzzle.sticker[1][8];
  puzzle.sticker[1][8] = puzzle.sticker[1][4];
  puzzle.sticker[1][4] = temp;
  temp = puzzle.sticker[1][1];
  puzzle.sticker[1][1] = puzzle.sticker[1][3];
  puzzle.sticker[1][3] = puzzle.sticker[1][11];
  puzzle.sticker[1][11] = puzzle.sticker[1][9];
  puzzle.sticker[1][9] = temp;
  temp = puzzle.sticker[1][2];
  puzzle.sticker[1][2] = puzzle.sticker[1][6];
  puzzle.sticker[1][6] = puzzle.sticker[1][10];
  puzzle.sticker[1][10] = puzzle.sticker[1][5];
  puzzle.sticker[1][5] = temp;
  /* center */
  temp = puzzle.sticker[1][12];
  puzzle.sticker[1][12] = puzzle.sticker[1][13];
  puzzle.sticker[1][13] = puzzle.sticker[1][18];
  puzzle.sticker[1][18] = puzzle.sticker[1][19];
  puzzle.sticker[1][19] = temp;
  temp = puzzle.sticker[1][14];
  puzzle.sticker[1][14] = puzzle.sticker[1][17];
  puzzle.sticker[1][17] = puzzle.sticker[1][16];
  puzzle.sticker[1][16] = puzzle.sticker[1][15];
  puzzle.sticker[1][15] = temp;
  /* X- */
  /* edge */
  temp = puzzle.sticker[0][0];
  puzzle.sticker[0][0] = puzzle.sticker[0][4];
  puzzle.sticker[0][4] = puzzle.sticker[0][8];
  puzzle.sticker[0][8] = puzzle.sticker[0][7];
  puzzle.sticker[0][7] = temp;
  temp = puzzle.sticker[0][1];
  puzzle.sticker[0][1] = puzzle.sticker[0][9];
  puzzle.sticker[0][9] = puzzle.sticker[0][11];
  puzzle.sticker[0][11] = puzzle.sticker[0][3];
  puzzle.sticker[0][3] = temp;
  temp = puzzle.sticker[0][2];
  puzzle.sticker[0][2] = puzzle.sticker[0][5];
  puzzle.sticker[0][5] = puzzle.sticker[0][10];
  puzzle.sticker[0][10] = puzzle.sticker[0][6];
  puzzle.sticker[0][6] = temp;
  /* center */
  temp = puzzle.sticker[0][12];
  puzzle.sticker[0][12] = puzzle.sticker[0][19];
  puzzle.sticker[0][19] = puzzle.sticker[0][18];
  puzzle.sticker[0][18] = puzzle.sticker[0][13];
  puzzle.sticker[0][13] = temp;
  temp = puzzle.sticker[0][14];
  puzzle.sticker[0][14] = puzzle.sticker[0][15];
  puzzle.sticker[0][15] = puzzle.sticker[0][16];
  puzzle.sticker[0][16] = puzzle.sticker[0][17];
  puzzle.sticker[0][17] = temp;
  /* Y- */
  /* edge */
  temp = puzzle.sticker[5][0];
  puzzle.sticker[5][0] = puzzle.sticker[5][2];
  puzzle.sticker[5][2] = puzzle.sticker[5][10];
  puzzle.sticker[5][10] = puzzle.sticker[5][8];
  puzzle.sticker[5][8] = temp;
  temp = puzzle.sticker[5][1];
  puzzle.sticker[5][1] = puzzle.sticker[5][5];
  puzzle.sticker[5][5] = puzzle.sticker[5][9];
  puzzle.sticker[5][9] = puzzle.sticker[5][4];
  puzzle.sticker[5][4] = temp;
  temp = puzzle.sticker[5][3];
  puzzle.sticker[5][3] = puzzle.sticker[5][6];
  puzzle.sticker[5][6] = puzzle.sticker[5][11];
  puzzle.sticker[5][11] = puzzle.sticker[5][7];
  puzzle.sticker[5][7] = temp;
  /* center */
  temp = puzzle.sticker[5][12];
  puzzle.sticker[5][12] = puzzle.sticker[5][19];
  puzzle.sticker[5][19] = puzzle.sticker[5][16];
  puzzle.sticker[5][16] = puzzle.sticker[5][15];
  puzzle.sticker[5][15] = temp;
  temp = puzzle.sticker[5][13];
  puzzle.sticker[5][13] = puzzle.sticker[5][18];
  puzzle.sticker[5][18] = puzzle.sticker[5][17];
  puzzle.sticker[5][17] = puzzle.sticker[5][14];
  puzzle.sticker[5][14] = temp;
  /* Y+ */
  /* edge */
  temp = puzzle.sticker[4][0];
  puzzle.sticker[4][0] = puzzle.sticker[4][8];
  puzzle.sticker[4][8] = puzzle.sticker[4][10];
  puzzle.sticker[4][10] = puzzle.sticker[4][2];
  puzzle.sticker[4][2] = temp;
  temp = puzzle.sticker[4][1];
  puzzle.sticker[4][1] = puzzle.sticker[4][4];
  puzzle.sticker[4][4] = puzzle.sticker[4][9];
  puzzle.sticker[4][9] = puzzle.sticker[4][5];
  puzzle.sticker[4][5] = temp;
  temp = puzzle.sticker[4][3];
  puzzle.sticker[4][3] = puzzle.sticker[4][7];
  puzzle.sticker[4][7] = puzzle.sticker[4][11];
  puzzle.sticker[4][11] = puzzle.sticker[4][6];
  puzzle.sticker[4][6] = temp;
  /* center */
  temp = puzzle.sticker[4][12];
  puzzle.sticker[4][12] = puzzle.sticker[4][15];
  puzzle.sticker[4][15] = puzzle.sticker[4][16];
  puzzle.sticker[4][16] = puzzle.sticker[4][19];
  puzzle.sticker[4][19] = temp;
  temp = puzzle.sticker[4][13];
  puzzle.sticker[4][13] = puzzle.sticker[4][14];
  puzzle.sticker[4][14] = puzzle.sticker[4][17];
  puzzle.sticker[4][17] = puzzle.sticker[4][18];
  puzzle.sticker[4][18] = temp;
}

function Y(puzzle){
  /* Y- --> W- --> Y+ --> W+ */
  var temp = puzzle.sticker[4];
  puzzle.sticker[4] = puzzle.sticker[6].slice();
  puzzle.sticker[6] = puzzle.sticker[5].slice();
  puzzle.sticker[5][0] = puzzle.sticker[7][10];
  puzzle.sticker[5][1] = puzzle.sticker[7][9];
  puzzle.sticker[5][2] = puzzle.sticker[7][8];
  puzzle.sticker[5][3] = puzzle.sticker[7][11];
  puzzle.sticker[5][4] = puzzle.sticker[7][5];
  puzzle.sticker[5][5] = puzzle.sticker[7][4];
  puzzle.sticker[5][6] = puzzle.sticker[7][7];
  puzzle.sticker[5][7] = puzzle.sticker[7][6];
  puzzle.sticker[5][8] = puzzle.sticker[7][2];
  puzzle.sticker[5][9] = puzzle.sticker[7][1];
  puzzle.sticker[5][10] = puzzle.sticker[7][0];
  puzzle.sticker[5][11] = puzzle.sticker[7][3];
  puzzle.sticker[5][12] = puzzle.sticker[7][16];
  puzzle.sticker[5][13] = puzzle.sticker[7][17];
  puzzle.sticker[5][14] = puzzle.sticker[7][18];
  puzzle.sticker[5][15] = puzzle.sticker[7][19];
  puzzle.sticker[5][16] = puzzle.sticker[7][12];
  puzzle.sticker[5][17] = puzzle.sticker[7][13];
  puzzle.sticker[5][18] = puzzle.sticker[7][14];
  puzzle.sticker[5][19] = puzzle.sticker[7][15];
  puzzle.sticker[5][20] = puzzle.sticker[7][20];
  puzzle.sticker[7][0] = temp[10];
  puzzle.sticker[7][1] = temp[9];
  puzzle.sticker[7][2] = temp[8];
  puzzle.sticker[7][3] = temp[11];
  puzzle.sticker[7][4] = temp[5];
  puzzle.sticker[7][5] = temp[4];
  puzzle.sticker[7][6] = temp[7];
  puzzle.sticker[7][7] = temp[6];
  puzzle.sticker[7][8] = temp[2];
  puzzle.sticker[7][9] = temp[1];
  puzzle.sticker[7][10] = temp[0];
  puzzle.sticker[7][11] = temp[3];
  puzzle.sticker[7][12] = temp[16];
  puzzle.sticker[7][13] = temp[17];
  puzzle.sticker[7][14] = temp[18];
  puzzle.sticker[7][15] = temp[19];
  puzzle.sticker[7][16] = temp[12];
  puzzle.sticker[7][17] = temp[13];
  puzzle.sticker[7][18] = temp[14];
  puzzle.sticker[7][19] = temp[15];
  puzzle.sticker[7][20] = temp[20];

  /* X+ */
  /* edge */
  temp = puzzle.sticker[1][0];
  puzzle.sticker[1][0] = puzzle.sticker[1][1];
  puzzle.sticker[1][1] = puzzle.sticker[1][2];
  puzzle.sticker[1][2] = puzzle.sticker[1][3];
  puzzle.sticker[1][3] = temp;
  temp = puzzle.sticker[1][4];
  puzzle.sticker[1][4] = puzzle.sticker[1][5];
  puzzle.sticker[1][5] = puzzle.sticker[1][6];
  puzzle.sticker[1][6] = puzzle.sticker[1][7];
  puzzle.sticker[1][7] = temp;
  temp = puzzle.sticker[1][8];
  puzzle.sticker[1][8] = puzzle.sticker[1][9];
  puzzle.sticker[1][9] = puzzle.sticker[1][10];
  puzzle.sticker[1][10] = puzzle.sticker[1][11];
  puzzle.sticker[1][11] = temp;
  /* center */
  temp = puzzle.sticker[1][12];
  puzzle.sticker[1][12] = puzzle.sticker[1][13];
  puzzle.sticker[1][13] = puzzle.sticker[1][14];
  puzzle.sticker[1][14] = puzzle.sticker[1][15];
  puzzle.sticker[1][15] = temp;
  temp = puzzle.sticker[1][16];
  puzzle.sticker[1][16] = puzzle.sticker[1][19];
  puzzle.sticker[1][19] = puzzle.sticker[1][18];
  puzzle.sticker[1][18] = puzzle.sticker[1][17];
  puzzle.sticker[1][17] = temp;
  /* X- */
  /* edge */
  temp = puzzle.sticker[0][0];
  puzzle.sticker[0][0] = puzzle.sticker[0][3];
  puzzle.sticker[0][3] = puzzle.sticker[0][2];
  puzzle.sticker[0][2] = puzzle.sticker[0][1];
  puzzle.sticker[0][1] = temp;
  temp = puzzle.sticker[0][4];
  puzzle.sticker[0][4] = puzzle.sticker[0][7];
  puzzle.sticker[0][7] = puzzle.sticker[0][6];
  puzzle.sticker[0][6] = puzzle.sticker[0][5];
  puzzle.sticker[0][5] = temp;
  temp = puzzle.sticker[0][8];
  puzzle.sticker[0][8] = puzzle.sticker[0][11];
  puzzle.sticker[0][11] = puzzle.sticker[0][10];
  puzzle.sticker[0][10] = puzzle.sticker[0][9];
  puzzle.sticker[0][9] = temp;
  /* center */
  temp = puzzle.sticker[0][12];
  puzzle.sticker[0][12] = puzzle.sticker[0][15];
  puzzle.sticker[0][15] = puzzle.sticker[0][14];
  puzzle.sticker[0][14] = puzzle.sticker[0][13];
  puzzle.sticker[0][13] = temp;
  temp = puzzle.sticker[0][16];
  puzzle.sticker[0][16] = puzzle.sticker[0][17];
  puzzle.sticker[0][17] = puzzle.sticker[0][18];
  puzzle.sticker[0][18] = puzzle.sticker[0][19];
  puzzle.sticker[0][19] = temp;
  /* Z+ */
  /* edge */
  temp = puzzle.sticker[3][0];
  puzzle.sticker[3][0] = puzzle.sticker[3][2];
  puzzle.sticker[3][2] = puzzle.sticker[3][10];
  puzzle.sticker[3][10] = puzzle.sticker[3][8];
  puzzle.sticker[3][8] = temp;
  temp = puzzle.sticker[3][1];
  puzzle.sticker[3][1] = puzzle.sticker[3][5];
  puzzle.sticker[3][5] = puzzle.sticker[3][9];
  puzzle.sticker[3][9] = puzzle.sticker[3][4];
  puzzle.sticker[3][4] = temp;
  temp = puzzle.sticker[3][3];
  puzzle.sticker[3][3] = puzzle.sticker[3][6];
  puzzle.sticker[3][6] = puzzle.sticker[3][11];
  puzzle.sticker[3][11] = puzzle.sticker[3][7];
  puzzle.sticker[3][7] = temp;
  /* center */
  temp = puzzle.sticker[3][12];
  puzzle.sticker[3][12] = puzzle.sticker[3][19];
  puzzle.sticker[3][19] = puzzle.sticker[3][16];
  puzzle.sticker[3][16] = puzzle.sticker[3][15];
  puzzle.sticker[3][15] = temp;
  temp = puzzle.sticker[3][13];
  puzzle.sticker[3][13] = puzzle.sticker[3][18];
  puzzle.sticker[3][18] = puzzle.sticker[3][17];
  puzzle.sticker[3][17] = puzzle.sticker[3][14];
  puzzle.sticker[3][14] = temp;
  /* Z- */
  /* edge */
  temp = puzzle.sticker[2][0];
  puzzle.sticker[2][0] = puzzle.sticker[2][8];
  puzzle.sticker[2][8] = puzzle.sticker[2][10];
  puzzle.sticker[2][10] = puzzle.sticker[2][2];
  puzzle.sticker[2][2] = temp;
  temp = puzzle.sticker[2][1];
  puzzle.sticker[2][1] = puzzle.sticker[2][4];
  puzzle.sticker[2][4] = puzzle.sticker[2][9];
  puzzle.sticker[2][9] = puzzle.sticker[2][5];
  puzzle.sticker[2][5] = temp;
  temp = puzzle.sticker[2][3];
  puzzle.sticker[2][3] = puzzle.sticker[2][7];
  puzzle.sticker[2][7] = puzzle.sticker[2][11];
  puzzle.sticker[2][11] = puzzle.sticker[2][6];
  puzzle.sticker[2][6] = temp;
  /* center */
  temp = puzzle.sticker[2][12];
  puzzle.sticker[2][12] = puzzle.sticker[2][15];
  puzzle.sticker[2][15] = puzzle.sticker[2][16];
  puzzle.sticker[2][16] = puzzle.sticker[2][19];
  puzzle.sticker[2][19] = temp;
  temp = puzzle.sticker[2][13];
  puzzle.sticker[2][13] = puzzle.sticker[2][14];
  puzzle.sticker[2][14] = puzzle.sticker[2][17];
  puzzle.sticker[2][17] = puzzle.sticker[2][18];
  puzzle.sticker[2][18] = temp;
}

function X(puzzle){
  /* X- --> W- --> X+ --> W+ */
  var temp = puzzle.sticker[1];
  puzzle.sticker[1] = puzzle.sticker[6].slice();
  puzzle.sticker[6] = puzzle.sticker[0].slice();
  puzzle.sticker[0][0] = puzzle.sticker[7][8];
  puzzle.sticker[0][1] = puzzle.sticker[7][11];
  puzzle.sticker[0][2] = puzzle.sticker[7][10];
  puzzle.sticker[0][3] = puzzle.sticker[7][9];
  puzzle.sticker[0][4] = puzzle.sticker[7][7];
  puzzle.sticker[0][5] = puzzle.sticker[7][6];
  puzzle.sticker[0][6] = puzzle.sticker[7][5];
  puzzle.sticker[0][7] = puzzle.sticker[7][4];
  puzzle.sticker[0][8] = puzzle.sticker[7][0];
  puzzle.sticker[0][9] = puzzle.sticker[7][3];
  puzzle.sticker[0][10] = puzzle.sticker[7][2];
  puzzle.sticker[0][11] = puzzle.sticker[7][1];
  puzzle.sticker[0][12] = puzzle.sticker[7][18];
  puzzle.sticker[0][13] = puzzle.sticker[7][19];
  puzzle.sticker[0][14] = puzzle.sticker[7][16];
  puzzle.sticker[0][15] = puzzle.sticker[7][17];
  puzzle.sticker[0][16] = puzzle.sticker[7][14];
  puzzle.sticker[0][17] = puzzle.sticker[7][15];
  puzzle.sticker[0][18] = puzzle.sticker[7][12];
  puzzle.sticker[0][19] = puzzle.sticker[7][13];
  puzzle.sticker[0][20] = puzzle.sticker[7][20];
  puzzle.sticker[7][0] = temp[8];
  puzzle.sticker[7][1] = temp[11];
  puzzle.sticker[7][2] = temp[10];
  puzzle.sticker[7][3] = temp[9];
  puzzle.sticker[7][4] = temp[7];
  puzzle.sticker[7][5] = temp[6];
  puzzle.sticker[7][6] = temp[5];
  puzzle.sticker[7][7] = temp[4];
  puzzle.sticker[7][8] = temp[0];
  puzzle.sticker[7][9] = temp[3];
  puzzle.sticker[7][10] = temp[2];
  puzzle.sticker[7][11] = temp[1];
  puzzle.sticker[7][12] = temp[18];
  puzzle.sticker[7][13] = temp[19];
  puzzle.sticker[7][14] = temp[16];
  puzzle.sticker[7][15] = temp[17];
  puzzle.sticker[7][16] = temp[14];
  puzzle.sticker[7][17] = temp[15];
  puzzle.sticker[7][18] = temp[12];
  puzzle.sticker[7][19] = temp[13];
  puzzle.sticker[7][20] = temp[20];

  /* Y- */
  /* edge */
  temp = puzzle.sticker[5][0];
  puzzle.sticker[5][0] = puzzle.sticker[5][1];
  puzzle.sticker[5][1] = puzzle.sticker[5][2];
  puzzle.sticker[5][2] = puzzle.sticker[5][3];
  puzzle.sticker[5][3] = temp;
  temp = puzzle.sticker[5][4];
  puzzle.sticker[5][4] = puzzle.sticker[5][5];
  puzzle.sticker[5][5] = puzzle.sticker[5][6];
  puzzle.sticker[5][6] = puzzle.sticker[5][7];
  puzzle.sticker[5][7] = temp;
  temp = puzzle.sticker[5][8];
  puzzle.sticker[5][8] = puzzle.sticker[5][9];
  puzzle.sticker[5][9] = puzzle.sticker[5][10];
  puzzle.sticker[5][10] = puzzle.sticker[5][11];
  puzzle.sticker[5][11] = temp;
  /* center */
  temp = puzzle.sticker[5][12];
  puzzle.sticker[5][12] = puzzle.sticker[5][13];
  puzzle.sticker[5][13] = puzzle.sticker[5][14];
  puzzle.sticker[5][14] = puzzle.sticker[5][15];
  puzzle.sticker[5][15] = temp;
  temp = puzzle.sticker[5][16];
  puzzle.sticker[5][16] = puzzle.sticker[5][19];
  puzzle.sticker[5][19] = puzzle.sticker[5][18];
  puzzle.sticker[5][18] = puzzle.sticker[5][17];
  puzzle.sticker[5][17] = temp;
  /* Y+ */
  /* edge */
  temp = puzzle.sticker[4][0];
  puzzle.sticker[4][0] = puzzle.sticker[4][3];
  puzzle.sticker[4][3] = puzzle.sticker[4][2];
  puzzle.sticker[4][2] = puzzle.sticker[4][1];
  puzzle.sticker[4][1] = temp;
  temp = puzzle.sticker[4][4];
  puzzle.sticker[4][4] = puzzle.sticker[4][7];
  puzzle.sticker[4][7] = puzzle.sticker[4][6];
  puzzle.sticker[4][6] = puzzle.sticker[4][5];
  puzzle.sticker[4][5] = temp;
  temp = puzzle.sticker[4][8];
  puzzle.sticker[4][8] = puzzle.sticker[4][11];
  puzzle.sticker[4][11] = puzzle.sticker[4][10];
  puzzle.sticker[4][10] = puzzle.sticker[4][9];
  puzzle.sticker[4][9] = temp;
  /* center */
  temp = puzzle.sticker[4][12];
  puzzle.sticker[4][12] = puzzle.sticker[4][15];
  puzzle.sticker[4][15] = puzzle.sticker[4][14];
  puzzle.sticker[4][14] = puzzle.sticker[4][13];
  puzzle.sticker[4][13] = temp;
  temp = puzzle.sticker[4][16];
  puzzle.sticker[4][16] = puzzle.sticker[4][17];
  puzzle.sticker[4][17] = puzzle.sticker[4][18];
  puzzle.sticker[4][18] = puzzle.sticker[4][19];
  puzzle.sticker[4][19] = temp;
  /* Z+ */
  /* edge */
  temp = puzzle.sticker[3][0];
  puzzle.sticker[3][0] = puzzle.sticker[3][4];
  puzzle.sticker[3][4] = puzzle.sticker[3][8];
  puzzle.sticker[3][8] = puzzle.sticker[3][7];
  puzzle.sticker[3][7] = temp;
  temp = puzzle.sticker[3][1];
  puzzle.sticker[3][1] = puzzle.sticker[3][9];
  puzzle.sticker[3][9] = puzzle.sticker[3][11];
  puzzle.sticker[3][11] = puzzle.sticker[3][3];
  puzzle.sticker[3][3] = temp;
  temp = puzzle.sticker[3][2];
  puzzle.sticker[3][2] = puzzle.sticker[3][5];
  puzzle.sticker[3][5] = puzzle.sticker[3][10];
  puzzle.sticker[3][10] = puzzle.sticker[3][6];
  puzzle.sticker[3][6] = temp;
  /* center */
  temp = puzzle.sticker[3][12];
  puzzle.sticker[3][12] = puzzle.sticker[3][19];
  puzzle.sticker[3][19] = puzzle.sticker[3][18];
  puzzle.sticker[3][18] = puzzle.sticker[3][13];
  puzzle.sticker[3][13] = temp;
  temp = puzzle.sticker[3][14];
  puzzle.sticker[3][14] = puzzle.sticker[3][15];
  puzzle.sticker[3][15] = puzzle.sticker[3][16];
  puzzle.sticker[3][16] = puzzle.sticker[3][17];
  puzzle.sticker[3][17] = temp;
  /* Z- */
  /* edge */
  temp = puzzle.sticker[2][0];
  puzzle.sticker[2][0] = puzzle.sticker[2][7];
  puzzle.sticker[2][7] = puzzle.sticker[2][8];
  puzzle.sticker[2][8] = puzzle.sticker[2][4];
  puzzle.sticker[2][4] = temp;
  temp = puzzle.sticker[2][1];
  puzzle.sticker[2][1] = puzzle.sticker[2][3];
  puzzle.sticker[2][3] = puzzle.sticker[2][11];
  puzzle.sticker[2][11] = puzzle.sticker[2][9];
  puzzle.sticker[2][9] = temp;
  temp = puzzle.sticker[2][2];
  puzzle.sticker[2][2] = puzzle.sticker[2][6];
  puzzle.sticker[2][6] = puzzle.sticker[2][10];
  puzzle.sticker[2][10] = puzzle.sticker[2][5];
  puzzle.sticker[2][5] = temp;
  /* center */
  temp = puzzle.sticker[2][12];
  puzzle.sticker[2][12] = puzzle.sticker[2][13];
  puzzle.sticker[2][13] = puzzle.sticker[2][18];
  puzzle.sticker[2][18] = puzzle.sticker[2][19];
  puzzle.sticker[2][19] = temp;
  temp = puzzle.sticker[2][14];
  puzzle.sticker[2][14] = puzzle.sticker[2][17];
  puzzle.sticker[2][17] = puzzle.sticker[2][16];
  puzzle.sticker[2][16] = puzzle.sticker[2][15];
  puzzle.sticker[2][15] = temp;
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
    app.puzzle.history.push("X");
  });
  const YButton = document.getElementById('y-button');
  YButton.addEventListener('click', event => {
    Y(app.puzzle);
    app.puzzle.history.push("Y");
  });
  const ZButton = document.getElementById('z-button');
  ZButton.addEventListener('click', event => {
    Z(app.puzzle);
    app.puzzle.history.push("Z");
  });
  /* twist */
  const O0 = document.getElementById('0');
  O0.addEventListener('click', event => {
    twist(app.puzzle, 0);
    app.puzzle.history.push("0");
  });
  const O1 = document.getElementById('1');
  O1.addEventListener('click', event => {
    twist(app.puzzle, 1);
    app.puzzle.history.push("1");
  });
  const O2 = document.getElementById('2');
  O2.addEventListener('click', event => {
    twist(app.puzzle, 2);
    app.puzzle.history.push("2");
  });
  const O3 = document.getElementById('3');
  O3.addEventListener('click', event => {
    twist(app.puzzle, 3);
    app.puzzle.history.push("3");
  });
  /* state */
  const Scramble = document.getElementById('scramble');
  Scramble.addEventListener('click', event => {
    app.puzzle.sticker = scramble(app.textures);
  });
  const Reset = document.getElementById('reset');
  Reset.addEventListener('click', event => {
    app.puzzle.sticker = reset(app.textures);
  });
  const Undo = document.getElementById('undo');
  Undo.addEventListener('click', event => {
    const action = app.puzzle.history.pop();
    if (action == "X") {
      X(app.puzzle);
      X(app.puzzle);
      X(app.puzzle);
    } else if (action == "Y") {
      Y(app.puzzle);
      Y(app.puzzle);
      Y(app.puzzle);
    } else if (action == "Z") {
      Z(app.puzzle);
      Z(app.puzzle);
      Z(app.puzzle);
    } else if (action == "0") {
      twist(app.puzzle, 0);
      twist(app.puzzle, 0);
    } else if (action == "1") {
      twist(app.puzzle, 1);
      twist(app.puzzle, 1);
    }
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
