/** Pokemon.js | The Pokemon Object **/

var Pokemon = function(data) {
  // User Input storage
  this._ = {
    candy: 0, // candy on hand
    quickMove: null,
    chargeMove: null,
    powered: false, // powered up?
    bestStat: 0,
    strongHP: false,
    strongAtk: false,
    strongDef: false // from team leader
  };

  this.id = data.id;
  this.key = data.key;
  this.egg = data.egg;
  this.candy = data.candy;
  this.buddy = data.buddy;
  this.fleeRate = data.fleeRate;
  this.name = data.name;
  if (data.cpm) this.cpm = data.cpm;
  this.stats = data.stats;
  this.type = data.type;
  this.moves = {
    quick: {}, charge: {}
  };

  if (data.legacyMoves) {
    this.moves.legacy = data.legacyMoves;
  }

  var topQuick = 0, topCharge = 0;
  for (var qM in data.quickMoves) {
    var qmKey = data.quickMoves[qM];
    this.moves.quick[qmKey] = new Move(qmKey, data.stats, data.type);
    if (this.moves.quick[qmKey].dps > topQuick) {
      this._.quickMove = qmKey; // set as best
      topQuick = this.moves.quick[qmKey].dps;
    }
  }

  for (var cM in data.chargeMoves) {
    var cmKey = data.chargeMoves[cM];
    this.moves.charge[cmKey] = new Move(cmKey, data.stats, data.type);
    if (this.moves.charge[cmKey].dps > topCharge) {
      this._.chargeMove = cmKey; // set as best
      topCharge = this.moves.charge[cmKey].dps;
    }
  }

  this.maxCP = this.getCP(40, 15, 15, 15);

  // Set defaults to level 20
  this._.cp = this.getCP(20);
  this._.hp = this.getHP(20);
  this._.dust = levelsData["20"].dust;

  this.tree = this.buildTree(data);

  Note("Built Pokemon: " + this.name);
};

Pokemon.prototype = {
  // setter function
  _set: function(obj) {
    var self = this;
    for (var val in obj) {
      if (self._.hasOwnProperty(val)) self._[val] = obj[val];
    }
    return self;
  },

  // calculate CP at a given level
  getCP: function(lvl, attack, defense, stamina) {
    var atk, def, sta, mod;
    atk = this.stats.attack + (attack ? attack : 0);
    def = Math.pow(this.stats.defense + (defense ? defense : 0), 0.5);
    sta = Math.pow(this.stats.stamina + (stamina ? stamina : 0), 0.5);
    mod = Math.pow(levelsData[lvl].cpm, 2);
    return Math.floor(atk * (def * sta * mod) / 10);
  },

  // calculate HP at a given level
  getHP: function(lvl, stamina) {
    var sta = this.stats.stamina + (stamina ? stamina : 0);
    return parseInt(Math.floor(sta * levelsData[lvl].cpm), 10);
  },

  resistance: function() {
    // Make sure we only do generators once!
    if (this.typeAdvantage) return this.typeAdvantage;
    var adv = {};
    // for each type the pokemon has
    for (var _type in this.type) {
      var data = typesData[this.type[_type]];
      // for each effectiveness for the type
      for (var eff in data) {
        for (var types in data[eff]) {
          if (eff != "name") {
            var type = data[eff][types];
            if (!adv[type]) adv[type] = { off: 1, def: 1 };
            if (eff == "halfTo") adv[type].off *= 0.8;
            if (eff == "halfFrom") adv[type].def *= 0.8;
            if (eff == "twiceTo") adv[type].off *= 1.25;
            if (eff == "twiceFrom") adv[type].def *= 1.25;
          }
        }
      }
    }

    for (var mod in adv) {
      // make the data pretty
      if (adv[mod].off == 1) delete adv[mod].off;
      if (adv[mod].def == 1) delete adv[mod].def;
      if (adv[mod].off) adv[mod].off = rnd(adv[mod].off);
      if (adv[mod].def) adv[mod].def = rnd(adv[mod].def);
    }

    this.typeAdvantage = adv;
    return this.typeAdvantage;
  },

  // build family tree (evolves)
  buildTree: function(data) {
    var result = { stages: 1, current: 1, },
      evFr = data.evolveFrom,
      evTo = data.evolveTo;

    var Branch = function(to) {
      var data = pokemonData[to];
      this.id = data.id;
      this.key = to;
      this.stats = data.stats;
      if (data.cpm) this.cpm = data.cpm;
      if (data.candy) this.candy = data.candy;
      if (data.evolveTo) this.evolveTo = data.evolveTo;
      if (data.evolveFrom) this.evolveFrom = data.evolveFrom;
    };

    var build = function(thing) {
      var result = [];
      if (isArr(thing)) {
        for (var t = 0;t < thing.length;t++) result.push(new Branch(thing[t]));
      } else {
        result.push(new Branch(thing));
      }
      return result;
    };

    var brStart, brFrom, brTo, brEnd;
    if (evFr) {
      brFrom = build(evFr);
      for (var f = 0;f < brFrom.length;f++) {
        if (brFrom[f].evolveFrom) brStart = build(brFrom[f].evolveFrom);
      }
      if (brFrom) result.evolveFrom = brFrom;
      if (brStart) result.evolveStart = brStart;
    }

    if (evTo) {
      brTo = build(evTo);
      for (var t = 0;t < brTo.length;t++) {
        if (brTo[t].evolveTo) brEnd = build(brTo[t].evolveTo);
      }
      if (brTo) result.evolveTo = brTo;
      if (brEnd) result.evolveEnd = brEnd;
    }

    return result;
  },

  // evolve calculator
  canEvolve: function() {
    var cp = this._.cp, has = this._.candy, result = {},
      evo = function(req) { return Math.floor(has/req + ((has/req)/req)); };

    // calculate CP of evolved mon
    var cpcalc = function(first, second) {
      if (!cp) return 0;
      if (!second) second = [1,1];
      var min = cp * first[0] * second[0];
      var max = cp * first[1] * second[1];
      return Math.floor(min) + "-" + Math.floor(max);
    };

    // next stage
    if (this.tree.evolveTo) {
      result.evolveTo = [];
      var multiple = this.tree.evolveTo.length > 1;
      for (var a = 0;a < this.tree.evolveTo.length;a++) {
        result.evolveTo.push({
          key: this.tree.evolveTo[a].key,
          cp: cpcalc(multiple ? this.tree.evolveTo[a].cpm : this.cpm),
          evolves: evo(this.candy)
        });
      }
    }

    // last stage
    if (this.tree.evolveEnd) {
      result.evolveEnd = [];
      for (var b = 0;b < this.tree.evolveEnd.length;b++) {
        result.evolveEnd.push({
          key: this.tree.evolveEnd[b].key,
          cp: cpcalc(this.cpm, this.tree.evolveTo[0].cpm),
          evolves: evo(this.candy + this.tree.evolveTo[0].candy)
        });
      }
    }
    return result;
  }
};
