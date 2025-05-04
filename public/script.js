// Chaotic glitch grid with music interaction, beat-triggered flashing, and recursive glitch spread.
// Features include:
// - Perlin noise-based dynamic grid layout
// - Mouse click to trigger glitch explosion and sound effects
// - RGB color-split overlay effect
// - Audio beat detection to make grid flash on strong beats

let cols = 15;             // Number of columns in the grid
let rows = 10;             // Number of rows in the grid
let grid = [];             // 2D array to track which cells are filled (true/false)
let colWidths = [], rowHeights = []; // Dynamic widths/heights calculated with noise
let t = 0;                 // Time parameter for noise animation
let playing = false;       // Is background music playing?
let contrast = 3;          // Controls how sharp the Perlin noise variation is
let glitchActive = false;  // Is glitch effect currently active?
let glitchCells = [];      // Stores which cells are glitching
let glitchStart = 0;       // When the glitch started
let glitchDuration = 1000; // How long the glitch lasts (ms)

let glitchOverlayStart = 0;        // When the RGB overlay started
let glitchOverlayDuration = 300;   // How long the RGB overlay lasts
let glitchOverlayActive = false;   // Is the RGB overlay active?

let speedSlider, strengthSlider; // Sliders for speed and noise amplitude
let playPauseButton, clearButton;

let bgMusic;              // Background music
let samples = [];         // Random sound samples triggered on glitch
let delay;                // p5.js delay effect
let amplitude;            // p5.js amplitude object for volume level analysis
let lastLevel = 0;        // Used to compare volume level and detect beats
let beatFlash = [];       // 2D array to track which cells flash on beat

function preload() {
  soundFormats('mp3', 'wav'); // Supported sound file formats
  bgMusic = loadSound('st.mp3'); // Load background music
  // Load three sound effect samples
  samples[0] = loadSound('1.wav');
  samples[1] = loadSound('2.wav');
  samples[2] = loadSound('3.wav');
}

function setup() {
  createCanvas(1200, 800);
  stroke(180);

  // Initialize grid and beatFlash arrays
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    beatFlash[i] = [];
    colWidths[i] = width / cols;
    for (let j = 0; j < rows; j++) {
      grid[i][j] = false;
      beatFlash[i][j] = 0; // 0 = not flashing
    }
  }
  for (let j = 0; j < rows; j++) {
    rowHeights[j] = height / rows;
  }

  // Sliders for adjusting noise speed and strength
  speedSlider = createSlider(0, 0.05, 0.01, 0.001);
  strengthSlider = createSlider(0, 1, 0.5, 0.01);
  speedSlider.position(20, height + 20);
  strengthSlider.position(220, height + 20);

  // Play/Pause button for background music
  playPauseButton = createButton('Play');
  playPauseButton.position(420, height + 20);
  playPauseButton.mousePressed(() => {
    playing = !playing;
    if (playing) {
      bgMusic.setVolume(0, 0);        // Start from 0 volume
      bgMusic.loop();                 // Start loop
      bgMusic.fade(1.0, 0.5);         // Fade in smoothly
      playPauseButton.html('Pause');
    } else {
      bgMusic.fade(0.0, 0.5);         // Fade out smoothly
      setTimeout(() => bgMusic.pause(), 500); // Stop after fade
      playPauseButton.html('Play');
    }
  });

  // Button to reset the grid
  clearButton = createButton('Clear');
  clearButton.position(520, height + 20);
  clearButton.mousePressed(() => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        grid[i][j] = false;
      }
    }
  });

  // Set up delay and amplitude analyzer
  delay = new p5.Delay();               // Create a delay effect
  amplitude = new p5.Amplitude();       // Analyze volume of sound
  amplitude.setInput(bgMusic);          // Use bgMusic as input for volume analysis
}

