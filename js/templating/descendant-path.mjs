export function get_path(target, root, attribute_name = false) {
	const path = attribute_name ? [attribute_name] : [];
	while (target !== root) {
		const parent = target.parentNode;
		path.unshift(Array.prototype.indexOf.call(parent.childNodes, target));
		target = parent;
	}
	return path;
}

export function coalesce_paths(paths) {
	// TODO: Coalesce the paths together
	return paths;
}

export function* descend_paths(paths, root) {
	paths_loop: for (const path of paths) {
		let target = root;
		for (const item of path) {
			if (typeof item == 'string') {
				yield target.getAttributeNode(item);
				continue paths_loop;
			} else if (item[Symbol.iterator]) {
				yield* descend_paths(item, target);
				continue paths_loop;
			} else if (typeof item == 'number') {
				target = target.childNodes[item];
			}
		}
		yield target;
	}
}