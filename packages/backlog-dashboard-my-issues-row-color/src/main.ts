import { watch } from "shared";
import "./style.css";

// Smoke wiring: proves `shared`'s watch() resolves and bundles here. The
// selector is intentionally inert (this script colors rows purely via CSS in
// style.css), so this registers an observer that never fires onAdd.
watch(".dummy-never-matches", (el) => {
	console.log("appeared", el);
	return () => console.log("removed", el);
});

console.log("ready.");
