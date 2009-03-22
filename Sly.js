/**
 * Sly - The JavaScript Selector Engine
 *
 * Cutting-edge JavaScript helper for parsing CSS3 selectors to find
 * and match DOM nodes. A framework independent drop-in solution.
 *
 * Credits: Origin was a branch from MooTools 1.2-pre, Feb 2008
 * Combinator and pseudo sets are based on MooTools <http://mootools.net>.
 *
 * @version: preview
 *
 * @author: Harald Kirschner <http://digitarald.de>
 * @copyright: Authors
 *
 * @license: MIT-style license.
 */

var Sly = (function() {

var cache = {};

/**
 * Sly::constructor
 */
var Sly = function(text) {

	// if (text instanceof Array) text = text.join(','); // vote for it

	text = (typeof(text) == 'string') ? text.replace(/^\s+/, '') : '';

	return cache[text] || (cache[text] = new Sly.initialize(text));
}

Sly.initialize = function(text) {
	this.text = text;
};

Sly.initialize.prototype = Sly.prototype;


/**
 * Sly.implement
 */
Sly.implement = function(key, properties, recompile) {
	console.log(key);
	for (var prop in properties) Sly[key][prop] = properties[prop];
};


/**
 * Sly.features
 */
Sly.features = {
	querySelector: !!(document.querySelectorAll),
	elementsByClass: !!(document.getElementsByClassName)
};


var locateFast = function() {
	return true;
};

/**
 * Sly::search
 */
Sly.prototype.search = function(context, limit) {
	context = context || document;

	// if (limit) limit = (limit > 1) ? limit : 1; // VOTE for it

	if (Sly.features.querySelector && context.nodeType == 9) {
		try {
			return Sly.toArray(context.querySelectorAll(text));
		} catch(e) {}
	}

	var parsed = this.parse();

	var results, // overall result
		combined, // found nodes from one iteration process
		nodes, // context nodes from one iteration process
		current, // unique ids for one iteration process
		all = {}, // unique ids for overall result
		state = {}; // matchers temporary state
		;

	// unifiers
	var getUid = Sly.getUid;
	var locateCurrent = function(node){
		var uid = getUid(node);
		return (current[uid]) ? null : (current[uid] = true);
	};

	for (var i = 0, selector; (selector = parsed[i]); i++) {

		var locate = locateCurrent;

		if (selector.first) {
			if (!results) locate = locateFast;
			if (selector.combinator) nodes = [context]; // allows combinators before selectors
		}

		if (selector.last && results) {
			current = all;
			combined = results;
		} else { // default stack
			current = {};
			combined = [];
		}

		if (!selector.combinator) {
			// without prepended combinator
			combined = selector.combine(combined, context, state, locate, !(combined.length));
		} else {
			// with prepended combinators
			for (var k = 0, l = nodes.length; k < l; k++) combined = selector.combine(combined, nodes[k], state, locate);
		}
		if (selector.last) {
			results = combined;
			// if (limit && results.length >= limit) break;
		} else {
			nodes = combined;
		}
	}

	// if (limit) return (limit > 1) ? results.slice(0, limit) : results[0];

	return results || [];
};


/**
 * Sly::find
 */
Sly.prototype.find = function(context) {
	return this.search(context, 1);
};


/**
 * Sly::match
 */
Sly.prototype.match = function(node) {
	return !!(this.parse()[0].match(node, {}));
};


/**
 * Sly::filter
 */
Sly.prototype.filter = function(nodes) {
	var results = [], match = this.parse()[0].match;
	for (var i = 0, node; (node = nodes[i]); i++) {
		if (match[node]) results.push(node);
	}
	return results;
};


/**
 * Sly.recompile()
 */
var pattern;

Sly.recompile = function() {

	// ,+>~
	var combList = [','];
	for (var key in combinators) {
		if (key != ' ') {
			combList[(key.length > 1) ? 'unshift' : 'push'](Sly.escapeRegExp(key));
		}
	}

	// !*^$~|\\/
	var operList = ['!'];
	for (var key in operators) operList.push(key);

	/**
	  The regexp is a group of every possible selector part including combinators.
	  "|" separates the possible selectors.

		Capturing parentheses (several groups don't need them):
		1 - Combinator (only needed to match multiple-char combinators)
		2 - Attribute name
		3 - Attribute operator
		4, 5, 6 - The value
		7 - Pseudo name
		8, 9, 10 - The value
	 */

	pattern = new RegExp(
		// A tagname, "*" is not matched because it is not a tagname that we would need
		'[\\w\\u00c0-\\uFFFF][\\w\\u00c0-\\uFFFF-]*|' +
		// An id or the classname
		'[#.][\\w\\u00c0-\\uFFFF-]+|' +
		// Whitespace (descendant combinator)
		'[ \\t\\r\\n\\f](?=[\\w\\u00c0-\\uFFFF*#.[:])|' +
		// Other combinators and the comma
		'(' + combList.join('|') + ')[ \\t\\r\\n\\f]*|' +
		// An attribute, with the various and optional value formats ([name], [name=value], [name="value"], [name='value']
		'\\[([\\w\\u00c0-\\uFFFF-]+)(?:([' + operList.join('') + ']?=)(?:"([^"]*)"|\'([^\']*)\'|([^\\]]*)))?]|' +
		// A pseudo-class, with various formats
		':([-\\w\\u00c0-\\uFFFF]+)(?:\\((?:"([^"]*)"|\'([^\']*)\'|([^)]*))\\))?|' +
		// The universial selector, usually ignored
		'\\*', 'g'
	);
};


/**
 * Sly::parse
 *
 * Returns an array with one object for every selector:
 *
 * {
 *   tag: (String) Tagname (defaults to null for universal *)
 *   id: (String) Id
 *   classes: (Array) Classnames
 *   attributes: (Array) Attribute objects with "name", "operator" and "value"
 *   pseudos: (Array) Pseudo objects with "name" and "value"
 *   operator: (Char) The prepended operator (not comma)
 *   first: (Boolean) true if it is the first selector or the first after a comma
 *   last: (Boolean) true if it is the last selector or the last before a comma
 *   ident: (Array) All parsed matches, can be used as cache identifier.
 * }
 */

// I prefer it outside, not sure if this is faster
var create = function(combinator) {
	return {
		ident: [],
		classes: [],
		attributes: [],
		pseudos: [],
		combinator: combinator
	};
};

var blank = function($0) {
	return $0;
};

Sly.prototype.parse = function(plain) {
	var save = (plain) ? 'plain' : 'parsed';
	if (this[save]) return this[save];

	var text = this.text;
	var compute = (plain) ? blank : this.compute;

	var parsed = [], current = create(null);
	current.first = true;

	var refresh = function(combinator) {
		parsed.push(compute(current));
		current = create(combinator);
	};

	var match, $0;

	while ((match = pattern.exec(text))) {
		$0 = match[0];

		switch ($0.charAt(0)) {
			case '.':
				current.classes.push($0.slice(1));
				break;
			case '#':
				current.id = $0.slice(1);
				break;
			case '[':
				current.attributes.push({
					name: match[2],
					operator: match[3] || null,
					value: match[4] || match[5] || match[6] || null
				});
				break;
			case ':':
				current.pseudos.push({
					name: match[7],
					value: match[8] || match[9] || match[10] || null
				});
				break;
			case ',':
				current.last = true;
				refresh(null);
				current.first = true;
				continue;
			case ' ': case '\t': case '\r': case '\n': case '\f':
				match[1] = ' ';
			default:
				var combinator = match[1];
				if (combinator) {
					if (current.first && !current.ident.length) current.combinator = combinator;
					else refresh(combinator);
				} else {
					if ($0 != '*') current.tag = $0;
				}
		}
		current.ident.push($0);
	}

	current.last = true;
	parsed.push(compute(current));

	return (this[save] = parsed);
};


// chains two given functions

function chain(prepend, append, aux, unshift) {
	var fn = (prepend) ? ((unshift) ? function(node, state) {
		return append(node, aux, state) && prepend(node, state);
	} : function(node, state) {
		return prepend(node, state) && append(node, aux, state);
	}) : function(node, state) {
		return append(node, aux, state);
	};
	fn.$slyIndex = (prepend) ? (prepend.$slyIndex + 1) : 0;
	return fn;
};

var comperators = {

	empty: function() {
		return true;
	},

	matchId: function(node, id) {
		return (node.id == id);
	},

	matchTag: function(node, tag) {
		return (node.nodeName == tag);
	},

	prepareClass: function(name) {
		return (new RegExp('(?:^|[ \\t\\r\\n\\f])' + name + '(?:$|[ \\t\\r\\n\\f])'));
	},

	matchClass: function(node, expr) {
		return node.className && expr.test(node.className);
	},

	prepareAttribute: function(attr) {
		if (!attr.operator || !attr.value) return attr;
		var parser = operators[attr.operator];
		if (parser) { // @todo: Allow functions, not only regex
			attr.escaped = Sly.escapeRegExp(attr.value);
			attr.pattern = new RegExp(parser(attr.value, attr.escaped, attr));
		}
		return attr;
	},

	matchAttribute: function(node, attr) {
		var read = Sly.getAttribute(node, attr.name);
		switch (attr.operator) {
			case null: return read;
			case '=': return (read == attr.value);
			case '!=': return (read != attr.value);
		}

		if (!read && attr.value) return false;
		return attr.pattern.test(read);
	}

};


/**
 * Sly::compute
 *
 * Attaches the following methods to the selector object:
 *
 * {
 *   search: Uses the most convinient properties (id, tag and/or class) of the selector as search.
 *   matchAux: If search does not contain all selector properties, this method matches an element against the rest.
 *   match: Matches an element against all properties.
 *   simple: Set when matchAux is not needed.
 *   combine: The callback for the combinator
 * }
 */
Sly.prototype.compute = function(selector) {

	var i, item, match, search, matchSearch, tagged,
		tag = selector.tag,
		id = selector.id,
		classes = selector.classes;

	var nodeName = (tag) ? tag.toUpperCase() : null;

	if (id) {
		tagged = true;

		matchSearch = chain(matchSearch, comperators.matchId, id);

		search = function(context) {
			if (context.getElementById) {
				var el = context.getElementById(id);
				return (el && (!nodeName || el.nodeName == nodeName)) ? [el] : [];
			}

			var query = context.getElementsByTagName(tag || '*');
			for (var j = 0, node; (node = query[j]); j++) {
				if (node.id == id) return [node];
			}
			return [];
		};
	}

	if (classes.length > 0) {
		if (!search && Sly.features.elementsByClass) {

			for (i = 0; (item = classes[i]); i++) {
				matchSearch = chain(matchSearch, comperators.matchClass, comperators.prepareClass(item));
			}

			var joined = classes.join(' ');
			search = function(context) {
				return context.getElementsByClassName(joined);
			};

		} else if (!search && classes.length == 1) { // optimised for typical .one-class-only

			tagged = true;

			var expr = comperators.prepareClass(classes[0]);
			matchSearch = chain(matchSearch, comperators.matchClass, expr);

			search = function(context) {
				var query = context.getElementsByTagName(tag || '*');
				var found = [];
				for (var i = 0, node; (node = query[i]); i++) {
					if (node.className && expr.test(node.className)) found.push(node);
				}
				return found;
			};

		} else {

			for (i = 0; (item = classes[i]); i++) {
				match = chain(match, comperators.matchClass, comperators.prepareClass(item));
			}

		}
	}

	if (tag) {

		if (!search) {
			matchSearch = chain(matchSearch, comperators.matchTag, nodeName);

			search = function(context) {
				return context.getElementsByTagName(tag);
			};
		} else if (!tagged) { // search does not filter by tag yet
			match = chain(match, comperators.matchTag, nodeName);
		}

	} else if (!search) { // default engine

		search = function(context) {
			return context.getElementsByTagName('*');
		};

	}

	for (i = 0; (item = selector.pseudos[i]); i++) {

		if (item.name == 'not') { // optimised :not(), so it is fast and useful
			var not = Sly(item.value); // TODO: validate
			match = chain(match, function(node, state) {
				return !not.match(node);
			}, {});
		} else {
			var parser = pseudos[item.name];
			match = (parser) ? chain(match, parser, item.value) : chain(match, comperators.matchAttribute, comperators.prepareAttribute(item))
		}

	}

	for (i = 0; (item = selector.attributes[i]); i++) {
		match = chain(match, comperators.matchAttribute, comperators.prepareAttribute(item));
	}

	if ((selector.simple = !(match))) {
		selector.matchAux = comperators.empty;
	} else {
		selector.matchAux = match;
		matchSearch = chain(matchSearch, match);
	}

	selector.match = matchSearch || comperators.empty;

	selector.combine = Sly.combinators[selector.combinator || ' '];

	selector.search = search;

	return selector;
};


/**
 * Combinators
 */
var combinators = Sly.combinators = {

	' ': function(combined, context, state, locate, fast) {
		var nodes = this.search(context);
		if (fast && this.simple) return Sly.toArray(nodes);
		for (var i = 0, node; (node = nodes[i]); i++) {
			if (locate(node) && this.matchAux(node, state)) combined.push(node);
		}
		return combined;
	},

	'>': function(combined, context, state, locate) {
		var nodes = this.search(context);
		for (var i = 0, node; (node = nodes[i]); i++) {
			if (node.parentNode == context && locate(node) && this.matchAux(node, state)) combined.push(node);
		}
		return combined;
	},

	'+': function(combined, context, state, locate) {
		while ((context = context.nextSibling)) {
			if (context.nodeType == 1) {
				if (locate(context) && this.match(context, state)) combined.push(context);
				break;
			}

		}
		return combined;
	},

	'~': function(combined, context, state, locate) {
		while ((context = context.nextSibling)) {
			if (context.nodeType == 1) {
				if (!locate(context)) break;
				if (this.match(context, state)) combined.push(context);
			}
		}
		return combined;
	}

};


/**
 * Pseudo-Classes
 */
var pseudos = Sly.pseudos = {

	// w3c pseudo classes

	'first-child': function(node) {
		return pseudos.index(node, 0);
	},

	'last-child': function(node) {
		while ((node = node.nextSibling)) {
			if (node.nodeType === 1) return false;
		}
		return true;
	},

	'only-child': function(node) {
		var prev = node;
		while ((prev = prev.previousSibling)) {
			if (prev.nodeType === 1) return false;
		}
		var next = node;
		while ((next = next.nextSibling)) {
			if (next.nodeType === 1) return false;
		}
		return true;
	},

	'nth-child': function(node, value, state) {
		var parsed = Sly.parseNth(value || 'n');
		if (parsed.special != 'n') return pseudos[parsed.special](node, parsed.a, state);
		state.positions = state.positions || {};
		var uid = Sly.getUid(node) ;
		if (!state.positions[uid]) {
			var count = 0;
			while ((node = node.previousSibling)) {
				if (node.nodeType != 1) continue;
				count++;
				var position = state.positions[Sly.getUid(node)];
				if (position != undefined) {
					count = position + count;
					break;
				}
			}
			state.positions[uid] = count;
		}
		return (state.positions[uid] % parsed.a == parsed.b);
	},

	'empty': function(node) {
		return !(node.innerText || node.textContent || '').length;
	},

	'contains': function(node, text) {
		return (node.innerText || node.textContent || '').indexOf(text) != -1;
	},

	'index': function(node, index) {
		var count = 0;
		while ((node = node.previousSibling)) {
			if (node.nodeType == 1 && ++count > index) return false;
		}
		return (count == index);
	},

	'even': function(node, value, state) {
		return pseudos['nth-child'](node, '2n', state);
	},

	'odd': function(node, value, state) {
		return pseudos['nth-child'](node, '2n+1', state);
	}

};


/**
 * Attribute operators
 */
var operators = Sly.operators = {

	'*=': function(value, escaped) {
		return escaped;
	},

	'^=': function(value, escaped) {
		return '^' + escaped;
	},

	'$=': function(value, escaped) {
		return value + '$';
	},

	'~=': function(value, escaped) {
		return '(?:^|[ \\t\\r\\n\\f])' + escaped + '(?:$|[ \\t\\r\\n\\f])';
	},

	'|=': function(value, escaped) {
		return '(?:^|\\|)' + escaped + '(?:$|\\|)';
	}

};


// public, overridable

Sly.getAttribute = function(node, name) {
	if (name == 'class') return node.className;
	return node.getAttribute(name, 2);
};


var toArray = function(nodes) {
	return Array.prototype.slice.call(nodes);
};

try {
	toArray(document.documentElement.childNodes);
} catch (e) {
	toArray = function(nodes) {
		if (nodes instanceof Array) return nodes;
		var i = nodes.length, results = new Array(i);
		while (i--)
			results[i] = nodes[i];
		return results;
	};
}

Sly.toArray = toArray;


var nextUid = 1;

Sly.getUid = (window.ActiveXObject) ? function(node){
	return (node.$slyUid || (node.$slyUid = {id: nextUid++})).id;
} : function(node){
	return node.$slyUid || (node.$slyUid = nextUid++);
};


var nthCache = {};

Sly.parseNth = function(value) {
	if (nthCache[value]) return nthCache[value];
	var parsed = value.match(/^([+-]?\d*)?([a-z]+)?([+-]?\d*)?$/);
	if (!parsed) return false;
	var a = parseInt(parsed[1]), b = (parsed(parsed[3]) || 0) - 1;
	a = (isNaN(a)) ? a : 1;
	while (b < 1) b += a;
	while (b >= a) b -= a;
	switch (parsed[2]) {
		case 'n': parsed = {a: a, b: b, special: 'n'}; break;
		case 'odd': parsed = {a: 2, b: 0, special: 'n'}; break;
		case 'even': parsed = {a: 2, b: 1, special: 'n'}; break;
		case 'first': parsed = {a: 0, special: 'index'}; break;
		case 'last': parsed = {special: 'last-child'}; break;
		case 'only': parsed = {special: 'only-child'}; break;
		default: parsed = {a: (a - 1), special: 'index'};
	}
	return (nthCache[value] = parsed);
};


Sly.escapeRegExp = function(text) {
	return text.replace(/[-.*+?^${}()|[\]\/\\]/g, '\\$&');
};


// generic accessors

Sly.generise = function(name) {
	Sly[name] = function(text) {
		var cls = Sly(text);
		return cls[name].apply(cls, Array.prototype.slice.call(arguments, 1));
	}
};

var generics = ['parse', 'search', 'find', 'match', 'filter'];
for (var i = 0; generics[i]; i++) Sly.generise(generics[i]);


Sly.recompile();

// FIN

return Sly;

})();



// public methods
/*
if (window.MooTools && window.Native) {

	Native.implement([Document, Element], {

		getElements: function(selectors, nocash) {
			new Elements(Sly.search(selectors, this), {ddup: false, cash: !nocash});
		}

	});

	Element.implement({

		match: function(selector) {
			return Sly.match(this, selector);
		}

	});
}
*/