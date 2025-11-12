
 "use strict";

class Producer {
	constructor(opts) {
		this.id = opts.id;
		this.name = opts.name;
		this.baseCost = opts.baseCost;
		this.cps = opts.cps; // cookies per second per unit
		this.count = 0;
	}
	get cost() {
		return Math.floor(this.baseCost * Math.pow(1.15, this.count));
	}
}

class Upgrade {
	constructor(opts) {
		this.id = opts.id;
		this.name = opts.name;
		this.description = opts.description;
		this.baseCost = opts.baseCost;
		this.type = opts.type; // "click_add" | "producer_mult" | "global_cps_mult"
		this.value = opts.value; // number (add or multiplier)
		this.target = opts.target || null; // producer id for producer_mult, else null
		this.level = 0;
	}
	get cost() {
		return Math.floor(this.baseCost * Math.pow(1.6, this.level));
	}
}

class Game {
	constructor() {
		this.cookies = 0;
		this.baseClick = 1;
		this.totalCookies = 0;
		this.theme = "classic";
		this.unlocks = [];
		this.unlockDefinitions = [
			{
				id: "unlock_starter",
				name: "Startende Bakker",
				description: "Bak in totaal 100 koekjes.",
				condition: (game) => game.totalCookies >= 100
			},
			{
				id: "unlock_click_master",
				name: "Klik Meester",
				description: "Bereik minstens +10 per klik.",
				condition: (game) => game.clickValue >= 10
			},
			{
				id: "unlock_producer_guru",
				name: "Productie Guru",
				description: "Bezit 25 automatische producers.",
				condition: (game) => game.totalProducerCount >= 25
			},
			{
				id: "unlock_theme_midnight",
				name: "Nachtploeg",
				description: "Bak in totaal 1.000 koekjes om het Midnight-thema te ontgrendelen.",
				condition: (game) => game.totalCookies >= 1000
			},
			{
				id: "unlock_theme_forest",
				name: "Boswachter",
				description: "Bezit 5 boerderijen om het Forest-thema te ontgrendelen.",
				condition: (game) => {
					const farm = game.producers.find((p) => p.id === "p3");
					return farm && farm.count >= 5;
				}
			}
		];

		this.producers = [
			new Producer({ id: "p1", name: "Pointer", baseCost: 15, cps: 0.1 }),
			new Producer({ id: "p2", name: "Grandmother", baseCost: 100, cps: 1 }),
			new Producer({ id: "p3", name: "Farm", baseCost: 1100, cps: 8 }),
			new Producer({ id: "p4", name: "Mine", baseCost: 12000, cps: 47 }),
			new Producer({ id: "p5", name: "Factory", baseCost: 130000, cps: 260 }),
			new Producer({ id: "p6", name: "Bank", baseCost: 1400000, cps: 1400 }),
			new Producer({ id: "p7", name: "Temple", baseCost: 20000000, cps: 7800 }),
			new Producer({ id: "p8", name: "Wizard Tower", baseCost: 330000000, cps: 44000 })
		];

		this.upgrades = [
			new Upgrade({ id: "u_click_1", name: "Stronger Click", description: "+1 per click", baseCost: 15, type: "click_add", value: 1 }),
			new Upgrade({ id: "u_click_2", name: "Iron Finger", description: "+3 per click", baseCost: 75, type: "click_add", value: 3 }),
			new Upgrade({ id: "u_p1_2x", name: "Fast Pointers", description: "Pointers produce 2x", baseCost: 200, type: "producer_mult", value: 2, target: "p1" }),
			new Upgrade({ id: "u_p2_2x", name: "Grandma Recipes", description: "Grandmothers produce 2x", baseCost: 1000, type: "producer_mult", value: 2, target: "p2" }),
			new Upgrade({ id: "u_global_1_2x", name: "Optimized Workflow", description: "Total CPS +20%", baseCost: 10000, type: "global_cps_mult", value: 1.2 })
		];

		this.lastTick = performance.now();
		this.timer = null;
	}

