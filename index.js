const types = require("@babel/types")
const generate = require("@babel/generator").default
const traverse = require("@babel/traverse").default
const fs = require("fs")
const babel = require("@babel/core")

let file = fs.readFileSync("obfuscated.js", "utf-8")

const ast = babel.parseSync(file)

let decryptFunc;
let reshuffleStatement;

let shuffledList;
let controlNumber;
let shuffleOffset;

// get string. only for the shuffle part of the process. the other offsets are managed in the function getValueWithOffset
function get_value(a, b) {
    let nFirst = numbersFirst([a, b])

    return decrypt(nFirst[0] + shuffleOffset, nFirst[1])
}

function getValueWithOffset(integer, string, offset) {
    return decrypt(integer + offset, string)
}

// sort the arguments so that the number always comes first
function numbersFirst(args) {
    return args.sort(function (a, b) {
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

function decrypt(a, b) {
    return eval(decryptFunc + `(${a}, '${b}')`)
}

function reshuffle() {
    while (true) {
        try {
            if (eval(reshuffleStatement) === controlNumber) {
                return;
            }

            shuffledList.push(shuffledList.shift())
        } catch (e) {
            shuffledList.push(shuffledList.shift())
        }
    }
}

traverse(ast, {
    // get control value required to unshuffle the large string list
    CallExpression(path) {
        if (path.node.arguments[1]?.type === "NumericLiteral") {
            if (path.node.arguments[1].value > 10000) {
                controlNumber = path.node.arguments[1].value
                path.stop()
            }
        }
    },
})

traverse(ast, {
    // get large string list
    ArrayExpression(path) {
        if (path.node.elements.length > 10) {
            shuffledList = eval(generate(path.node).code)
        }
    }
})

traverse(ast, {
    // get decrypt function
    FunctionDeclaration(path) {
        if (path.node.params.length === 2 && path.node.body.body.length === 2) {
            path.traverse({
                VariableDeclarator(innerPath) {
                    innerPath.traverse({
                        CallExpression(innerPath) {
                            innerPath.replaceWithSourceString(`shuffledList`)
                        }
                    })
                    innerPath.stop()
                }
            })

            const oldDecryptFunc = path.node

            path.replaceWith(types.functionDeclaration(null, path.node.params, path.node.body)) // anonymous func
            decryptFunc = `(${generate(path.node).code})`
            path.replaceWith(oldDecryptFunc)

            path.stop()
        }
    }
})

// this specifically gets the offset for the reshuffle function. this could be done below along with all the other offsets but i chose not to do that.
traverse(ast, {
    CallExpression(path) {
        if (path.node.callee.name === "parseInt") {
            const ifStatement = path.getStatementParent().node
            reshuffleStatement = generate(ifStatement.test.left).code.replaceAll(/parseInt\((.+?)\(/g, "parseInt(get_value(")

            path.getFunctionParent().traverse({
                FunctionDeclaration(innerPath) {
                    const offsetCode = generate(innerPath.node.body.body[0].argument.arguments[0]).code

                    let offset = parseInt(offsetCode.match(/\d+/)[0])
                    if (offsetCode.match(/-/g).length === 1) {
                        offset = -offset
                    }

                    shuffleOffset = offset
                }
            })

            path.stop()
        }
    }
})

reshuffle()

let offsetTable = {}

// save all offsets along with their names to an object while also respecting their parent offsets.
// if you don't understand what that means please read into how the different getter functions relate to eachother (in the example script file)
traverse(ast, {
    ArrowFunctionExpression(path) {
        path.traverse({
            FunctionDeclaration(innerPath) {
                if (innerPath.node.body.body[0].type === "ReturnStatement") {
                    const argument = innerPath.node.body.body[0].argument
                    const parentOffset = argument.callee.name
                    const offsetName = innerPath.node.id.name
                    const correctArgument = argument.arguments.filter(arg => arg.type !== "Identifier")[0]
                    const offsetCode = generate(correctArgument).code

                    let offset = parseInt(offsetCode.match(/\d+/)[0])
                    if (offsetCode.match(/-/g).length === 1) {
                        offset = -offset
                    }

                    offsetTable[offsetName] = offsetTable[parentOffset]
                        ? offsetTable[parentOffset] + offset
                        : offset
                }
            }
        })
    }
})

// replace every getter call with the actual string
traverse(ast, {
    ArrowFunctionExpression(path) {
        path.traverse({
            CallExpression(path) {
                let name = path.node.callee.name
                if (Object.keys(offsetTable).includes(name)) {
                    if (path.node.arguments.length === 2) {
                        let values = numbersFirst(path.node.arguments.map(argument => {
                            if (argument.type === 'StringLiteral') {
                                return argument.value
                            } else if (argument.type === 'UnaryExpression' || argument.type === 'NumericLiteral') {
                                return parseInt(generate(argument).code)
                            }
                        }))

                        try {
                            path.replaceWith(types.stringLiteral(getValueWithOffset(values[0], values[1], offsetTable[name])))
                        } catch {
                            // don't care about error
                        }
                    }
                }
            }
        })
    }
})

let operatorFunctions = {}

// below is the collection of the names of operator functions (short functions that eg. add two numbers together)
traverse(ast, {
    ObjectExpression(path) {
        if (path.node.properties.length > 10) {
            for (const property of path.node.properties) {
                if (property.value.type === "StringLiteral") {
                    operatorFunctions[property.key.name] = `LITERAL_${property.value.value}`
                } else if (property.value.type === "FunctionExpression") {
                    const argument = property.value.body.body[0].argument
                    if (argument.type === "BinaryExpression") {
                        operatorFunctions[property.key.name] = `OPERATION_${argument.operator}`
                    } else {
                        operatorFunctions[property.key.name] = `OPERATION_CALL`
                    }
                }
            }
        }
    }
})

traverse(ast, {
    CallExpression(path) {
        if (path.node.callee.type === "MemberExpression") {
            let propertyName = path.node.callee.property.value
            if (Object.keys(operatorFunctions).includes(propertyName)) {
                let operatorFunction = operatorFunctions[propertyName].split("_")
                if (operatorFunction[0] === "OPERATION") {
                    if (operatorFunction[1].length === 1) {
                        let args = path.node.arguments
                        path.replaceWith(types.binaryExpression(operatorFunction[1], args[0], args[1]))
                    }
                }
            }
        }
    }
})

let checksumIndexes = []
let checksumConstant = 0;
let literals = Object.values(operatorFunctions)
    .filter(operatorFunction => operatorFunction.startsWith("LITERAL"))
    .map(operatorFunction => operatorFunction.split("_")[1])
let staticParam;
let start;
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
                                checksumConstant += val;
                            } else {
                                checksumConstant -= val;
                            }
                        } else if (inner.node.left.type === "NumericLiteral") {
                            checksumIndexes.push(inner.node.left.value % 40)
                        }
                    }
                })
            }
        }
    },
    CallExpression(path) {
        if (path.node.callee.type === "MemberExpression") {
            if (path.node.callee.property.value === "join") {
                if (path.node.arguments[0].value === ":") {
                    const elements = path.node.callee.object.elements
                    const startElement = elements.slice(0, 1)[0]
                    const endElement = elements.slice(-1)[0]

                    if (startElement.type === 'MemberExpression') {
                        start = literals.filter(literal => literal.length === 5)[0]
                    } else {
                        start = startElement.value
                    }

                    if (endElement.type === "MemberExpression") {
                        end = literals.filter(literal => literal.length === 8)[0]
                    } else {
                        end = endElement.value
                    }
                } else if (path.node.arguments[0].value === "\n") {
                    const elements = path.node.callee.object.elements
                    const staticParamElement = elements.slice(0, 1)[0]

                    if (staticParamElement.type === "MemberExpression") {
                        staticParam = literals.filter(literal => literal.length === 32)[0]
                    } else {
                        staticParam = staticParamElement.value
                    }
                }
            }
        }
    }
})

checksumIndexes.sort((a, b) => a - b) // ascending order

console.log(staticParam)
console.log(start)
console.log(end)
console.log(checksumConstant)
console.log(checksumIndexes)
