export function get_path(target, root) {
	const path = [];
	while (target !== root) {
		const parent = target.parentNode;
		path.unshift(Array.prototype.indexOf.call(parent.childNodes, target));
		target = parent;
	}
	return path;
}

export function compile_paths(paths) {
	// TODO: Join common prefixes into variables

	const body = `return [${paths.map(path => 
		`root${path.map(index => `.childNodes[${index}]`).join('')}`
	).join(', ')}];`;
	return new Function('root', body);
}
