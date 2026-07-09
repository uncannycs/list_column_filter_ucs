/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { SearchModel } from "@web/search/search_model";
import { onMounted, onPatched, useState } from "@odoo/owl";

const TYPE_KIND = {
    char: "text", text: "text", html: "text",
    integer: "number", float: "number", monetary: "number",
    date: "date", datetime: "date",
    selection: "selection",
    many2one: "many2one", many2many: "many2many",
};

function makeDomain(filters, fields) {
    const clauses = [];
    for (const [fieldName, value] of Object.entries(filters)) {
        if (!value && value !== 0) continue;
        const field = fields[fieldName];
        if (!field) continue;
        const kind = TYPE_KIND[field.type];
        if (!kind) continue;

        if (fieldName === "status_in_payment") {
            if (value === "draft") {
                clauses.push(["state", "=", "draft"]);
            } else if (value === "cancel") {
                clauses.push(["state", "=", "cancel"]);
            } else {
                clauses.push(["state", "=", "posted"], ["payment_state", "=", value]);
            }
        } else if (kind === "many2one" || kind === "many2many") {
            clauses.push([fieldName + ".name", "ilike", value]);
        } else if (kind === "text" || kind === "number") {
            clauses.push([fieldName, "ilike", value]);
        } else if (kind === "date") {
            clauses.push([fieldName, ">=", value], [fieldName, "<=", value]);
        } else if (kind === "selection") {
            clauses.push([fieldName, "=", value]);
        }
    }
    if (!clauses.length) return null;
    return [...Array(clauses.length - 1).fill("&"), ...clauses];
}

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        if (!this.env.searchModel) return;

        if (!this.env.searchModel._colFilterState) {
            this.env.searchModel._colFilterState = {};
        }
        this.colFilterState = useState(this.env.searchModel._colFilterState);

        onMounted(() => this._injectFilterRow());
        onPatched(() => this._injectFilterRow());
    },

    _injectFilterRow() {
        if (!this.tableRef?.el || !this.colFilterState) return;

        const thead = this.tableRef.el.querySelector("thead");
        if (!thead) return;

        const focused = thead.querySelector(".o_col_filter_input:focus");
        const focusedField = focused ? focused.dataset.field : null;

        if (focused && focused.type === "date") return;

        thead.querySelectorAll(".o_col_filter_row, .o_col_filter_clear_row")
            .forEach((el) => el.remove());

        const headerRow = thead.querySelector("tr");
        if (!headerRow) return;

        const columns = this.columns || [];
        const fields = (this.props.list && this.props.list.fields) || {};
        if (!columns.length) return;

        const filterRow = document.createElement("tr");
        filterRow.className = "o_col_filter_row";

        if (this.hasSelectors) {
            filterRow.appendChild(this._spacerTh());
        }

        let anyFilterable = false;

        for (const col of columns) {
            const th = document.createElement("th");
            th.className = "o_col_filter_cell";

            if (col.type === "field" && col.name && fields[col.name]) {
                const kind = TYPE_KIND[fields[col.name].type];

                const SKIP_WIDGETS = new Set([
                    "activity_exception", "stock_rescheduling_popover",
                    "list_activity", "kanban_activity",
                    "boolean_toggle", "properties", "forecast_widget",
                    "web_ribbon", "activity_exception",
                ]);
                const widgetName = col.widget;
                const skipWidget = widgetName && SKIP_WIDGETS.has(widgetName);

                if (kind && !skipWidget) {
                    anyFilterable = true;
                    th.appendChild(
                        this._buildWidget(col.name, kind, fields[col.name], col.label || col.name)
                    );
                }
            }
            filterRow.appendChild(th);
        }

        if (this.hasActionsColumn) filterRow.appendChild(this._spacerTh());
        if (this.hasOpenFormViewColumn) filterRow.appendChild(this._spacerTh());

        if (!anyFilterable) return;

        headerRow.after(filterRow);

        if (focusedField) {
            const el = filterRow.querySelector(`[data-field="${focusedField}"]`);
            if (el) {
                el.focus();
                if (el.type === "text") {
                    el.setSelectionRange(el.value.length, el.value.length);
                }
            }
        }

        if (Object.values(this.colFilterState).some((v) => v)) {
            const clearRow = document.createElement("tr");
            clearRow.className = "o_col_filter_clear_row";
            const th = document.createElement("th");
            th.colSpan = filterRow.children.length;
            th.className = "o_col_filter_clear_cell text-end";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "o_col_filter_clear_btn btn btn-link btn-sm p-0";
            btn.innerHTML = '<i class="fa fa-times-circle me-1"></i>Clear all filters';
            btn.addEventListener("click", () => this._clearAllFilters());
            th.appendChild(btn);
            clearRow.appendChild(th);
            filterRow.after(clearRow);
        }
    },

    _spacerTh() {
        const th = document.createElement("th");
        th.className = "o_col_filter_cell o_col_filter_spacer";
        return th;
    },

    _buildWidget(fieldName, kind, field, placeholder) {
        const value = this.colFilterState[fieldName] || "";

        if (kind === "selection") {
            const sel = document.createElement("select");
            sel.className = "o_col_filter_input o_col_filter_select";
            sel.dataset.field = fieldName;
            const blank = document.createElement("option");
            blank.value = "";
            blank.textContent = "All";
            sel.appendChild(blank);
            for (const [v, label] of field.selection || []) {
                const opt = document.createElement("option");
                opt.value = String(v);
                opt.textContent = label;
                if (String(v) === value) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.addEventListener("change", (ev) => {
                ev.stopPropagation();
                this._onFilterChange(fieldName, ev.target.value);
            });
            return sel;
        }

        const input = document.createElement("input");
        input.className = "o_col_filter_input";
        input.dataset.field = fieldName;
        input.placeholder = placeholder || "";
        input.value = value;
        input.type = kind === "date" ? "date" : "text";

        if (kind === "date") {
            input.addEventListener("input", (ev) => {
                ev.stopPropagation();
                const v = ev.target.value;
                if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    this._onFilterChange(fieldName, v);
                } else if (!v) {
                    this._onFilterChange(fieldName, "");
                }
            });
            input.addEventListener("change", (ev) => {
                ev.stopPropagation();
                this._onFilterChange(fieldName, ev.target.value);
            });
        } else {
            input.addEventListener("input", (ev) => {
                ev.stopPropagation();
                this._onFilterChange(fieldName, ev.target.value);
            });
        }
        input.addEventListener("click", (ev) => ev.stopPropagation());
        return input;
    },

    _onFilterChange(fieldName, value) {
        if (!this.env.searchModel) return;
        this.colFilterState[fieldName] = value;
        this._applyFilters();
    },

    _clearAllFilters() {
        if (!this.env.searchModel) return;
        for (const k of Object.keys(this.colFilterState)) this.colFilterState[k] = "";
        this.env.searchModel._colFilterDomain = null;
        this.env.searchModel._notify();
    },

    _applyFilters() {
        const fields = (this.props.list && this.props.list.fields) || {};
        this.env.searchModel._colFilterDomain = makeDomain(this.colFilterState, fields);
        this.env.searchModel._notify();
    },
});

patch(SearchModel.prototype, {
    _getDomain(params = {}) {
        const base = super._getDomain(...arguments);
        if (this._colFilterDomain && this._colFilterDomain.length) {
            return [...base, ...this._colFilterDomain];
        }
        return base;
    },
});
