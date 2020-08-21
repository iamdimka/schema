import v, { Validator } from "../src";
import assert from "assert";

function check(validator: Validator<any>, test: { schema?: any; ok?: any[], equals?: Array<[any, any]>, err?: any[]; }) {
    if (test.schema) {
        try {
            assert.deepEqual(validator.toJSON(), test.schema, "Schema is not equal");
        } catch (e) {
            console.log(validator.toJSON(), "is not equal to", test.schema);
            assert.fail(e);
        }
    }

    if (Array.isArray(test.ok)) {
        for (const value of test.ok) {
            try {
                assert.deepEqual(validator.validate(value), value);
            } catch (e) {
                console.log(validator.compile().toString());
                console.log(`${JSON.stringify(validator)}: ${JSON.stringify(value)}`);
                assert.fail(e);
            }
        }
    }

    if (Array.isArray(test.equals)) {
        for (const [a, b] of test.equals) {
            try {
                assert.deepEqual(validator.validate(a), b);
            } catch (e) {
                console.log(validator.compile().toString());
                console.log(`${JSON.stringify(validator)}: ${JSON.stringify(a)} is not equal to ${JSON.stringify(b)}`);
                assert.fail(e);
            }
        }
    }

    if (Array.isArray(test.err)) {
        for (const value of test.err) {
            try {
                validator.validate(value);
            } catch (e) {
                continue;
            }

            console.log(validator.schema);
            console.log(validator.compile().toString());
            assert.fail(`Expected error on ${JSON.stringify(value)} : ${JSON.stringify(validator)}`);
        }
    }
}

check(v.boolean(), {
    schema: {
        type: "boolean"
    },
    ok: [true, false],
    err: ["abc", 1, 0, Math.random(), {}, undefined]
});

check(v.boolean().default(true), {
    schema: {
        type: "boolean",
        default: true
    },
    ok: [true, false],
    equals: [
        [undefined, true]
    ],
    err: ["abc", 1, 0, Math.random(), {}]
});

check(v.boolean().optional(), {
    schema: {
        type: "boolean"
    },
    ok: [true, false, undefined],
    err: ["abc", 1, 0, Math.random(), {}]
});

check(v.number(), {
    schema: {
        type: "number"
    },

    ok: [1, 0.3, Math.random(), - 0.5, -500000000, 0, Number.MIN_SAFE_INTEGER, Number.MAX_VALUE],
    err: [true, false, "some", {}, []]
});

check(v.number().exclusiveMinimum(0).exclusiveMaximum(15).multipleOf(0.25), {
    schema: {
        type: "number",
        exclusiveMinimum: 0,
        exclusiveMaximum: 15,
        multipleOf: 0.25
    },

    ok: [1, 14, 2.50, 3.25],
    err: [0, 2.3, -5, 15, 16]
});

check(v.number().minimum(0).maximum(15), {
    schema: {
        type: "number",
        minimum: 0,
        maximum: 15
    },

    ok: [0, 15, Math.random() * 15],
    err: [-1, -5, 15.0000001]
});

check(v.integer(), {
    schema: {
        type: "integer"
    },

    ok: [1, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, Number.MAX_VALUE, Number.MIN_VALUE + 1],
    err: [null, true, false, "string", [], {}, Math.random()]
});

check(v.string(), {
    schema: {
        type: "string"
    },

    ok: ["abc", "asdfjas dflkajsdl fkjasd lfkajsdf", "", `${Math.random()}`],
    err: [null, true, false, 1, 0.3, {}, ["a"]]
});

check(v.string().minLength(3), {
    schema: {
        type: "string",
        minLength: 3
    },

    ok: ["abc", "abcd", "oaasdasdasdfasdfsd"],
    err: ["ac", "", "a"]
});

check(v.string().maxLength(1), {
    schema: {
        type: "string",
        maxLength: 1
    },

    ok: ["a", ""],
    err: ["ba"]
});

check(v.string().pattern("^abc?$"), {
    schema: {
        type: "string",
        pattern: "^abc?$"
    },

    ok: ["ab", "abc"],
    err: ["ba", "abd", "a"]
});

