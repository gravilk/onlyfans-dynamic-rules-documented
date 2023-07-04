const types = require("@babel/types")
const generate = require("@babel/generator").default
const traverse = require("@babel/traverse").default
const fs = require("fs")
const babel = require("@babel/core")

let file = fs.readFileSync("obfuscated2.js", "utf-8")

const ast = babel.parseSync(file)

let long_list;
let control_value;
let to_evaluate;
let shuffle_offset;
let decryption_offset;

// decryption function for the strings
function decrypt(W, n) {
    const t = long_list;
    return e = function (n, o) {
      n -= decryption_offset;
      let c = t[n];
      if (void 0 === e['jCUVaC']) {
        var d = function (W) {
          const n = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
          let t = '',
          o = '';
          for (let c, d, r = 0, u = 0; d = W['charAt'](u++); ~d && (c = r % 4 ? 64 * c + d : d, r++ % 4) ? t += String['fromCharCode'](255 & c >> ( - 2 * r & 6)) : 0) d = n['indexOf'](d);
          for (let c = 0, d = t['length']; c < d; c++) o += '%' + ('00' + t['charCodeAt'](c) ['toString'](16)) ['slice']( - 2);
          return decodeURIComponent(o)
        };
        const n = function (W, n) {
          let t,
          o,
          c = [
          ],
          r = 0,
          u = '';
          for (W = d(W), o = 0; o < 256; o++) c[o] = o;
          for (o = 0; o < 256; o++) r = (r + c[o] + n['charCodeAt'](o % n['length'])) % 256,
          t = c[o],
          c[o] = c[r],
          c[r] = t;
          o = 0,
          r = 0;
          for (let d = 0; d < W['length']; d++) o = (o + 1) % 256,
          r = (r + c[o]) % 256,
          t = c[o],
          c[o] = c[r],
          c[r] = t,
          u += String['fromCharCode'](W['charCodeAt'](d) ^ c[(c[o] + c[r]) % 256]);
          return u
        };
        e['FUIxLT'] = n,
        W = arguments,
        e['jCUVaC'] = !0
      }
      const r = t[0],
      u = n + r,
      k = W[u];
      return k ? c = k : (void 0 === e['TZeHWD'] && (e['TZeHWD'] = !0), c = e['FUIxLT'](c, o), W[u] = c),
      c
    },
    e(W, n)
  }

traverse(ast, {
    // get control value required to unshuffle the large string list
    CallExpression(path) {
        if (path.node.arguments[1]?.type === "NumericLiteral") {
            if (path.node.arguments[1].value > 10000) {
                control_value = path.node.arguments[1].value
            }
        }
    },
    // get large string list
    ArrayExpression(path) {
        if (path.node.elements.length > 10) {
            long_list = eval(generate(path.node).code)
        }
    },
    // get main decryption function to get the main offset
    AssignmentExpression(path) {
        if (path.node.operator === "-=") {
            decryption_offset = path.node.right.value
        }
    }
})

