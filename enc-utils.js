/****************************************************
*  UTF-8/UTF-16/UTF-32 and Base64 encoding utility  *
*  Copyright (c) 2015 Witold Sieraczyński           *
*  https://cerosrhino.github.io/js-enc-utils/       *
****************************************************/

(function () {
  'use strict';
  
  var EncUtils,
      UTF16_CODE_POINT = /[\ud800-\udbff][\udc00-\udfff]/g,
      UTF16_HIGH = /[\ud800-\udbff]([^\udc00-\udfff]|$)/,
      UTF16_LOW = /(^|[^\ud800-\udbff])[\udc00-\udfff]/;
  
  function strToUTF16(str, littleEndian) {
    if (typeof str !== 'string') {
      throw new TypeError('Not a string');
    }
    
    if (UTF16_HIGH.test(str)) {
      UTF16_HIGH.lastIndex = 0;
      throw new Error('UTF-16 high surrogate not followed by low surrogate');
    } else if (UTF16_LOW.test(str)) {
      UTF16_LOW.lastIndex = 0;
      throw new Error('UTF-16 low surrogate not preceded by high surrogate');
    }
    
    var buf = new ArrayBuffer(str.length * 2),
        bytes = new Uint8Array(buf),
        view = new DataView(buf);
    
    [].forEach.call(str, function (el, i) {
      view.setUint16(i * 2, el.charCodeAt(0), littleEndian === true);
    });
    
    return bytes;
  }
  
  function utf16ToStr(bytes, littleEndian) {
    if (bytes.length % 2 !== 0) {
      throw new Error('Incorrect number of bytes supplied');
    }
    
    var buf = new ArrayBuffer(bytes.length),
        view = new DataView(buf);
    [].forEach.call(new Uint8Array(bytes), function (el, i) {
      view.setUint8(i, el);
    });
    
    var str = [].reduce.call(new Uint16Array(buf), function (prev, cur, i) {
      return prev + String.fromCharCode(view.getUint16(i * 2,
                                                       littleEndian === true));
    }, '');
    
    if (UTF16_HIGH.test(str)) {
      UTF16_HIGH.lastIndex = 0;
      throw new Error('UTF-16 high surrogate not followed by low surrogate');
    } else if (UTF16_LOW.test(str)) {
      UTF16_LOW.lastIndex = 0;
      throw new Error('UTF-16 low surrogate not preceded by high surrogate');
    }
    
    return str;
  }
  
  function strToUTF32(str, littleEndian) {
    if (typeof str !== 'string') {
      throw new TypeError('Not a string');
    }
    
    var buf = new ArrayBuffer(str.replace(UTF16_CODE_POINT, ' ').length * 4),
        bytes = new Uint8Array(buf),
        view = new DataView(buf);
    
    for (var i = 0, j = 0; i < str.length; i++, j++) {
      var code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        if (i < str.length - 1) {
          var nextCode = str.charCodeAt(i + 1);
          if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
            code = ((code - 0xd800) << 10) + nextCode - 0xdc00 + 0x10000;
            i++;
          } else {
            throw new Error('UTF-16 high surrogate ' +
                            'not followed by low surrogate');
          }
        } else {
          throw new Error('UTF-16 high surrogate ' +
                          'not followed by low surrogate');
        }
      }
      view.setUint32(j * 4, code, littleEndian === true);
    }
    
    return bytes;
  }
  
  function utf32ToStr(bytes, littleEndian) {
    if (bytes.length % 4 !== 0) {
      throw new Error('Incorrect number of bytes supplied');
    }
    
    var buf = new ArrayBuffer(bytes.length),
        view = new DataView(buf);
    [].forEach.call(new Uint8Array(bytes), function (el, i) {
      view.setUint8(i, el);
    });
    
    return [].reduce.call(new Uint32Array(buf), function (prev, cur, i) {
      var code = view.getUint32(i * 4, littleEndian === true),
          str;
      
      if (code <= 0xffff) {
        if (code >= 0xd800 && code <= 0xdfff) {
          throw new Error('Found code point ' +
                          'reserved by UTF-16 for surrogate pairs');
        }
        str = String.fromCharCode(code);
      } else if (code > 0x10ffff) {
        throw new RangeError('Code point exceeds allowed limit (U+10FFFF)');
      } else {
        code -= 0x10000;
        str = String.fromCharCode(0xd800 + (code >> 10),
                                  0xdc00 + (code & 0x03ff));
      }
      return prev + str;
    }, '');
  }
  
  EncUtils = {
    strToUTF8: function (str) {
      if (typeof str !== 'string') {
        throw new TypeError('Not a string');
      }
      
      try {
        return new Uint8Array(
            [].map.call(
                encodeURI(str).replace(
                    /%([0-9a-f]{2})/gi,
                    function (match, m1) {
                      return String.fromCharCode(parseInt(m1, 16));
                    }),
                function (el) {
                  return el.charCodeAt(0);
                }));
      } catch (e) {
        throw new Error('No matching pair found for UTF-16 surrogate');
      }
    },
    utf8ToStr: function (bytes) {
      try {
        return decodeURI([].reduce.call(
            new Uint8Array(bytes),
            function (prev, cur) {
              return prev + '%' + cur.toString(16);
            }, ''));
      } catch (e) {
        throw new Error('Invalid UTF-8 sequence');
      }
    },
    strToUTF16BE: function (str) {
      return strToUTF16(str, false);
    },
    utf16BEToStr: function (bytes) {
      return utf16ToStr(bytes);
    },
    strToUTF16LE: function (str) {
      return strToUTF16(str, true);
    },
    utf16LEToStr: function (bytes) {
      return utf16ToStr(bytes, true);
    },
    strToUTF32BE: function (str) {
      return strToUTF32(str);
    },
    utf32BEToStr: function (bytes) {
      return utf32ToStr(bytes);
    },
    strToUTF32LE: function (str) {
      return strToUTF32(str, true);
    },
    utf32LEToStr: function (bytes) {
      return utf32ToStr(bytes, true);
    },
    bytesToBase64: function (bytes) {
      return btoa([].reduce.call(
          new Uint8Array(bytes),
          function (prev, cur) {
            return prev + String.fromCharCode(cur);
          }, ''));
    },
    base64ToBytes: function (str) {
      if (typeof str !== 'string') {
        throw new TypeError('Not a string');
      }
      
      return new Uint8Array([].map.call(atob(str), function (el) {
        return el.charCodeAt(0);
      }));
    }
  };
  
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = EncUtils;
  } else {
    window.EncUtils = EncUtils;
  }
}());
