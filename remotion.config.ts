import { Config } from '@remotion/cli/config';
import fs from 'node:fs';

const local = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (fs.existsSync(local)) Config.setBrowserExecutable(local);
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
