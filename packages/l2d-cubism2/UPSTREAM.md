# Upstream

This package is a local Cubism 2-only adaptation of:

- `l2d@2.1.1` from https://github.com/hacxy/l2d
- `l2d-widget@0.1.2` from https://github.com/hacxy/l2d-widget

The upstream MIT licenses are included next to this file.

Removed from this local package:

- Cubism 4/6 runtime code
- `Live2DCubismCore` imports and global dependencies
- `.model3.json` loading and model-switch paths

The public widget API remains compatible with the subset used by this blog.
