/****************************************************
*  UTF-8/UTF-16/UTF-32 and Base64 encoding utility  *
*  Copyright (c) 2015 Witold Sieraczyński           *
*  https://cerosrhino.github.io/js-enc-utils/       *
****************************************************/

(function() {
    'use strict';
    
    var EncUtils,
        utf16CodePoint = /[\ud800-\udbff][\udc00-\udfff]/g,
        utf16High = /[\ud800-\udbff]([^\udc00-\udfff]|$)/,
        utf16Low = /(^|[^\ud800-\udbff])[\udc00-\udfff]/;
    
    function strToUTF16(str, littleEndian) {
        if (typeof str !== 'string') {
            throw new TypeError('Not a string');
        }
        
        if (utf16High.test(str)) {
            utf16High.lastIndex = 0;
            throw new Error('UTF-16 high surrogate not followed by low surrogate');
        } else if (utf16Low.test(str)) {
            utf16Low.lastIndex = 0;
            throw new Error('UTF-16 low surrogate not preceded by high surrogate');
        }
        
        var buf = new ArrayBuffer(str.length * 2),
            bytes = new Uint8Array(buf),
            view = new DataView(buf);
        
        [].forEach.call(str, function(el, i) {
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
        [].forEach.call(new Uint8Array(bytes), function(el, i) {
            view.setUint8(i, el);
        });
        
        var str = [].reduce.call(new Uint16Array(buf), function(prev, cur, i) {
            return prev + String.fromCharCode(view.getUint16(i * 2, littleEndian === true));
        }, '');
        
        if (utf16High.test(str)) {
            utf16High.lastIndex = 0;
            throw new Error('UTF-16 high surrogate not followed by low surrogate');
        } else if (utf16Low.test(str)) {
            utf16Low.lastIndex = 0;
            throw new Error('Unexpected UTF-16 low surrogate');
        }
        
        return str;
    }
    
    function strToUTF32(str, littleEndian) {
        if (typeof str !== 'string') {
            throw new TypeError('Not a string');
        }
        
        var buf = new ArrayBuffer(str.replace(utf16CodePoint, ' ').length * 4),
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
                        throw new Error('UTF-16 high surrogate not followed by low surrogate');
                    }
                } else {
                    throw new Error('UTF-16 high surrogate not followed by low surrogate');
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
        [].forEach.call(new Uint8Array(bytes), function(el, i) {
            view.setUint8(i, el);
        });
        
        return [].reduce.call(new Uint32Array(buf), function(prev, cur, i) {
            var code = view.getUint32(i * 4, littleEndian === true),
                str;
            
            if (code <= 0xffff) {
                if (code >= 0xd800 && code <= 0xdfff) {
                    throw new Error('Found code point reserved by UTF-16 for surrogate pairs');
                }
                str = String.fromCharCode(code);
            } else if (code > 0x10ffff) {
                throw new RangeError('Code point exceeds allowed limit (U+10FFFF)');
            } else {
                code -= 0x10000;
                str = String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x03ff));
            }
            return prev + str;
        }, '');
    }
    
    EncUtils = {
        strToUTF8: function(str) {
            if (typeof str !== 'string') {
                throw new TypeError('Not a string');
            }
            
            var bytes = [];
            
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                if (code <= 0x7f) {
                    bytes.push(code);
                } else {
                    if (code >= 0xd800 && code <= 0xdbff) {
                        if (i < str.length - 1) {
                            var nextCode = str.charCodeAt(i + 1);
                            if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
                                code = ((code - 0xd800) << 10) + nextCode - 0xdc00 + 0x10000;
                                i++;
                            } else {
                                throw new Error('UTF-16 high surrogate not followed by low surrogate');
                            }
                        } else {
                            throw new Error('UTF-16 high surrogate not followed by low surrogate');
                        }
                    } else if (code >= 0xdc00 && code <= 0xdfff) {
                        throw new Error('Unexpected UTF-16 low surrogate');
                    }
                    
                    var length;
                    if (code <= 0x07ff) {
                        bytes.push(0xc0 | (code >> 6));
                        length = 2;
                    } else if (code <= 0xffff) {
                        bytes.push(0xe0 | (code >> 12));
                        length = 3;
                    } else if (code <= 0x10ffff) {
                        bytes.push(0xf0 | (code >> 18));
                        length = 4;
                    } else {
                        throw new RangeError('Code point exceeds allowed limit (U+10FFFF)');
                    }
                    
                    for (var j = 0; j < length - 1; j++) {
                        bytes.push(0x80 | ((code >> ((length - 2 - j) * 6)) & 0x3f));
                    }
                }
            }
            
            return new Uint8Array(bytes);
        },
        utf8ToStr: function(bytes) {
            bytes = new Uint8Array(bytes);
            
            var str = '',
                code,
                count = 0,
                overlongCheck;
            
            for (var i = 0; i < bytes.length; i++) {
                if (count === 0) {
                    if (bytes[i] <= 0x7f) {
                        code = bytes[i];
                        count = 0;
                        overlongCheck = 0;
                    } else if ((bytes[i] & 0xf8) === 0xf0 && i < bytes.length - 3) {
                        code = bytes[i] & 0x07;
                        count = 3;
                        if ((bytes[i] & 0x07) === 0)
                            overlongCheck = 0x30;
                    } else if ((bytes[i] & 0xf0) === 0xe0 && i < bytes.length - 2) {
                        code = bytes[i] & 0x0f;
                        count = 2;
                        if ((bytes[i] & 0x0f) === 0)
                            overlongCheck = 0x10;
                    } else if ((bytes[i] & 0xe0) === 0xc0 && (bytes[i] & 0x1e) !== 0 && i < bytes.length - 1) {
                        code = bytes[i] & 0x1f;
                        count = 1;
                        overlongCheck = 0;
                    } else {
                        throw new Error('Invalid UTF-8 sequence');
                    }
                } else if ((bytes[i] & 0xc0) === 0x80) {
                    if (overlongCheck && (bytes[i] & overlongCheck) === 0) {
                        throw new Error('Invalid UTF-8 sequence; possibly overlong encoding used');
                    }
                    
                    code = (code << 6) | (bytes[i] & 0x3f);
                    count--;
                    overlongCheck = 0;
                } else {
                    throw new Error('Invalid UTF-8 sequence');
                }
                
                if (count === 0) {
                    if (code <= 0xffff) {
                        if (code >= 0xd800 && code <= 0xdfff) {
                            throw new Error('Found code point reserved by UTF-16 for surrogate pairs');
                        }
                        str += String.fromCharCode(code);
                    } else if (code > 0x10ffff) {
                        throw new RangeError('Code point exceeds allowed limit (U+10FFFF)');
                    } else {
                        code -= 0x10000;
                        str += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x03ff));
                    }
                }
            }
            
            return str;
        },
        strToUTF16BE: function(str) {
            return strToUTF16(str, false);
        },
        utf16BEToStr: function(bytes) {
            return utf16ToStr(bytes);
        },
        strToUTF16LE: function(str) {
            return strToUTF16(str, true);
        },
        utf16LEToStr: function(bytes) {
            return utf16ToStr(bytes, true);
        },
        strToUTF32BE: function(str) {
            return strToUTF32(str);
        },
        utf32BEToStr: function(bytes) {
            return utf32ToStr(bytes);
        },
        strToUTF32LE: function(str) {
            return strToUTF32(str, true);
        },
        utf32LEToStr: function(bytes) {
            return utf32ToStr(bytes, true);
        },
        bytesToBase64: function(bytes) {
            return btoa([].reduce.call(new Uint8Array(bytes), function(prev, cur) {
                return prev + String.fromCharCode(cur);
            }, ''));
        },
        base64ToBytes: function(str) {
            if (typeof str !== 'string') {
                throw new TypeError('Not a string');
            }
            
            return new Uint8Array([].map.call(atob(str), function(el) {
                return el.charCodeAt(0);
            }));
        }
    };
    
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = EncUtils;
    } else {
        window.EncUtils = EncUtils;
    }
})();
