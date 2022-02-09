import { get_path, compile_paths } from './descendant-path.mjs';

// We can remove the asyncronous sha-1 hash with a 17-character random string that's only generated once.
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

export default function create_template(strings) {
	const paths = [];
	// Create a template element with the markers:
	let order = 0;
	let template_contents = strings[0];
	for (let i = 1; i < strings.length; ++i) {
		template_contents += `${marker_base}-${order++}`;
		template_contents += strings[i];
	}
	const template = document.createElement('template');
	template.innerHTML = template_contents;

	// Convert the markers within that template element:
	let root = template.content;
	root.normalize();
	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
	);
	for (let next_node = walker.nextNode(); next_node; next_node = walker.nextNode()) {
		const node = walker.currentNode;
		if (node.nodeType == Node.ELEMENT_NODE) {
			for (const attribute_name of node.getAttributeNames()) {
				const [_before, i, _after] = find_marker(attribute_name);
				if (i != -1) {
					paths[i] = get_path(node, template.content);
					node.removeAttribute(attribute_name);
				}
			}
		} else if (node.nodeType == Node.TEXT_NODE) {
			const [before, i, after] = find_marker(node.data);
			if (i != -1) {
				if (node.parentNode.nodeName == 'STYLE') {
					throw new Error("Node parts aren't allowed within style tags because during parsing comment nodes are not permitted content of style tags.  This would mean that the template could not be precompiled.");
				}
				const placeholder = new Comment();
				if (after != '') {
					node.after(after);
				}
				next_node = walker.nextNode();
				if (before != '') {
					node.replaceWith(before, placeholder);
				} else {
					node.replaceWith(placeholder);
				}

				// Get the content:
				paths[i] = get_path(placeholder, template.content);

				continue;
			}
		}
	}

	return {
		template,
		part_getter: compile_paths(paths)
	};
}