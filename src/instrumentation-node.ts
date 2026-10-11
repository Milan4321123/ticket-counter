// sharp's defaults are made for a big machine: libvips keeps up to 50 MB of
// decoded images in its own cache and runs one worker thread per CPU core.
// On the 512 MB Render instance those two together, under a burst of photo
// requests, pushed the process past its memory limit and got it killed. The
// settings are process-wide, so setting them here covers every sharp user.
import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1);