	get clickValue() {
		const add = this.upgrades.reduce((sum, u) => {
			if (u.type === "click_add") return sum + u.level * u.value;
			return sum;
		}, 0);
		return this.baseClick + add;
	}

	getProducerMultiplier(producerId) {
		return this.upgrades.reduce((mult, u) => {
			if (u.type === "producer_mult" && u.target === producerId) {
				return mult * Math.pow(u.value, u.level);
			}
			return mult;
		}, 1);
	}

	get globalCpsMultiplier() {
		return this.upgrades.reduce((mult, u) => {
			if (u.type === "global_cps_mult") {
				return mult * Math.pow(u.value, u.level);
			}
			return mult;
		}, 1);
	}

	get cps() {
		const base = this.producers.reduce((sum, p) => {
			const eff = p.cps * this.getProducerMultiplier(p.id);
			return sum + eff * p.count;
		}, 0);
		return base * this.globalCpsMultiplier;
	}

	get totalProducerCount() {
		return this.producers.reduce((sum, p) => sum + p.count, 0);
	}

	click() {
		this.cookies += this.clickValue;
		this.totalCookies += this.clickValue;
		this.checkUnlocks();
	}

	canAfford(amount) {
		return this.cookies >= amount;
	}

	buyProducer(id) {
		const p = this.producers.find(x => x.id === id);
		if (!p) return false;
		const cost = p.cost;
		if (!this.canAfford(cost)) return false;
		this.cookies -= cost;
		p.count += 1;
		this.checkUnlocks();
		return true;
	}

	buyUpgrade(id) {
		const u = this.upgrades.find(x => x.id === id);
		if (!u) return false;
		const cost = u.cost;
		if (!this.canAfford(cost)) return false;
		this.cookies -= cost;
		u.level += 1;
		this.checkUnlocks();
		return true;
	}

	update(deltaSeconds) {
		const gained = this.cps * deltaSeconds;
		this.cookies += gained;
		this.totalCookies += gained;
		this.checkUnlocks();
	}

	start(onTick) {
		if (this.timer) return;
		this.lastTick = performance.now();
		this.timer = setInterval(() => {
			const now = performance.now();
			const delta = (now - this.lastTick) / 1000;
			this.lastTick = now;
			this.update(delta);
			if (typeof onTick === "function") onTick();
		}, 100);
	}

	stop() {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}

	serialize() {
		return {
			cookies: this.cookies,
			totalCookies: this.totalCookies,
			theme: this.theme,
			unlocks: this.unlocks,
			producers: this.producers.map(p => ({ id: p.id, count: p.count })),
			upgrades: this.upgrades.map(u => ({ id: u.id, level: u.level }))
		};
	}

	load(state) {
		if (!state) return;
		this.cookies = Number(state.cookies) || 0;
		this.totalCookies = Number(state.totalCookies) || this.cookies;
		for (const sp of state.producers || []) {
			const p = this.producers.find(x => x.id === sp.id);
			if (p) p.count = Number(sp.count) || 0;
		}
		for (const su of state.upgrades || []) {
			const u = this.upgrades.find(x => x.id === su.id);
			if (u) u.level = Number(su.level) || 0;
		}
		if (Array.isArray(state.unlocks)) {
			this.unlocks = Array.from(new Set(state.unlocks));
		}
		if (state.theme && ThemeManager.getTheme(state.theme)) {
			this.theme = state.theme;
		}
		this.checkUnlocks();
		if (!this.isThemeUnlocked(this.theme)) {
			this.theme = "classic";
		}
	}

	isThemeUnlocked(themeId) {
		const theme = ThemeManager.getTheme(themeId);
		if (!theme) return false;
		return !theme.unlockId || this.unlocks.includes(theme.unlockId);
	}

	setTheme(themeId) {
		if (!this.isThemeUnlocked(themeId)) return false;
		this.theme = themeId;
		return true;
	}

