import { watch } from "@userscripts/shared";
import "./style.css";

(() => {
  const OPTIONS = [
    ["resolve", "処理済み"],
    ["open", "未対応"],
  ];

  watch("#issueListMenu", (el) => {
    el.insertAdjacentHTML(
      "beforeend",
      `
      <dl class="filter-nav">
        <dt class="filter-nav__term">行除外</dt>
        ${OPTIONS.map(
          ([status, name]) => `
          <dd class="filter-nav__item">
            <input
              type="checkbox"
              name="row_filter"
              id="row_filter_${status}"
              value="${status}"
              ${localStorage.getItem("dashboard_row_filter:${status}") === "true" ? "checked" : ""}
              onchange="localStorage.setItem('dashboard_row_filter:${status}', this.checked.toString())"
            >
            <label for="row_filter_${status}" class="filter-nav__link">
              <span class="filter-nav__text">${name}</span>
            </label>
          </dd>
          `,
        ).join("")}
      </dl>
      `,
    );
  });
})();
