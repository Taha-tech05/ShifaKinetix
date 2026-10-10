import type { PackMeta } from '../../screens/model3d/loadPack';

// Metro resolves these at bundle time. Only the lite pack is shipped (see docs/3d-model.md).
export const LITE_BIN: number = require('../../../assets/models/pack/body-lite.bin');
export const LITE_META: PackMeta = require('../../../assets/models/pack/body-lite.json');