function draw() {
  background(255);
  stroke(180);

  // Stop glitch if duration passed
  if (glitchActive && millis() > glitchStart + glitchDuration) {
    glitchActive = false;
    glitchCells = [];
  }

  // Animate time for Perlin noise when playing
  if (playing) t += speedSlider.value();

  // Recalculate column widths using noise
  let rawC = [];
  for (let i = 0; i < cols; i++) {
    let n = noise(i * 0.1, t); // Perlin noise at column i
    rawC[i] = pow(n, contrast) * strengthSlider.value() + 0.0001; // avoid zero
  }
  let sumC = rawC.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cols; i++) {
    colWidths[i] = rawC[i] / sumC * width; // Normalize to canvas width
  }

  // Recalculate row heights similarly
  let rawR = [];
  for (let j = 0; j < rows; j++) {
    let n = noise(j * 0.1, t + 100); // Offset time to avoid sync with columns
    rawR[j] = pow(n, contrast) * strengthSlider.value() + 0.0001;
  }
  let sumR = rawR.reduce((a, b) => a + b, 0);
  for (let j = 0; j < rows; j++) {
    rowHeights[j] = rawR[j] / sumR * height;
  }

  // Draw all cells
  let yOff = 0;
  for (let j = 0; j < rows; j++) {
    let xOff = 0;
    for (let i = 0; i < cols; i++) {
      let w = colWidths[i];
      let h = rowHeights[j];

      // Flashing red effect on music beat
      if (beatFlash[i][j] > 0) {
        let pulse = 1.1 + 0.2 * sin(frameCount * 0.5); // Pulsing animation
        fill(grid[i][j] ? 255 : 'red'); // White if filled, red if empty
        rect(xOff, yOff, w * pulse, h * pulse);
        beatFlash[i][j]--;
        xOff += w;
        continue;
      }

      let inGlitch = glitchActive && glitchCells.some(c => c.i === i && c.j === j);

      if (inGlitch) {
        // Glitching cells jitter with RGB color
        let dx = random(-10, 10), dy = random(-10, 10);
        fill(random(['red', 'green', 'blue']));
        rect(xOff + dx, yOff + dy, w, h);
      } else if (glitchActive) {
        // Other cells invert color during glitch
        fill(grid[i][j] ? 255 : 0);
        rect(xOff, yOff, w, h);
      } else {
        // Normal state
        if (grid[i][j]) fill(0); else noFill();
        rect(xOff, yOff, w, h);
      }

      xOff += w;
    }
    yOff += rowHeights[j];
  }

  // RGB overlay effect (color channel separation)
  if (glitchOverlayActive && millis() - glitchOverlayStart < glitchOverlayDuration) {
    let snap = get();                     // Take a snapshot of the canvas
    let r = createImage(width, height);
    let g = createImage(width, height);
    let b = createImage(width, height);
    snap.loadPixels(); r.loadPixels(); g.loadPixels(); b.loadPixels();

    for (let i = 0; i < snap.pixels.length; i += 4) {
      // Copy only one color channel for each image
      r.pixels[i] = snap.pixels[i];       r.pixels[i+3] = snap.pixels[i+3];
      g.pixels[i+1] = snap.pixels[i+1];   g.pixels[i+3] = snap.pixels[i+3];
      b.pixels[i+2] = snap.pixels[i+2];   b.pixels[i+3] = snap.pixels[i+3];
    }

    r.updatePixels(); g.updatePixels(); b.updatePixels();
    image(r, random(-5, 5), 0);      // Slight horizontal shift
    image(g, 0, random(-5, 5));      // Slight vertical shift
    image(b, random(5), random(5));  // Random offset for glitchy feel
  }

  // Beat detection using volume spikes
  let level = amplitude.getLevel(); // Get current audio volume
  let flashCount = floor(map(level, 0, 0.4, 0, 15)); // Map loudness to how many cells flash
  if (level - lastLevel > 0.1) { // Detect sudden spike (beat)
    for (let k = 0; k < flashCount; k++) {
      let i = floor(random(cols));
      let j = floor(random(rows));
      beatFlash[i][j] = 4; // Flash this cell for 4 frames
    }
  }
  lastLevel = level; // Save current level for next comparison
}

function mousePressed() {
  // Convert mouse position into grid index
  let ci = -1, rj = -1, xAcc = 0, yAcc = 0;
  for (let i = 0; i < cols; i++) {
    if (mouseX >= xAcc && mouseX < xAcc + colWidths[i]) { ci = i; break; }
    xAcc += colWidths[i];
  }
  for (let j = 0; j < rows; j++) {
    if (mouseY >= yAcc && mouseY < yAcc + rowHeights[j]) { rj = j; break; }
    yAcc += rowHeights[j];
  }

  if (ci >= 0 && rj >= 0) {
    if (playing) {
      // Trigger glitch + audio when playing
      glitchCells = [];
      glitchActive = true;
      glitchStart = millis();
      glitchOverlayActive = true;
      glitchOverlayStart = millis();
      spreadGlitch(ci, rj, 3); // Recursive glitch explosion

      // Play random sample + echo effect
      let s = random(samples);
      if (s && s.isLoaded()) s.play();
      delay.process(bgMusic, 0.25, 0.6, 800); // Add short echo
      setTimeout(() => delay.disconnect(), 300);
    } else {
      // In pause mode, toggle fill of the clicked cell
      grid[ci][rj] = !grid[ci][rj];
    }
  }
}

// Recursive glitch spread like a ripple effect
function spreadGlitch(i, j, depth) {
  if (depth <= 0 || i < 0 || i >= cols || j < 0 || j >= rows) return;
  if (!grid[i][j]) return;

  glitchCells.push({i, j}); // Add this cell to glitch list

  setTimeout(() => {
    // Spread to neighbors after a delay
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di !== 0 || dj !== 0) {
          spreadGlitch(i + di, j + dj, depth - 1);
        }
      }
    }
  }, 40); // Stagger spread to create wave-like effect
}
