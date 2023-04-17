// GM backport functions
export function ord(str: string) {
	return str.charCodeAt(0);
}
export function push<T>(arr: T[], element: any[]): T[] {
	return void arr.push(element as any) ?? arr;
}
export function del<T>(arr: T[], i): T[] {
	return void arr.splice(i) ?? arr;
}
export function string_ord_at(str: string, pos: number) {
	const char = str.charAt(pos);
	if (!char) return -1;
	return char.charCodeAt(0);
}
export function int(n: number | string): number {
	return Math.floor(typeof n == "string" ? parseInt(n) : n);
}

export function getPurifiedEnumKeys(en) {
  return Object.keys(en).filter(v => Number.isNaN(parseInt(v)))
}

export function txr_throw(reason, pos) {
	throw new Error(`${reason} at position ${pos}`);
}

export function txr_throw_at(error, token) {
	if (token[0] == txr_token.eof) {
		return txr_throw(error, "<EOF>");
	} else return txr_throw(error, token[1]);
}

export let txr_build_tmp_val = {
	txr_build_list: [],
	txr_build_node: [] as any[],
	txr_build_pos: 0,
	txr_build_len: 0,
	nodes: [] as any[],
	ops: [] as any[]
};

const tmp = new Proxy(txr_build_tmp_val, {});

// parser: start
enum txr_token {
	eof, // <EOF>
	op , // + - * / % div
	par_open, // (
	par_close, // )
	number, // 37
	ident // some
}
enum txr_op {
	mul = 0x01, // *
	fdiv = 0x02, // /
	fmod = 0x03, // %
	idiv = 0x04, // div
	add = 0x10, // +
	sub = 0x11, // -
	maxp = 0x20 // maximum priority
}

type ParseResult = ParsedNode[];
type ParsedNode = [token: txr_token, index: number, oper?: txr_op];

export function txr_parse(scr: string): ParseResult {
	let str = scr;
	let len = str.length;
	let out: ParseResult = [];
	let pos = 0;
	while (pos < len) {
		let start = pos;
		let char = string_ord_at(str, pos++);
		switch (char) {
			case ord(" "):
			case ord("\t"):
			case ord("\r"):
			case ord("\n"):
				break;
			case ord("("):
				push(out, [txr_token.par_open, start]);
				break;
			case ord(")"):
				push(out, [txr_token.par_close, start]);
				break;
			case ord("+"):
				push(out, [txr_token.op, start, txr_op.add]);
				break;
			case ord("-"):
				push(out, [txr_token.op, start, txr_op.sub]);
				break;
			case ord("*"):
				push(out, [txr_token.op, start, txr_op.mul]);
				break;
			case ord("/"):
				push(out, [txr_token.op, start, txr_op.fdiv]);
				break;
			case ord("%"):
				push(out, [txr_token.op, start, txr_op.fmod]);
				break;
			default:
				if (char >= ord("0") && char <= ord("9")) {
					while (pos <= len) {
						char = string_ord_at(str, pos);
						if (char >= ord("0") && char <= ord("9")) {
							pos += 1;
						} else break;
					}
					let val = int(str.slice(start, pos));
					push(out, [txr_token.number, start, val]);
				} else if (
					char == ord("_") ||
					(char >= ord("a") && char <= ord("z")) ||
					(char >= ord("A") && char <= ord("Z"))
				) {
					while (pos <= len) {
						char = string_ord_at(str, pos);
						if (
							char == ord("_") ||
							(char >= ord("0") && char <= ord("9")) ||
							(char >= ord("a") && char <= ord("z")) ||
							(char >= ord("A") && char <= ord("Z"))
						) {
							pos += 1;
						} else break;
					}
					let name = str.slice(start, pos - start);
					switch (name) {
						case "mod":
							push(out, [txr_token.op, start, txr_op.fmod]);
							break;
						case "div":
							push(out, [txr_token.op, start, txr_op.idiv]);
							break;
						case "xi":
							push(out, [txr_token.number, start, 11]);
							break;
						default:
							push(out, [txr_token.ident, start, name]);
							break;
					}
				} else txr_throw("Unexpected character `" + char + "`", start);
		}
	}
	return out;
}

