/* Generated CRIPT Gothic art-pass 01: accepted after multi-view image comparison.
   Does not overwrite saved user assets; only the built-in defaults and optional
   one-click revisions. Camera views + scores in C.MeshForge.curatedScores. */
(function(){
'use strict';
const F=window.Cript?.MeshForge;if(!F)return;
const recipes={
  "chipped-stone": {
    "id": "chipped-stone",
    "name": "Carved Ashlar",
    "type": "ashlar",
    "width": 1.11134,
    "height": 0.61,
    "depth": 0.49121,
    "bevel": 0.06923,
    "erosion": 0.29745,
    "seed": 19
  },
  "gothic-voussoir": {
    "id": "gothic-voussoir",
    "name": "Arch Keystone",
    "type": "profile",
    "outline": [
      [
        -0.33,
        -0.21513
      ],
      [
        0.28178,
        -0.21672
      ],
      [
        0.47,
        0.20777
      ],
      [
        -0.47,
        0.20777
      ]
    ],
    "depth": 0.46442,
    "bevel": 0.02646,
    "erosion": 0.09,
    "seed": 23
  },
  "fluted-column": {
    "id": "fluted-column",
    "name": "Fluted Gothic Column",
    "type": "column",
    "height": 3.79945,
    "radius": 0.33,
    "segments": 28,
    "flutes": 12,
    "fluteDepth": 0.048,
    "seed": 37
  },
  "vault-rib": {
    "id": "vault-rib",
    "name": "Vault Structural Rib",
    "type": "rib",
    "span": 5.2,
    "rise": 2.499,
    "thickness": 0.2261,
    "segments": 18,
    "seed": 44
  },
  "carved-capital": {
    "id": "carved-capital",
    "name": "Carved Column Capital",
    "type": "capital",
    "width": 0.85,
    "height": 0.3905,
    "depth": 0.66983,
    "bevel": 0.05656,
    "erosion": 0.05088,
    "seed": 8
  },
  "stone-sarcophagus": {
    "id": "stone-sarcophagus",
    "name": "Burial Sarcophagus",
    "type": "sarcophagus",
    "width": 1.16,
    "height": 0.78,
    "depth": 2.3,
    "erosion": 0.162,
    "seed": 57
  },
  "urn": {
    "id": "urn",
    "name": "Funerary Clay Urn",
    "type": "urn",
    "height": 1.45,
    "width": 1.19,
    "segments": 28,
    "seed": 66,
    "latheProfile": [
      [
        0.19,
        0
      ],
      [
        0.24,
        0.05
      ],
      [
        0.27,
        0.15
      ],
      [
        0.43839,
        0.38
      ],
      [
        0.54027,
        0.62
      ],
      [
        0.44,
        0.97
      ],
      [
        0.26025,
        1.21
      ],
      [
        0.24,
        1.38
      ],
      [
        0.32,
        1.45
      ],
      [
        0.28,
        1.47
      ],
      [
        0.22,
        1.39
      ],
      [
        0.17,
        1.19
      ],
      [
        0.28,
        0.78
      ],
      [
        0.3,
        0.55
      ],
      [
        0.13,
        0.2
      ],
      [
        0.08,
        0.08
      ]
    ]
  },
  "bell": {
    "id": "bell",
    "name": "Ancient Bronze Bell",
    "type": "bell",
    "height": 1.45,
    "width": 1,
    "segments": 32,
    "seed": 12,
    "latheProfile": [
      [
        0.49,
        0.12
      ],
      [
        0.55936,
        0.2
      ],
      [
        0.54027,
        0.33
      ],
      [
        0.55936,
        0.49
      ],
      [
        0.5117,
        0.71
      ],
      [
        0.31662,
        0.92
      ],
      [
        0.14207,
        1.14
      ],
      [
        0.10554,
        1.24
      ],
      [
        0.08,
        1.23
      ],
      [
        0.12,
        1.12
      ],
      [
        0.25,
        0.86
      ],
      [
        0.36,
        0.7
      ],
      [
        0.43,
        0.49
      ],
      [
        0.43,
        0.29
      ],
      [
        0.4,
        0.18
      ]
    ]
  }
};
const originalDefaults=JSON.parse(JSON.stringify(F.presets));
F.legacyPresets=originalDefaults;
const scores={
  "chipped-stone": {
    "before": 0.875169,
    "after": 0.997358,
    "improvement": 0.122189,
    "changes": [
      "width",
      "depth",
      "bevel",
      "erosion",
      "depth",
      "bevel",
      "erosion",
      "width",
      "bevel",
      "erosion"
    ]
  },
  "gothic-voussoir": {
    "before": 0.944445,
    "after": 0.997217,
    "improvement": 0.052772,
    "changes": [
      "depth",
      "outline:0:1",
      "outline:1:0",
      "outline:1:1",
      "depth",
      "bevel",
      "outline:1:1",
      "outline:2:1",
      "outline:3:1",
      "outline:0:1",
      "outline:1:1"
    ]
  },
  "fluted-column": {
    "before": 0.981732,
    "after": 0.993534,
    "improvement": 0.011802,
    "changes": [
      "segments",
      "height"
    ]
  },
  "vault-rib": {
    "before": 0.746894,
    "after": 0.900048,
    "improvement": 0.153154,
    "changes": [
      "rise",
      "thickness"
    ]
  },
  "carved-capital": {
    "before": 0.943474,
    "after": 0.996261,
    "improvement": 0.052787,
    "changes": [
      "depth",
      "bevel",
      "erosion",
      "depth",
      "bevel",
      "erosion",
      "height",
      "bevel"
    ]
  },
  "stone-sarcophagus": {
    "before": 0.980219,
    "after": 0.98108,
    "improvement": 0.000861,
    "changes": [
      "erosion"
    ]
  },
  "urn": {
    "before": 0.818801,
    "after": 0.993032,
    "improvement": 0.174231,
    "changes": [
      "width",
      "latheR:3",
      "latheR:4",
      "latheR:6",
      "latheR:3"
    ]
  },
  "bell": {
    "before": 0.945616,
    "after": 0.985089,
    "improvement": 0.039473,
    "changes": [
      "latheR:4",
      "latheR:2",
      "latheR:6",
      "latheR:1",
      "latheR:3",
      "latheR:5",
      "latheR:6",
      "latheR:7"
    ]
  }
};
F.curated=recipes;F.curatedScores=scores;
for(const [id,recipe]of Object.entries(recipes))if(F.presets[id])F.presets[id]={...recipe,artPass:'gothic-01'};
})();
