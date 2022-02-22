import create_template from './create-template.mjs';
import get_or_set from '../lib/get-or-set.mjs';
import { apply_expression } from './apply-expression.mjs';
import { descend_paths } from './descendant-path.mjs';

// Cache: strings -> template element
const template_cache = new WeakMap();

export function make_html(apply_e = apply_expression) {
	return function html(strings, ...expressions) {
		// Get the template element:
		const { template, paths } = get_or_set(template_cache, strings, () => create_template(strings));

		// Instantiate our template:
		const fragment = document.importNode(template.content, true);

		// Apply our expressions:
		const parts = [...descend_paths(paths, fragment)];
		if (expressions.length !== parts.length) {
			throw new Error("A different Number of expressions from parts was found while instantiating: This usually means an html syntax error in the template literal, but can also mean a problem caused by permitted content.");
		}
		for (let i = 0; i < expressions.length; ++i) {
			apply_e(expressions[i], parts[i]);
		}
		return fragment;
	}
}

export default make_html();
