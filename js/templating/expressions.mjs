// Event Handling
export function on(event, handler, options = {}) {
	return node => {
		if (!node?.addEventListener) throw new Error("on only works on EventTargets");
		node.addEventListener(event, handler, options);
	};
}

export function text(func) {
	return node => {
		if (!(node instanceof Comment)) throw new Error("text only works in a node position");
		const text = new Text();
		node.replaceWith(text);
		func(text);
	}
}