check(v.string().format("alpha"), {
    schema: {
        type: "string",
        format: "alpha"
    },

    ok: ["ab", "abc"],
    err: ["-", "12", "a1"]
});

check(v.string().format("ipv4"), {
    schema: {
        type: "string",
        format: "ipv4"
    },

    ok: ["12.0.0.2"],
    err: ["-", "12", "a1"]
});

check(v.enum(["a", null, { b: 3 }, [1]]), {
    schema: {
        enum: ["a", null, { b: 3 }, [1]]
    },

    ok: [null, "a", { b: 3 }, [1]],
    err: [undefined, "string", true, [2], ["abc", 15, "bc"], [Math.random()]]
});


check(v.binary().minBytes(1).maxBytes(3), {
    schema: {
        type: "binary",
        minBytes: 1,
        maxBytes: 3
    },
    ok: [Buffer.allocUnsafe(2)],
    err: [1, null, Math.random(), []]
});

check(v.array(), {
    schema: {
        type: "array"
    },
    ok: [[], [1, 2, 3]],
    err: [1, null, Math.random()]
});

check(v.array(v.string()), {
    schema: {
        type: "array",
        items: {
            type: "string"
        }
    },
    ok: [["a"], [], ["a", "b"]],
    err: [1, null, Math.random(),  [1, 2, 3]]
});

check(v.array().minItems(1), {
    schema: {
        type: "array",
        minItems: 1
    },
    ok: [[1], [1, 2, 3]],
    err: [1, null, Math.random(), []]
});

check(v.array().maxItems(1), {
    schema: {
        type: "array",
        maxItems: 1
    },
    ok: [[1], []],
    err: [1, null, Math.random(), [2, 3, 5]]
});

check(v.array(v.string()), {
    schema: {
        type: "array",
        items: { type: "string" }
    },
    ok: [["abc"], ["a", "b"], []],
    err: [[1, 2], [true]]
});

check(v.array([v.string(), v.number()]), {
    schema: {
        type: "array",
        items: [
            { type: "string" },
            { type: "number" }
        ]
    },
    ok: [["abc", 1], ["a", Math.random()], ["a", 2, 3]],
    err: [[1, 2], [true, 1, 1]]
});

check(v.array([v.string(), v.number()]).additionalItems(false), {
    schema: {
        type: "array",
        items: [
            { type: "string" },
            { type: "number" }
        ],
        additionalItems: false
    },
    ok: [["abc", 1], ["a", Math.random()], ["a", 2]],
    err: [[1, 2], [true, 1, 1], ["a", 2, 3]]
});

check(v.tuple([v.string(), v.number()]), {
    schema: {
        type: "array",
        items: [
            { type: "string" },
            { type: "number" }
        ],
        additionalItems: false,
        minItems: 2
    },
    ok: [["abc", 1], ["a", Math.random()], ["a", 2]],
    err: [[1, 2], [true, 1, 1], ["a", 2, 3]]
});

check(v.object(), {
    schema: {
        type: "object",
        additionalProperties: false
    },

    ok: [{}, { a: 1 }, { b: 1, c: [1, 2, 3], n: null }],
    err: [null, 1, "", false]
});

check(v.object({
    email: v.string().trim().toLower().match(/^\S+@\S+\.\S+$/)
}), {
    schema: {
        type: "object",
        required: ["email"],
        additionalProperties: false,
        properties: {
            email: {
                type: "string",
                trim: true,
                toLower: true,
                pattern: "^\\S+@\\S+\\.\\S+$"
            }
        }
    },

    ok: [{ email: "dmytro.sushylov@whaleapp.com" }],
    err: [{ email: "abc" }, { email: "abc@dsd" }, { emai: "abc@def.gg" }]
});

check(v.object({
    a: v.number().title("Some a")
}), {
    schema: {
        type: "object",
        properties: {
            a: {
                type: "number",
                title: "Some a"
            }
        },
        required: ["a"],
        additionalProperties: false
    },

    ok: [{ a: 1 }],
    err: [{ a: "string" }, { a: 25, b: 3 }]
});

