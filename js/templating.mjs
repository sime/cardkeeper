import create_template from './create-template.mjs';

const template_cache = new WeakMap();

// Function to clone a template / replace the main content
const main = document.querySelector('main');
export function mount(contents) {
	// Remove old contents:
	while (main.firstChild) {
		main.firstChild.remove();
	}
	main.appendChild(contents);
}

export function save() {
	const ret = new DocumentFragment();
	while (main.firstChild) {
		ret.appendChild(main.firstChild);
	}
	return ret;
}

export function html(strings, ...expressions) {
	let template = template_cache.get(strings);
	if (!template) {
		template = create_template(strings);
		template_cache.set(strings, template);
	}
	const { template: template_el, part_getter } = template;

	const instance = document.importNode(template_el.content, true);
	const parts = part_getter(instance);
	for (let i = 0; i < parts.length; ++i) {
		apply_expression(parts[i], expressions[i]);
	}
	return instance;
}

export function on(type, listener, options = {}) {
	return function on_handler(el) {
		el.addEventListener(type, listener, options);
	};
}

// This file is where all the special casing is.  If you want to add special cases, you can change this file.
class SpecialCaseError extends Error {
	constructor() {
		super("This expression doesn't work for this location.  Perhaps you should add a special case for it.");
	}
}
function apply_expression(part, expression) {
	const type = typeof expression;
	if (expression === undefined || expression === null) {
		// Do Nothing.
	} else if (type == 'function') {
		apply_expression(part, expression(part));
	} else if (part instanceof Comment && (
		type == 'bigint' ||
		type == 'number' ||
		type == 'string' ||
		expression instanceof Node
	)) {
		part.replaceWith(expression);
	} else if (type == 'object' && expression[Symbol.iterator]) {
		if (part instanceof Comment) {
			for (const expr of expression) {
				const t = new Comment();
				part.parentNode.insertBefore(t, part);
				apply_expression(t, expr);
			}
			part.remove();
		} else {
			for (const expr of expression) {
				apply_expression(part, expr);
			}
		}
	} else {
		throw new SpecialCaseError();
	}
}