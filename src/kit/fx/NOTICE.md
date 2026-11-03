# Notice

`shaders.ts` contains GLSL ports of shader code from the ArtCraft projects EffectCraft and LightCraft
(https://github.com/storytold/effectcraft, https://github.com/storytold/lightcraft), Copyright the ArtCraft authors,
licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
Changes: translated from WGSL compute shaders to GLSL ES fragment shaders, merged into single passes, parameters renamed;
the glow uses a fixed ring kernel instead of a separate blur pass.