check(v.raw<number | string>({
    type: ["integer", "string"],
    minimum: 0,
    maxLength: 17
}), {
    schema: {
        type: ["integer", "string"],
        minimum: 0,
        maxLength: 17
    },
    ok: [1, 0, 10, "string", "ololo"],
    err: [-1, "123.123.123.1.23.12.3.1.23.1.23.1.2.3.1.23"]
});

check(v.object({
    a: v.number()
}).additionalProperties(true), {
    schema: {
        type: "object",
        properties: {
            a: { type: "number" }
        },
        required: ["a"],
        additionalProperties: true
    },

    ok: [{ a: 1 }, { a: 1, b: 3 }],
    err: [{ a: "string" }]
});

check(v.object({
    a: v.number().optional()
}).additionalProperties(true), {
    schema: {
        type: "object",
        properties: {
            a: { type: "number" }
        },
        additionalProperties: true
    },

    ok: [{ a: 1 }, { a: 1, b: 3 }],
    err: [{ a: "string" }]
});

check(v.object({
    a: v.number()
}).additionalProperties(true).minProperties(3), {
    schema: {
        type: "object",
        properties: {
            a: { type: "number" }
        },
        required: ["a"],
        minProperties: 3,
        additionalProperties: true
    },

    ok: [{ d: 1, a: 1, b: 3 }],
    err: [{ a: "string" }, { a: 1 }, { b: 2, a: 3 }]
});

check(v.object({
    a: v.number()
}).additionalProperties(true).dependencies({
    b: ["d"],
    x: {
        y: {
            type: "number"
        }
    }
}), {
    schema: {
        type: "object",
        properties: {
            a: { type: "number" }
        },
        required: ["a"],
        dependencies: {
            b: ["d"],
            x: {
                y: {
                    type: "number"
                }
            }
        },
        additionalProperties: true
    },

    ok: [{ d: 1, a: 1, b: 3 }, { a: 15 }, { a: 0, x: 3, y: 0 }],
    err: [{ a: "string" }, { a: 1, b: 2 }, { a: 1, b: 2, c: 3 }, { a: 0, x: 3 }, { a: 0, x: 2, y: "string" }]
});

check(v.object({
    a: v.number(),
    c: v.boolean().default(false)
}).additionalProperties(v.string()), {
    schema: {
        type: "object",
        properties: {
            a: { type: "number" },
            c: {
                type: "boolean",
                default: false
            }
        },
        required: ["a"],
        additionalProperties: {
            type: "string"
        }
    },

    equals: [
        [{ a: 1 }, { a: 1, c: false }],
        [{ a: 1, b: "abcc", x: "xx" }, { a: 1, b: "abcc", x: "xx", c: false }],
    ],
    err: [{ a: "string" }, { a: 1, b: 3 }]
});

check(v.object({
    app: v.integer(),
    title: v.string().minLength(1),
    groups: v.array(
        v.object({
            title: v.string(),
            values: v.object().minProperties(1).additionalProperties(true),
            percent: v.number().exclusiveMinimum(0)
        })
    ).minItems(1),
    start: v.integer(),
    end: v.integer(),
    includeDepositors: v.boolean().optional()
}), {
    schema: {
        type: "object",
        properties: {
            app: {
                type: "integer"
            },
            title: {
                type: "string",
                minLength: 1
            },
            groups: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string"
                        },
                        values: {
                            type: "object",
                            minProperties: 1,
                            additionalProperties: true
                        },
                        percent: {
                            type: "number",
                            exclusiveMinimum: 0
                        }
                    },
                    required: ["title", "values", "percent"],
                    additionalProperties: false
                },
                minItems: 1
            },
            start: {
                type: "integer"
            },
            end: {
                type: "integer"
            },
            includeDepositors: {
                type: "boolean"
            }
        },
        additionalProperties: false,
        required: ["app", "title", "groups", "start", "end"]
    },
    ok: [
        {
            app: 1,
            title: "abc",
            groups: [
                {
                    title: "abc",
                    values: {
                        a: 1
                    },
                    percent: 0.2
                }
            ],
            start: 100,
            end: 2000000,
            includeDepositors: true
        }
    ]
});