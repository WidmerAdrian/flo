# body.glb – sources and licences

Everything that ends up inside `body.glb` (mesh and texture) comes from MakeHuman assets released as **CC0 1.0**
(public domain dedication: commercial use, modification and redistribution allowed, no attribution required).

| What | Asset | Where it came from | Licence |
|---|---|---|---|
| Body mesh, shape targets (male, age 25, muscle 0.68, caucasian), rig and skin weights used only to pose it | MakeHuman base mesh `hm08` (`data/3dobjs/base.obj`), targets and `default` rig, bundled with MPFB 2.0.18 | https://extensions.blender.org/add-ons/mpfb/ (archive: https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip) | CC0. The file header says "explicitly released as CC0 in september 2020". The MPFB **code** is GPL-3.0-or-later, but it is only the tool and is not shipped. |
| Skin texture (diffuse, 2048²) | `skins/young_caucasian_male` (`young_lightskinned_male_diffuse.png`) | MakeHuman system assets pack: https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip (sha256 b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107), listed at https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html | CC0 |
| Eyes (mesh + iris texture) | `eyes/high-poly` + `eyes/materials/brownlight` (cornea shell removed) | same system assets pack | CC0 |
| Eyebrows (baked into the skin texture, the cards themselves are dropped) | `eyebrows/eyebrow002` | same system assets pack | CC0 |
| Hair (short men's cut, mesh + texture, tinted dark brown, alpha MASK) | `hair/short02` (`short02.obj`, `short02_diffuse.png`). Its `packs/makehuman_system_assets.json` entry reads `"short02": {"author": "makehuman_system", "license": "CC0", "type": "hair"}` | same system assets pack | CC0 |
| Loose shorts | Not a downloaded asset. `make_body.py` builds them procedurally: cross-section rings around the body, relaxed against the skin, rolled hem and waistband, and a flat forest-green fabric colour. | – | our own work |

Licence statements:
- https://static.makehumancommunity.org/about/license.html says "All core assets are shared under Creative Commons, CC0 … you are free to do as you see fit with the asset or derivates of the assets. You do not need to pay anything, include any copyright notices nor give attribution."
- The asset pack page lists every item used above as CC0. `packs/makehuman_system_assets.json` inside the zip also says `"license": "CC0"`.

Not used: Mixamo, Renderpeople, 3D Scan Store, SMPL, Sketchfab. No CC-BY assets were used either. The only male underwear and trunks in the asset repo (pants03 / underwear02) are CC-BY, so they were skipped. All four system short hairs (short01 to short04) are CC0 in the pack JSON.

Tooling (not shipped): Blender 5.3 (GPL) and MPFB 2.0.18 (GPL-3.0-or-later). Install location:
`~/Library/Application Support/Blender/5.3/extensions/user_default/mpfb`, with the assets unpacked to
`~/Library/Application Support/Blender/5.3/extensions/.user/user_default/mpfb/data`.