	checkUnlocks() {
		let changed = false;
		for (const unlock of this.unlockDefinitions) {
			if (!this.unlocks.includes(unlock.id) && unlock.condition(this)) {
				this.unlocks.push(unlock.id);
				changed = true;
			}
		}
		return changed;
	}
}

class GameStorage {
	constructor(key) {
		this.key = key || "cookieclicker_state_v1";
	}
	save(game) {
		try {
			localStorage.setItem(this.key, JSON.stringify(game.serialize()));
			return true;
		} catch (e) {
			console.error(e);
			return false;
		}
	}
	load() {
		try {
			const raw = localStorage.getItem(this.key);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			console.error(e);
			return null;
		}
	}
}

class ThemeManager {
	constructor(root) {
		this.root = root || document.documentElement;
	}

	static list() {
		return ThemeManager.THEMES;
	}

	static getTheme(id) {
		return ThemeManager.THEMES.find((theme) => theme.id === id) || null;
	}

	apply(themeId) {
		const theme = ThemeManager.getTheme(themeId) || ThemeManager.THEMES[0];
		if (!theme) return;
		for (const [key, value] of Object.entries(theme.vars)) {
			this.root.style.setProperty(key, value);
		}
	}
}

ThemeManager.THEMES = [
	{
		id: "classic",
		name: "Classic",
		vars: {
			"--bg": "#fef3c7",
			"--text": "#1f2937",
			"--muted": "#475569",
			"--panel": "rgba(255,255,255,0.9)",
			"--accent": "#0ea5e9",
			"--accent-hover": "#0284c7"
		}
	},
	{
		id: "midnight",
		name: "Midnight",
		unlockId: "unlock_theme_midnight",
		vars: {
			"--bg": "#0f172a",
			"--text": "#e2e8f0",
			"--muted": "#94a3b8",
			"--panel": "rgba(15, 23, 42, 0.85)",
			"--accent": "#38bdf8",
			"--accent-hover": "#0ea5e9"
		}
	},
	{
		id: "forest",
		name: "Forest",
		unlockId: "unlock_theme_forest",
		vars: {
			"--bg": "#0f3d31",
			"--text": "#ecfdf5",
			"--muted": "#a7f3d0",
			"--panel": "rgba(6, 78, 59, 0.8)",
			"--accent": "#34d399",
			"--accent-hover": "#10b981"
		}
	}
];

