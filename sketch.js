let myShader;
let bayer8x8;
let bayer16x16;
let blueNoise64x64;
let blueNoiseRGB1024;
let blueNoise512;

function preload() {
  myShader = loadShader('shader.vert', 'shader.frag');
  bayer8x8 = loadImage('images/bayer8.png');
  bayer16x16 = loadImage('images/bayer16.png');
  blueNoise64x64 = loadImage('images/blue_noise64.png');
  blueNoiseRGB1024 = loadImage('images/blue_noiseRGB1024.png');
  blueNoise512 = loadImage('images/blue_noise512.png');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  frameRate(30);

}

function draw() {
  background(51);
  shader(myShader);

  myShader.setUniform("u_resolution", [width, height]);
  myShader.setUniform('u_time', millis() / 1000);
  myShader.setUniform('bayer8x8', bayer8x8);
  myShader.setUniform('bayer16x16', bayer16x16);
  myShader.setUniform('blueNoise64x64', blueNoise64x64);
  myShader.setUniform('blueNoiseRGB1024', blueNoiseRGB1024);
  myShader.setUniform('blueNoise512', blueNoise512);
  rect(0, 0, width, height);

}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  switch (key) {
    case 's':
      saveCanvas();
      break;
  }
}


