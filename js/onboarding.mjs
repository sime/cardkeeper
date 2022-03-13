import {mount, html, on} from './templating/index.mjs';

export default function onboarding() {
	return new Promise(resolve => {
		let container_el, perm_warn_el, desktop_container;
		mount(html`
	<div id="onboard-container" ${e => {container_el = e}}>
		<section>
			<img width="314" height="272" src="/assets/onboard1.svg" alt="">
			<h1>Card Keeper</h1>
			<p>Keep all your membership cards in one place. You can store your:</p>
			<ul>
				<li>
					<img width="30" height="30" src="/assets/coffee-icon.svg">
					Local Coffee Shop Card
				</li>
				<li>
					<img width="30" height="30" src="/assets/gym-icon.svg">
					Gym Card
				</li>
				<li>
					<img width="30" height="30" src="/assets/library-icon.svg">
					Library Card
				</li>
				<li>
					<img width="30" height="30" src="/assets/grocery-icon.svg">
					Supermarket Reward Card
				</li>
			</ul>
		</section>
		<section>
			<img width="314" height="272" src="/assets/onboard2.svg" alt="">
			<h1>Safe and Secure</h1>
			<p>Protects your privacy at the same time, so you feel more secured</p>
			<ul>
				<li>
					<img width="30" height="30" src="/assets/offline-icon.svg">
					Works Offline
				</li>
				<li>
					<img width="30" height="30" src="/assets/device-icon.svg">
					All data stored in your device
				</li>
			</ul>
		</section>
	</div>
	<div class="desktop-images" ${e => {desktop_container = e}}>
		<img width="562" height="445" src="/assets/onboard1.svg" alt="">
		<img width="562" height="445" src="/assets/onboard2.svg" alt="" style="opacity: 0">
	</div>
	<div class="doohicky" ${doohicky_el => {
		const sec_map = new WeakMap();
		const desk_map = new WeakMap();
		const observer = new IntersectionObserver(entries => {
			for (const {target, isIntersecting} of entries) {
				const dh_el = sec_map.get(target);
				const desk_img = desk_map.get(target);
				if (isIntersecting) {
					dh_el.classList.add('active');
					desk_img.style.opacity = 1;
				} else {
					dh_el.classList.remove('active');
					desk_img.style.opacity = 0;
				}
			}
		}, { root: container_el, threshold: 0.5 });
		for (let i = 0; i < container_el.children.length; ++i) {
			const section = container_el.children[i];
			const desktop_image = desktop_container.children[i];
			const dh_el = document.createElement('div');
			sec_map.set(section, dh_el);
			desk_map.set(section, desktop_image);
			doohicky_el.appendChild(dh_el);
			observer.observe(section);
		}
	}}></div>
	<button ${btn => {
		let next = true;
		new IntersectionObserver(entries => {
			for (const entry of entries) {
				// console.log(entry);
				if (entry.isIntersecting) {
					btn.firstChild.data = "Scan My Card";
					perm_warn_el.style.visibility = "visible";
				} else {
					btn.firstChild.data = "Next";
					perm_warn_el.style.visibility = "";
				}
				next = !entry.isIntersecting;
			}
		}, { root: container_el, threshold: 0.4 }).observe(container_el.lastElementChild);
		on('click', () => {
			if (next) {
				container_el.scrollLeft += container_el.clientWidth;
			} else {
				resolve();
			}
		})(btn);
	}}>
		Next
		<img width="28" height="28" src="/assets/button-arrow.svg">
	</button>
	<p class="perm-warning" ${e => {perm_warn_el = e}}>
		<img width="16" height="16" src="/assets/camera.svg">
		This will require camera access
	</p>`, 'onboarding');
	});
}