class GameUI {
	constructor(game, storage, themeManager) {
		this.game = game;
		this.storage = storage;
		this.themeManager = themeManager;
		this.$counter = document.getElementById("cookies");
		this.$stats = document.getElementById("stats");
		this.$cookieBtn = document.getElementById("cookieButton");
		this.$upgradeList = document.getElementById("upgradeList");
		this.$producerList = document.getElementById("producerList");
		this.$themeSelect = document.getElementById("themeSelect");
		this.$unlockList = document.getElementById("unlockList");
		this.bind();
		this.renderLists();
		this.render();
	}
	bind() {
		this.$cookieBtn.addEventListener("click", () => {
			this.game.click();
			this.render();
		});
		this.$upgradeList.addEventListener("click", (e) => {
			const btn = e.target.closest(".buy-upgrade");
			if (!btn) return;
			if (this.game.buyUpgrade(btn.getAttribute("data-id"))) {
				this.renderLists();
				this.render();
				this.storage.save(this.game);
			}
		});
		this.$producerList.addEventListener("click", (e) => {
			const btn = e.target.closest(".buy-producer");
			if (!btn) return;
			if (this.game.buyProducer(btn.getAttribute("data-id"))) {
				this.renderLists();
				this.render();
				this.storage.save(this.game);
			}
		});
		this.$themeSelect.addEventListener("change", () => {
			const value = this.$themeSelect.value;
			if (this.game.setTheme(value)) {
				this.themeManager.apply(value);
				this.renderThemeOptions();
				this.storage.save(this.game);
			} else {
				this.renderThemeOptions();
			}
		});
	}
	renderLists() {
		// Upgrades
		this.$upgradeList.innerHTML = "";
		for (const u of this.game.upgrades) {
			const card = document.createElement("div");
			card.className = "card";
			card.innerHTML = `
				<div>
					<h3>${u.name} <span class="small">(Lv. ${u.level})</span></h3>
					<p>${u.description}</p>
					<p class="small">Cost: ${Format.number(u.cost)}</p>
				</div>
				<div>
					<button class="btn buy-upgrade" data-id="${u.id}">Buy</button>
				</div>
			`;
			this.$upgradeList.appendChild(card);
		}
		// Producers
		this.$producerList.innerHTML = "";
		for (const p of this.game.producers) {
			const card = document.createElement("div");
			card.className = "card";
			card.innerHTML = `
				<div>
					<h3>${p.name} <span class="small">(x${p.count})</span></h3>
					<p>${p.cps} /s each</p>
					<p class="small">Cost: ${Format.number(p.cost)}</p>
				</div>
				<div>
					<button class="btn buy-producer" data-id="${p.id}">Buy</button>
				</div>
			`;
			this.$producerList.appendChild(card);
		}
	}
	render() {
		this.$counter.textContent = Format.number(this.game.cookies);
		this.$stats.textContent = `+${Format.number(this.game.clickValue)}/klik • ${Format.number(this.game.cps)}/s`;
		for (const btn of document.querySelectorAll(".buy-upgrade")) {
			const id = btn.getAttribute("data-id");
			const u = this.game.upgrades.find(x => x.id === id);
			btn.disabled = !this.game.canAfford(u.cost);
		}
		for (const btn of document.querySelectorAll(".buy-producer")) {
			const id = btn.getAttribute("data-id");
			const p = this.game.producers.find(x => x.id === id);
			btn.disabled = !this.game.canAfford(p.cost);
		}
		this.renderThemeOptions();
		this.renderUnlocks();
	}
	renderThemeOptions() {
		this.$themeSelect.innerHTML = "";
		for (const theme of ThemeManager.list()) {
			const option = document.createElement("option");
			const unlocked = !theme.unlockId || this.game.unlocks.includes(theme.unlockId);
			option.value = theme.id;
			option.textContent = unlocked ? theme.name : `${theme.name} (vergrendeld)`;
			option.disabled = !unlocked;
			if (theme.id === this.game.theme) {
				option.selected = true;
			}
			this.$themeSelect.appendChild(option);
		}
	}
	renderUnlocks() {
		this.$unlockList.innerHTML = "";
		if (!this.game.unlocks.length) {
			const li = document.createElement("li");
			li.className = "unlock-card small";
			li.textContent = "Nog geen ontgrendelingen. Blijf bakken!";
			this.$unlockList.appendChild(li);
			return;
		}
		for (const unlockId of this.game.unlocks) {
			const def = this.game.unlockDefinitions.find((u) => u.id === unlockId);
			if (!def) continue;
			const li = document.createElement("li");
			li.className = "unlock-card";
			li.innerHTML = `${def.name}<span>${def.description}</span>`;
			this.$unlockList.appendChild(li);
		}
	}
}

class Format {
	static number(n) {
		if (n < 1000) return n.toFixed(0);
		if (n < 1_000_000) return (n / 1000).toFixed(2) + "k";
		if (n < 1_000_000_000) return (n / 1_000_000).toFixed(2) + "M";
		return (n / 1_000_000_000).toFixed(2) + "B";
	}
}

class App {
	constructor() {
		this.game = new Game();
		this.storage = new GameStorage("cookieclicker_state_v1");
		this.themeManager = new ThemeManager(document.documentElement);
		const saved = this.storage.load();
		if (saved) this.game.load(saved);
		this.themeManager.apply(this.game.theme);
		this.ui = new GameUI(this.game, this.storage, this.themeManager);
		this.game.start(() => this.ui.render());
		this.autosaveHandle = setInterval(() => this.storage.save(this.game), 15000);
	}
}

window.addEventListener("DOMContentLoaded", () => { new App(); });
