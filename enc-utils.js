/****************************************************
*  UTF-8/UTF-16/UTF-32 and Base64 encoding utility  *
*  Copyright (c) 2015 Witold Sieraczyński           *
*  https://cerosrhino.github.io/js-enc-utils/       *
****************************************************/

var EncUtils = (function() {
    var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
        base64Regex = /[^0-9a-z\+\/=]/i,
        utf16HRegex = /[\ud800-\udbff]([^\udc00-\udfff]|$)/,
        utf16LRegex = /(^|[^\ud800-\udbff])[\udc00-\udfff]/;
    
    function strToUTF16(str, littleEndian, array) {
        if (typeof str !== 'string') {
            throw new TypeError('This function accepts only strings as the argument');
        }
        
        if (utf16HRegex.test(str)) {
            utf16HRegex.lastIndex = 0;
            throw new Error('UTF-16 high surrogate not followed by low surrogate');
        } else if (utf16LRegex.test(str)) {
            utf16LRegex.lastIndex = 0;
            throw new Error('Unexpected UTF-16 low surrogate');
        }
        
        var bytes = [];
        
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i),
                high = code >> 8,
                low = code & 0xff;
            
            if (littleEndian === true) {
                bytes.push(low, high);
            } else {
                bytes.push(high, low);
            }
        }
        
        return (array === true) ? bytes : new Uint8Array(bytes);
    }
    
    function utf16ToStr(bytes, littleEndian) {        
        bytes = new Uint8Array(bytes);
        
        if (bytes.length % 2 !== 0) {
            throw new Error('Incorrect number of bytes supplied');
        }
        
        var str = '';
        
        for (var i = 0; i < bytes.length; i += 2) {
            var code;
            if (littleEndian === true) {
                code = (bytes[i + 1] << 8) | bytes[i];
            } else {
                code = (bytes[i] << 8) | bytes[i + 1];
            }
            str += String.fromCharCode(code);
        }
        
        if (utf16HRegex.test(str)) {
            utf16HRegex.lastIndex = 0;
            throw new Error('UTF-16 high surrogate not followed by low surrogate');
        } else if (utf16LRegex.test(str)) {
            utf16LRegex.lastIndex = 0;
            throw new Error('Unexpected UTF-16 low surrogate');
        }
        
        return str;
    }
    
    function strToUTF32(str, littleEndian, array) {
        if (typeof str !== 'string') {
            throw new TypeError('This function accepts only strings as the argument');
        }
        
        var bytes = [];
        
        for (var i = 0; i < str.length; i++) {
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
            if (littleEndian === true) {
                bytes.push(code & 0xff, (code >> 8) & 0xff, code >> 16, 0);
            } else {
                bytes.push(0, code >> 16, (code >> 8) & 0xff, code & 0xff);
            }
        }
        
        return (array === true) ? bytes : new Uint8Array(bytes);
    }
    
    function utf32ToStr(bytes, littleEndian) {
        bytes = new Uint8Array(bytes);
        
        if (bytes.length % 4 !== 0) {
            throw new Error('Incorrect number of bytes supplied');
        }
        
        var str = '';
        
        for (var i = 0; i < bytes.length; i += 4) {
            var code;
            if (littleEndian === true) {
                if (bytes[i + 3] !== 0) {
                    throw new Error('Invalid UTF-32 sequence');
                }
                code = (bytes[i + 2] << 16) | (bytes[i + 1] << 8) | bytes[i];
            } else {
                if (bytes[i] !== 0) {
                    throw new Error('Invalid UTF-32 sequence');
                }
                code = (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
            }
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
        
        return str;
    }
    
    return {
        strToUTF8: function(str, array) {
            if (typeof str !== 'string') {
                throw new TypeError('This function accepts only strings as the argument');
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
            
            return (array === true) ? bytes : new Uint8Array(bytes);
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
        strToUTF16BE: function(str, array) {
            return strToUTF16(str, false, array);
        },
        utf16BEToStr: function(bytes) {
            return utf16ToStr(bytes);
        },
        strToUTF16LE: function(str, array) {
            return strToUTF16(str, true, array);
        },
        utf16LEToStr: function(bytes) {
            return utf16ToStr(bytes, true);
        },
        strToUTF32BE: function(str, array) {
            return strToUTF32(str, false, array);
        },
        utf32BEToStr: function (bytes) {
            return utf32ToStr(bytes);
        },
        strToUTF32LE: function(str, array) {
            return strToUTF32(str, true, array);
        },
        utf32LEToStr: function(bytes) {
            return utf32ToStr(bytes, true);
        },
        bytesToBase64: function(bytes) {
            bytes = new Uint8Array(bytes);
            
            var str = '';
            
            for (var i = 0; i < bytes.length; i += 3) {
                var b64;
                if (bytes.length - i === 1) {
                    b64 = [
                        (bytes[i] & 0xfc) >> 2,
                        (bytes[i] & 0x03) << 4
                    ];
                } else if (bytes.length - i === 2) {
                    b64 = [
                        (bytes[i] & 0xfc) >> 2,
                        ((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4),
                        (bytes[i + 1] & 0x0f) << 2
                    ];
                } else {
                    b64 = [
                        (bytes[i] & 0xfc) >> 2,
                        ((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4),
                        ((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6),
                        bytes[i + 2] & 0x3f
                    ];
                }
                
                for (var j = 0; j < b64.length; j++) {
                    str += base64Chars.charAt(b64[j]);
                }
                
                if (b64.length === 2) {
                    str += '==';
                } else if (b64.length === 3) {
                    str += '=';
                }
            }
            
            return str;
        },
        base64ToBytes: function(str, array) {
            if (typeof str !== 'string') {
                throw new TypeError('This function accepts only strings as the argument');
            }
            
            if (str.length % 4 !== 0) {
                throw new Error('The length of the string argument must be divisible by four');
            }
            
            if (base64Regex.test(str)) {
                base64Regex.lastIndex = 0;
                throw new Error('Illegal character found');
            }
            
            var bytes = [];
            
            for (var i = 0; i < str.length; i += 4) {
                var outputBytes,
                b64 = [];
                
                for (var j = i; j < i + 4; j++) {
                    b64.push(base64Chars.indexOf(str.charAt(j)));
                }
                
                if (b64[0] === 64 || b64[1] === 64) {
                    throw new Error('The "=" character cannot appear as first or second in a Base64 sequence');
                }
                
                if (b64[3] === 64) {
                    if (b64[2] === 64) {
                        outputBytes = [
                            (b64[0] << 2) | (b64[1] >> 4)
                        ];
                    } else {
                        outputBytes = [
                            (b64[0] << 2) | (b64[1] >> 4),
                            ((b64[1] & 0x0f) << 4) | (b64[2] >> 2)
                        ];
                    }
                } else {
                    outputBytes = [
                        (b64[0] << 2) | ((b64[1] & 0x30) >> 4),
                        ((b64[1] & 0x0f) << 4) | ((b64[2] & 0x3c) >> 2),
                        ((b64[2] & 0x03) << 6) | b64[3]
                    ];
                }
                
                bytes = bytes.concat(outputBytes);
            }
            
            return (array === true) ? bytes : new Uint8Array(bytes);
        }
    };
})();