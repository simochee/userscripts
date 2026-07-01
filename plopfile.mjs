/**
 * Plop generator for scaffolding a new userscript package under packages/.
 * Run via `nr new`.
 *
 * @param {import('plop').NodePlopAPI} plop
 */
export default function (plop) {
	// Today's date as YYYY.MM.DD, used as the initial userscript @version.
	plop.setHelper("version", () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}.${month}.${day}`;
	});

	plop.setGenerator("userscript", {
		description: "Create a new userscript package",
		prompts: [
			{
				type: "input",
				name: "name",
				message: "Package name (kebab-case):",
				validate: (value) =>
					/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ||
					"Use lowercase kebab-case (e.g. my-script)",
			},
			{
				type: "input",
				name: "title",
				message: "Userscript display name:",
			},
			{
				type: "input",
				name: "description",
				message: "Description:",
			},
			{
				type: "input",
				name: "namespace",
				message: "Namespace:",
				default: "https://github.com/simochee/userscripts",
			},
			{
				type: "input",
				name: "match",
				message: "Match patterns (comma-separated):",
				filter: (value) =>
					value
						.split(",")
						.map((entry) => entry.trim())
						.filter(Boolean),
			},
			{
				type: "checkbox",
				name: "grant",
				message: "GM grants:",
				choices: [
					"GM_addStyle",
					"GM_setValue",
					"GM_getValue",
					"GM_deleteValue",
					"GM_xmlhttpRequest",
					"GM_openInTab",
					"GM_registerMenuCommand",
				],
			},
		],
		actions: [
			{
				type: "addMany",
				destination: "packages/{{name}}",
				base: "plop-templates/userscript",
				templateFiles: "plop-templates/userscript/**/*.hbs",
			},
			() => "Package created. Run `ni` to install dependencies.",
		],
	});
}
