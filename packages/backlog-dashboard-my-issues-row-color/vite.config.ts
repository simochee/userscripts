import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const name = "backlog-dashboard-my-issues-row-color";
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
			server: { mountGmApi: true },
			userscript: {
				name: "ダッシュボードの「自分の課題」の行に色をつける",
				namespace: "https://github.com/simochee/userscripts",
				description:
					"ダッシュボードの「自分の課題」の各行を状態に合わせた色にします",
				version: "2026.07.02",
				icon: "https://www.google.com/s2/favicons?sz=64&domain=backlog.jp",
				match: [
					"https://*.backlog.com/*",
					"https://*.backlog.jp/*",
					"https://*.backlogtool.com/*",
				],
				grant: ["GM_addStyle"],
				downloadURL,
				updateURL: downloadURL,
			},
		}),
	],
	build: { minify: false },
});
