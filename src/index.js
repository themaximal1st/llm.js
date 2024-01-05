import debug from "debug";
const log = debug("llm.js");

import SchemaConverter from "../lib/jsonschema-to-gbnf.js";
import LlamaFile from "./llamafile.js";

export default function LLM(input, options = {}) {

    // function call
    if (!(this instanceof LLM)) {
        return new Promise(async (resolve, reject) => {
            const llm = new LLM(input, options);
            try {
                resolve(await llm.send());
            } catch (e) {
                reject(e);
            }
        });
    }

    // object call
    if (typeof input === "string" && input.length > 0) {
        this.messages = [{ role: "user", content: input }];
    } else if (Array.isArray(input)) {
        this.messages = input;
    } else {
        this.messages = [];
    }

    this.options = options;
}

LLM.prototype.send = async function (opts = {}) {
    const options = Object.assign({}, this.options, opts);

    // if llamafile
    if (options.schema) {
        options.schema = LLM.convertJSONSchemaToBNFS(options.schema);
    }

    const response = await LlamaFile(this.messages, options);

    if (options.stream) {
        return this.stream_response(response);
    }

    this.assistant(response);
    return response;
}

LLM.prototype.stream_response = async function* (response) {
    let buffer = "";
    for await (const chunk of response) {
        buffer += chunk;
        yield chunk;
    }

    this.assistant(buffer);
}

LLM.prototype.chat = async function (content, options = null) {
    this.user(content);
    return await this.send(options);
}

LLM.prototype.user = function (content) {
    this.history("user", content);
}

LLM.prototype.system = function (content) {
    this.history("system", content);
}

LLM.prototype.assistant = function (content) {
    this.history("assistant", content);
}

LLM.prototype.history = function (role, content) {
    if (!content) throw new Error("No content provided");
    if (typeof content !== "string") { content = JSON.stringify(content) }
    this.messages.push({ role, content });
}

LLM.convertJSONSchemaToBNFS = function (schema) {
    const converter = new SchemaConverter();
    converter.visit(schema, "");
    return converter.formatGrammar();
}