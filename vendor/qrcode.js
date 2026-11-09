/*
 * qrcode.js — minimal vendored QR Code encoder.
 *
 * Ported from the public-domain / MIT "qrcode-generator" algorithm
 * (Reed-Solomon error correction, QR Code ISO/IEC 18004 module placement).
 * Byte-mode only (sufficient for URLs), versions 1-40, EC levels L/M/Q/H.
 *
 * No network access. Renders directly to an inline SVG string.
 *
 * Usage:
 *   var svg = QRCodeGen.generateSvg("https://example.com", { ecLevel: "M", cellSize: 4, margin: 4 });
 *   container.innerHTML = svg;
 */
(function (global) {
  "use strict";

  /* ───────────────────────── GF(256) arithmetic ───────────────────────── */

  var EXP_TABLE = new Array(256);
  var LOG_TABLE = new Array(256);
  for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (var i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

  function glog(n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return LOG_TABLE[n];
  }
  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 255) n -= 255;
    return EXP_TABLE[n];
  }

  /* ───────────────────────── Polynomial (GF(256)) ───────────────────────── */

  function QRPolynomial(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = num.slice(offset);
    for (var s = 0; s < shift; s++) this.num.push(0);
  }
  QRPolynomial.prototype.get = function (index) {
    return this.num[index];
  };
  QRPolynomial.prototype.getLength = function () {
    return this.num.length;
  };
  QRPolynomial.prototype.multiply = function (other) {
    var num = new Array(this.getLength() + other.getLength() - 1).fill(0);
    for (var i = 0; i < this.getLength(); i++) {
      for (var j = 0; j < other.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(other.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  };
  QRPolynomial.prototype.mod = function (other) {
    var difference = this.getLength() - other.getLength();
    if (difference < 0) return this;
    var ratio = glog(this.get(0)) - glog(other.get(0));
    var num = this.num.slice();
    for (var i = 0; i < other.getLength(); i++) {
      num[i] = num[i] ^ gexp(glog(other.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(other);
  };

  /* ───────────────────────── Reed-Solomon block table ───────────────────────── */
  /* Order per version: L, M, Q, H. Triples of [blockCount, totalCount, dataCount]. */

  var RS_BLOCK_TABLE = [
    [1,26,19],[1,26,16],[1,26,13],[1,26,9],
    [1,44,34],[1,44,28],[1,44,22],[1,44,16],
    [1,70,55],[1,70,44],[2,35,17],[2,35,13],
    [1,100,80],[2,50,32],[2,50,24],[4,25,9],
    [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
    [2,86,68],[4,43,27],[4,43,19],[4,43,15],
    [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
    [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
    [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
    [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
    [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
    [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
    [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
    [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
    [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
    [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
    [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
    [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
    [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
    [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
    [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
    [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
    [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
    [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
    [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
    [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
    [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
    [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
    [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
    [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
    [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
    [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
    [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
    [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
    [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
    [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
    [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
    [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
    [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
    [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
  ];

  /* EC level codes match the ISO format-info field values. */
  var EC_LEVEL = { L: 1, M: 0, Q: 3, H: 2 };
  var EC_OFFSET = { 1: 0, 0: 1, 3: 2, 2: 3 };

  function rsBlocks(version, ecLevel) {
    var offset = EC_OFFSET[ecLevel];
    var row = RS_BLOCK_TABLE[(version - 1) * 4 + offset];
    var blocks = [];
    for (var i = 0; i < row.length; i += 3) {
      var count = row[i], total = row[i + 1], data = row[i + 2];
      for (var k = 0; k < count; k++) blocks.push({ totalCount: total, dataCount: data });
    }
    return blocks;
  }

  /* ───────────────────────── Bit buffer ───────────────────────── */

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype.put = function (num, length) {
    for (var i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  };
  QRBitBuffer.prototype.putBit = function (bit) {
    var bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  };

  /* ───────────────────────── UTF-8 byte encoding ───────────────────────── */

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xffff) i++; // consumed a surrogate pair
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return bytes;
  }

  /* ───────────────────────── Mode / length helpers (byte mode only) ───────────────────────── */

  var MODE_8BIT_BYTE = 4; // 0100

  function lengthInBits(version) {
    return version < 10 ? 8 : 16;
  }

  /* ───────────────────────── Format / version info (BCH) ───────────────────────── */

  var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
  var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
  var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

  function bchDigit(data) {
    var digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  }
  function bchTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) {
      d ^= G15 << (bchDigit(d) - bchDigit(G15));
    }
    return ((data << 10) | d) ^ G15_MASK;
  }
  function bchTypeNumber(data) {
    var d = data << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0) {
      d ^= G18 << (bchDigit(d) - bchDigit(G18));
    }
    return (data << 12) | d;
  }

  /* ───────────────────────── Alignment pattern positions ───────────────────────── */

  var PATTERN_POSITION_TABLE = [
    [],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],
    [6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],
    [6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],
    [6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],
    [6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],
    [6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]
  ];

  /* ───────────────────────── Mask functions ───────────────────────── */

  function getMask(pattern, i, j) {
    switch (pattern) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
      default: throw new Error("bad mask pattern: " + pattern);
    }
  }

  /* ───────────────────────── Mask quality scoring ───────────────────────── */

  function lostPoint(modules) {
    var n = modules.length;
    var lost = 0;

    // Rule 1: runs of 5+ same-colour modules in a row/column.
    for (var row = 0; row < n; row++) {
      var length = 0, prev = null;
      for (var col = 0; col < n; col++) {
        var v = modules[row][col];
        if (v === prev) {
          length++;
        } else {
          if (length >= 5) lost += length - 2;
          length = 1;
          prev = v;
        }
      }
      if (length >= 5) lost += length - 2;
    }
    for (var col = 0; col < n; col++) {
      var length2 = 0, prev2 = null;
      for (var row2 = 0; row2 < n; row2++) {
        var v2 = modules[row2][col];
        if (v2 === prev2) {
          length2++;
        } else {
          if (length2 >= 5) lost += length2 - 2;
          length2 = 1;
          prev2 = v2;
        }
      }
      if (length2 >= 5) lost += length2 - 2;
    }

    // Rule 2: 2x2 blocks of the same colour.
    for (var r = 0; r < n - 1; r++) {
      for (var c = 0; c < n - 1; c++) {
        var tl = modules[r][c], tr = modules[r][c + 1], bl = modules[r + 1][c], br = modules[r + 1][c + 1];
        if (tl === tr && tl === bl && tl === br) lost += 3;
      }
    }

    // Rule 3: finder-like 1:1:3:1:1 patterns with 4-module light run.
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = [false, false, false, false, true, false, true, true, true, false, true];
    for (var row3 = 0; row3 < n; row3++) {
      for (var col3 = 0; col3 <= n - 11; col3++) {
        if (matchesPattern(modules[row3], col3, pat1) || matchesPattern(modules[row3], col3, pat2)) {
          lost += 40;
        }
      }
    }
    for (var col4 = 0; col4 < n; col4++) {
      for (var row4 = 0; row4 <= n - 11; row4++) {
        var colSeq = [];
        for (var k = 0; k < 11; k++) colSeq.push(modules[row4 + k][col4]);
        if (matchesPattern(colSeq, 0, pat1) || matchesPattern(colSeq, 0, pat2)) {
          lost += 40;
        }
      }
    }

    // Rule 4: overall dark-module ratio vs 50%.
    var dark = 0;
    for (var ri = 0; ri < n; ri++) for (var ci = 0; ci < n; ci++) if (modules[ri][ci]) dark++;
    var ratio = (dark / (n * n)) * 100;
    lost += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return lost;
  }

  function matchesPattern(arr, offset, pattern) {
    for (var i = 0; i < pattern.length; i++) {
      if (!!arr[offset + i] !== pattern[i]) return false;
    }
    return true;
  }

  /* ───────────────────────── Data -> codewords ───────────────────────── */

  function createData(version, ecLevel, bytes) {
    var buffer = new QRBitBuffer();
    buffer.put(MODE_8BIT_BYTE, 4);
    buffer.put(bytes.length, lengthInBits(version));
    for (var i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8);

    var blocks = rsBlocks(version, ecLevel);
    var bitLimit = 0;
    for (var b = 0; b < blocks.length; b++) bitLimit += blocks[b].dataCount * 8;

    if (buffer.length > bitLimit) {
      throw new Error("Data too long for QR version " + version);
    }

    for (var t = 0; t < 4 && buffer.length < bitLimit; t++) buffer.putBit(false);

    while (buffer.length % 8 !== 0) buffer.putBit(false);

    var padToggle = 0;
    while (buffer.length < bitLimit) {
      buffer.put(padToggle % 2 === 0 ? 0xec : 0x11, 8);
      padToggle++;
    }

    return createBytes(buffer, blocks);
  }

  function createBytes(buffer, blocks) {
    var offset = 0;
    var maxDc = 0, maxEc = 0;
    var dcdata = [], ecdata = [];

    for (var bi = 0; bi < blocks.length; bi++) {
      var dcCount = blocks[bi].dataCount;
      var ecCount = blocks[bi].totalCount - dcCount;
      maxDc = Math.max(maxDc, dcCount);
      maxEc = Math.max(maxEc, ecCount);

      var dc = [];
      for (var i = 0; i < dcCount; i++) dc.push(buffer.buffer[i + offset] & 0xff);
      offset += dcCount;

      var rsPoly = new QRPolynomial([1], 0);
      for (var e = 0; e < ecCount; e++) {
        rsPoly = rsPoly.multiply(new QRPolynomial([1, gexp(e)], 0));
      }

      var rawPoly = new QRPolynomial(dc, rsPoly.getLength() - 1);
      var modPoly = rawPoly.mod(rsPoly);

      var ec = [];
      var modOffset = modPoly.getLength() - ecCount;
      for (var j = 0; j < ecCount; j++) {
        var idx = j + modOffset;
        ec.push(idx >= 0 ? modPoly.get(idx) : 0);
      }

      dcdata.push(dc);
      ecdata.push(ec);
    }

    var result = [];
    for (var di = 0; di < maxDc; di++) {
      for (var dj = 0; dj < dcdata.length; dj++) {
        if (di < dcdata[dj].length) result.push(dcdata[dj][di]);
      }
    }
    for (var ei = 0; ei < maxEc; ei++) {
      for (var ej = 0; ej < ecdata.length; ej++) {
        if (ei < ecdata[ej].length) result.push(ecdata[ej][ei]);
      }
    }
    return result;
  }

  /* ───────────────────────── Module matrix construction ───────────────────────── */

  function QRCodeModel(version, ecLevel) {
    this.version = version;
    this.ecLevel = ecLevel;
    this.modulesCount = version * 4 + 17;
    this.modules = [];
    for (var i = 0; i < this.modulesCount; i++) this.modules.push(new Array(this.modulesCount).fill(null));
  }

  QRCodeModel.prototype.setupProbePattern = function (row, col) {
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.modulesCount <= row + r) continue;
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.modulesCount <= col + c) continue;
        var dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        this.modules[row + r][col + c] = dark;
      }
    }
  };

  QRCodeModel.prototype.setupTimingPattern = function () {
    for (var r = 8; r < this.modulesCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (var c = 8; c < this.modulesCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  };

  QRCodeModel.prototype.setupPositionAdjustPattern = function () {
    var pos = PATTERN_POSITION_TABLE[this.version - 1];
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var row = pos[i], col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            var dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
            this.modules[row + r][col + c] = dark;
          }
        }
      }
    }
  };

  QRCodeModel.prototype.setupTypeNumber = function (test) {
    var bits = bchTypeNumber(this.version);
    for (var i = 0; i < 18; i++) {
      var mod = !test && ((bits >>> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.modulesCount - 8 - 3] = mod;
    }
    for (var i2 = 0; i2 < 18; i2++) {
      var mod2 = !test && ((bits >>> i2) & 1) === 1;
      this.modules[(i2 % 3) + this.modulesCount - 8 - 3][Math.floor(i2 / 3)] = mod2;
    }
  };

  QRCodeModel.prototype.setupTypeInfo = function (test, maskPattern) {
    var data = (this.ecLevel << 3) | maskPattern;
    var bits = bchTypeInfo(data);

    for (var i = 0; i < 15; i++) {
      var mod = !test && ((bits >>> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.modulesCount - 15 + i][8] = mod;
    }
    for (var j = 0; j < 15; j++) {
      var modJ = !test && ((bits >>> j) & 1) === 1;
      if (j < 8) this.modules[8][this.modulesCount - j - 1] = modJ;
      else if (j < 9) this.modules[8][15 - j - 1 + 1] = modJ;
      else this.modules[8][15 - j - 1] = modJ;
    }
    this.modules[this.modulesCount - 8][8] = !test;
  };

  QRCodeModel.prototype.mapData = function (data, maskPattern) {
    var inc = -1;
    var row = this.modulesCount - 1;
    var bitIndex = 7;
    var byteIndex = 0;

    for (var colBase = this.modulesCount - 1; colBase > 0; colBase -= 2) {
      var col = colBase <= 6 ? colBase - 1 : colBase;
      while (true) {
        for (var cc = 0; cc < 2; cc++) {
          var c = col - cc;
          if (this.modules[row][c] === null) {
            var dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (getMask(maskPattern, row, c)) dark = !dark;
            this.modules[row][c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.modulesCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  };

  QRCodeModel.prototype.build = function (bytes, maskPattern, test) {
    this.setupProbePattern(0, 0);
    this.setupProbePattern(this.modulesCount - 7, 0);
    this.setupProbePattern(0, this.modulesCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(!!test, maskPattern);
    if (this.version >= 7) this.setupTypeNumber(!!test);
    this.mapData(bytes, maskPattern);
  };

  /* ───────────────────────── Top-level encode ───────────────────────── */

  function pickVersion(byteLength, ecLevel) {
    for (var version = 1; version <= 40; version++) {
      var blocks = rsBlocks(version, ecLevel);
      var dataCapacityBits = 0;
      for (var b = 0; b < blocks.length; b++) dataCapacityBits += blocks[b].dataCount * 8;
      var headerBits = 4 + lengthInBits(version);
      var neededBits = headerBits + byteLength * 8;
      if (neededBits <= dataCapacityBits) return version;
    }
    return null; // too long even at version 40
  }

  function encode(text, ecLevel) {
    var bytes = utf8Bytes(text);
    var version = pickVersion(bytes.length, ecLevel);
    if (version === null) throw new Error("Text too long to encode as a QR code");

    var dataCodewords = createData(version, ecLevel, bytes);

    var bestPattern = 0, bestScore = null;
    for (var pattern = 0; pattern < 8; pattern++) {
      var testModel = new QRCodeModel(version, ecLevel);
      testModel.build(dataCodewords, pattern, true);
      var score = lostPoint(testModel.modules);
      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    var finalModel = new QRCodeModel(version, ecLevel);
    finalModel.build(dataCodewords, bestPattern, false);
    return finalModel;
  }

  /* ───────────────────────── SVG rendering ───────────────────────── */

  function generateSvg(text, opts) {
    opts = opts || {};
    var ecLevel = EC_LEVEL[(opts.ecLevel || "M").toUpperCase()];
    if (ecLevel === undefined) ecLevel = EC_LEVEL.M;
    var cellSize = opts.cellSize || 4;
    var margin = opts.margin != null ? opts.margin : cellSize * 4;

    var model = encode(text, ecLevel);
    var n = model.modulesCount;
    var size = n * cellSize + margin * 2;

    var rects = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (model.modules[r][c]) {
          rects.push(
            '<rect x="' + (margin + c * cellSize) + '" y="' + (margin + r * cellSize) +
            '" width="' + cellSize + '" height="' + cellSize + '"/>'
          );
        }
      }
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
      '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
      '<g fill="#000000">' + rects.join("") + "</g>" +
      "</svg>"
    );
  }

  global.QRCodeGen = { generateSvg: generateSvg };
})(window);
