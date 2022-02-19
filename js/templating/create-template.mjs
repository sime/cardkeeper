import { coalesce_paths, get_path } from './descendant-path.mjs';

// It's important for the marker to start with a character (an 'a' in this case) so that it is a valid attribute name.
const marker_base = crypto.getRandomValues(new Uint8Array(8)).reduce((str, n) => str + n.toString(16).padStart(2, '0'), 'a');

const marker_finder = new RegExp(`${marker_base}-([0-9]+)`);
function find_marker(string) {
	const exec = marker_finder.exec(string);
	if (exec) {
		const [full_match, order] = exec;
		const before = string.slice(0, exec.index);
		const after = string.slice(exec.index + full_match.length);
		return [before, Number.parseInt(order), after];
	} else {
		return [string, -1, ''];
	}
}

function* traverse_tree(root) {
	yield root;
	if (root.getAttributeNames) {
		for (const name of root.getAttributeNames()) {
			yield root.getAttributeNode(name);
		}
	}
	for (let i = 0; i < root.childNodes.length; ++i) {
		yield* traverse_tree(root.childNodes[i]);
	}
}
function concat_strings(strings) {
	let ret = strings[0];
	for (let i = 1; i < strings.length; ++i) {
		ret += `${marker_base}-${i - 1}`;
		ret += strings[i];
	}
	return ret;
}

export default function create_template(strings) {
	const template = document.createElement('template');
	template.innerHTML = concat_strings(strings);

	// Convert the markers within that template element:
	let paths = [];
	const root = template.content;
	root.normalize();
	for (const node of traverse_tree(root)) {
		if (node instanceof Attr) {
			const [before, i, after] = find_marker(node.localName);
			if (i != -1) {
				if (before !== '' || after !== '') throw new Error("Found an attribute that somewhat conflicted with the marker!");
				paths[i] = get_path(node.ownerElement, root);
				node.ownerElement.removeAttributeNode(node);
			}
			const [b2, i2, a2] = find_marker(node.value);
			if (i2 != -1) {
				if (b2 !== '' || a2 !== '') throw new Error("Attribute value parts are only permitted if they are the entirety of the attribute's value.");
				if (i != -1) throw new Error("You can't have an attribute value part as a value of an attribute part.");
				paths[i2] = get_path(node.ownerElement, root, node.name);
				node.value = '';
			}
		} else if (node instanceof Text) {
			const [before, i, after] = find_marker(node.data);
			if (i != -1) {
				if (node.parentNode.nodeName == 'STYLE') {
					throw new Error("Node parts aren't allowed within style tags because during parsing comment nodes are not permitted content of style tags.  This would mean that the template could not be precompiled.");
				}
				// TODO: Add more permitted content checks: table, etc.
				const placeholder = new Comment();
				node.replaceWith(...([before, placeholder, after].filter(v => v !== '')));

				// Get the content:
				paths[i] = get_path(placeholder, root);
			}

		}
	}

	paths = coalesce_paths(paths);

	return { template, paths };
}