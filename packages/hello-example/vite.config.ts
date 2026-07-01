import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const name = "hello-example";
// In CI these come from the workflow (GITHUB_REPOSITORY is injected by GitHub,
// DIST_BRANCH by release.yml). Locally they fall back to the defaults below.
const { GITHUB_REPOSITORY = "simochee/userscripts", DIST_BRANCH = "dist" } =
	process.env;
const downloadURL = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${DIST_BRANCH}/${name}.user.js`;

export default defineConfig({
	plugins: [
		monkey({
			entry: "src/main.ts",
			build: { fileName: `${name}.user.js` },
			userscript: {
				name: "Hello Example",
				namespace: "https://github.com/simochee/userscripts",
				description: "Example userscript demonstrating the build setup.",
				version: "1.0.0",
				match: ["https://example.com/*"],
				grant: [],
				downloadURL,
				updateURL: downloadURL,
			},
		}),
	],
});