// this specifically gets the offset for the reshuffle function. this could be done below along with all the other offsets but i chose not to do that.
traverse(ast, {
    CallExpression(path) {
        if (path.node.callee.name === "parseInt") {
            to_evaluate = generate(path.getStatementParent().node.declarations[0].init).code.replaceAll(/parseInt\((.+?)\(/g, "parseInt(get_value(")
            path.getFunctionParent().traverse({
                FunctionDeclaration(inner) {
                    let offset = generate(inner.node.body.body[0].argument.arguments[0]).code
                    let num = parseInt(offset.match(/\d+/)[0])
                    if (offset.match(/\-/g).length == 1) {
                        offset = -num
                    } else {
                        offset = num
                    }
                    shuffle_offset = offset
                }
            })
        }
    }
})

// get string. only for the shuffle part of the process. the other offsets are managed in the function getValueWithOffset
function get_value(a, b) {
    let nFirst = numbersFirst([a, b])
    return decrypt(nFirst[0] + shuffle_offset, nFirst[1])
}

console.log(long_list)
// do reshuffle
while (true) {
    try {
        let evaled = eval(to_evaluate)
        if (evaled === control_value) break;
        long_list.push(long_list.shift())
    } catch (e) {
        long_list.push(long_list.shift())
    }
}


let offset_table = {}

// save all offsets along with their names to an object while also respecting their parent offsets.
// if you don't understand what that means please read into how the different getter functions relate to eachother (in the example script file)
traverse(ast, {
    FunctionDeclaration(path) {
        if (path.node.body.body[0].type === "ReturnStatement") {
            let arg = path.node.body.body[0].argument
            let parent_offset = arg.callee.name
            let offset_name = path.node.id.name
            let correct_arg = arg.arguments.filter(a=>a.type !== "Identifier")[0]
            let offset = generate(correct_arg).code
            let num = parseInt(offset.match(/\d+/)[0])
            if (offset.match(/\-/g).length == 1) {
                offset = -num
            } else {
                offset = num
            }
            offset_table[offset_name] = offset_table[parent_offset] ? offset_table[parent_offset] + offset : offset
        }
    }
})

// sort the arguments so that the number always comes first
function numbersFirst(val) {
    return val.sort(function(a, b) {
        if (typeof a === typeof b) {
          if (typeof a === "number") {
            return a - b;
          } else {
            return a.localeCompare(b);
          }
        } else {
          return typeof a === "number" ? -1 : 1;
        }
      })
}

function getValueWithOffset(integer, string, offset) {
    return decrypt(integer + offset, string)
}


// replace every getter call with the actual string
traverse(ast, {
    CallExpression(path) {
        let name = path.node.callee.name
        if (Object.keys(offset_table).includes(name)) {
            if (path.node.arguments.length == 2 && path.node.arguments[0].value != undefined) {
                let values = numbersFirst(path.node.arguments.map(v=>v.value ? v.value : -v.argument.value))
                path.replaceWith(types.stringLiteral(getValueWithOffset(values[0], values[1], offset_table[name])))
            }
        }
    }
})

let operator_functions = {}

// below is the collection of the names of operator functions (short functions that eg. add two numbers together)
traverse(ast, {
    ObjectExpression(path) {
        if (path.node.properties.length > 10) {
            for (_property of path.node.properties) {
                if (_property.value.type === "StringLiteral") {
                    operator_functions[_property.key.name] = `LITERAL_${_property.value.value}`
                } else if (_property.value.type === "FunctionExpression") {
                    let arg = _property.value.body.body[0].argument
                    if (arg.type === "BinaryExpression") {
                        operator_functions[_property.key.name] = `OPERATION_${arg.operator}`
                    } else {
                        operator_functions[_property.key.name] = `OPERATION_CALL`
                    }
                }
            }
        }
    }
})

traverse(ast, {
    CallExpression(path) {
        if (path.node.callee.type === "MemberExpression") {
            let prop_name = path.node.callee.property.value
            if (Object.keys(operator_functions).includes(prop_name)) {
                let opr = operator_functions[prop_name].split("_")
                if (opr[0] === "OPERATION") {
                    if (opr[1].length == 1) {
                        let args = path.node.arguments
                        path.replaceWith(types.binaryExpression(opr[1], args[0], args[1]))
                    }
                }
            }
        }
    }
})

let checksum_indexes = []
let checksum_constant = 0;
let literals = Object.values(operator_functions).filter(f=>f.startsWith("LITERAL")).map(r=>r.split("_")[1])
console.log(literals)
let static_param = literals.filter(l=>l.length == 32)[0]
let start = literals.filter(l=>l.length == 4)[0]
let end;

traverse(ast, {
    ReturnStatement(path) {
        if (path.node.argument.type === "CallExpression") {
            if (path.node.argument.callee.type === "MemberExpression") {
                path.traverse({
                    BinaryExpression(inner) {
                        if (inner.node.right.type === "NumericLiteral") {
                            let val = inner.node.right.value;
                            if (inner.node.operator === "+") {
                                checksum_constant += val;
                            } else {
                                checksum_constant -= val;
                            }
                        } else if (inner.node.left.type === "NumericLiteral") {
                            checksum_indexes.push(inner.node.left.value % 40)
                        }
                    }
                })
            }
        }
    },
    CallExpression(path) {
        if (path.node.callee.type === "MemberExpression") {
            if (path.node.callee.property.value === "join" && path.node.arguments[0].value === ":") {
                let obj = path.node.callee.object.elements.slice(-1)[0]
                if (obj.type === "MemberExpression") {
                    end = literals.filter(l=>l.length == 8)[0]
                } else {
                    end = obj.value
                }
            }
        }
    }
})

checksum_indexes = checksum_indexes.sort()

console.log(static_param)
console.log(start)
console.log(end)
console.log(checksum_constant)
console.log(checksum_indexes)
fs.writeFileSync("deobfuscated.js", generate(ast).code)