// parser: end

enum txr_node {
	number = 1, // (number)
	ident = 2, // (name)
	unop = 3, // (unop, node)
	binop = 4 // (binop, a, b)
}
enum txr_unop {
	negate = 1 // -value
}
enum txr_build_flag {
	no_ops = 1
}

function txr_build(tokens) {
	tmp.txr_build_list = tokens;
	tmp.txr_build_node = [] as any[];
	tmp.txr_build_pos = 0;
	tmp.txr_build_len = tokens.length;
	tmp.nodes = [];
	tmp.ops = [];
	if (txr_build_expr(0)) return true;
	if (tmp.txr_build_pos < tmp.txr_build_len - 1) {
		return txr_throw_at("Trailing data", tokens[tmp.txr_build_pos]);
	} else return false;
}

function txr_build_expr(flags) {
	var tk: ParsedNode = tmp.txr_build_list[tmp.txr_build_pos++];
	switch (tk[0]) {
		case txr_token.number:
			tmp.txr_build_node = [txr_node.number, tk[1], tk[2]];
			break;
		case txr_token.ident:
			tmp.txr_build_node = [txr_node.ident, tk[1], tk[2]];
			break;
		case txr_token.par_open: // (value)
			if (txr_build_expr(0)) return true;
			tk = tmp.txr_build_list[tmp.txr_build_pos++];
			if (tk[0] != txr_token.par_close)
				return txr_throw_at("Expected a `)`", tk);
			break;
		case txr_token.op: // -value, +value
			switch (tk[2]) {
				case txr_op.add:
					if (txr_build_expr(txr_build_flag.no_ops)) return true;
					break;
				case txr_op.sub:
					if (txr_build_expr(txr_build_flag.no_ops)) return true;
					tmp.txr_build_node = [
						txr_node.unop,
						tk[1],
						txr_unop.negate,
						tmp.txr_build_node
					];
					break;
				default:
					return txr_throw_at("Unexpected token", tk);
			}
			break;
		default:
			return txr_throw_at("Unexpected token", tk);
	}
	if ((flags & txr_build_flag.no_ops) == 0) {
		tk = tmp.txr_build_list[tmp.txr_build_pos];
		if (tk[0] == txr_token.op) {
			tmp.txr_build_pos++;
			if (txr_build_ops(tk)) return true;
		}
	}
	return false;
}

function txr_build_ops(first) {
	var nodes = tmp.nodes = [tmp.txr_build_node];
	var ops = tmp.ops = [first];
	var tk: ParsedNode & {2: txr_op};
	while (1) {
		if (txr_build_expr(txr_build_flag.no_ops)) {
			return true;
		}
    
		push(nodes, tmp.txr_build_node);
		//
		tk = tmp.txr_build_list[tmp.txr_build_pos] || tmp.txr_build_list[tmp.txr_build_pos-1];
		if (tk[0] == txr_token.op) {
			tmp.txr_build_pos++;
			push(ops, tk);
		} else break;
	}
	console.log("REVS", ops, nodes)

	var n = ops.length;
	var pmax = txr_op.maxp >> 4;
	var pri = 0;
	while (pri < pmax) {
		for (var i = 0; i < n; i++) {
			tk = ops[i] || [];
			console.log("tk[2] and pri:", tk[2], pri, i)
			if (tk[2] >> 4 != pri) continue;
			nodes[i] = [txr_node.binop, tk[1], tk[2], nodes[i], nodes[i + 1]];
			console.log(nodes[i])
			del(nodes, i + 1);
			del(ops, i);
			n -= 1;
			i -= 1;
		}
		pri += 1;
	}
}

let tkn: ParseResult;
txr_build(tkn = txr_parse("1 + 2 - 3"));

// console.log(toReadable(tkn))
// console.log(tmp.nodes, tmp.ops);