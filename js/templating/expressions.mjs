// Event Handling
export function on(event, handler, options = {}) {
	return (node, signal) => {
		if (!node?.addEventListener) throw new Error("on only works on EventTargets");
		node.addEventListener(event, handler, { signal, ...options });
	};
}