# -*- coding: utf-8 -*-


# -*- coding: utf-8 -*-
##############################################################################
#
#    ODOO Open Source Management Solution
#
#    ODOO Addon module by Uncanny Consulting Services LLP
#    Copyright (C) 2023 Uncanny Consulting Services LLP (<https://uncannycs.com>).
#
##############################################################################
{
    "name": "List View Column Filter Ucs",
    "summary": (
        "Search and filter records by individual columns in list views. "
        "Adds an inline filter row below each column header."
    ),
    "version": "18.0.1.0.0",
    "category": "Extra Tools",
    'author': 'Uncanny Consulting Services LLP',
    'website': 'https://uncannycs.com',
    "license": "Other proprietary",
    "depends": ["sale_management",'web'],
    "installable": True,
    "auto_install": False,
    "application": False,
    "assets": {
        "web.assets_backend": [
            "list_column_filter_ucs/static/src/list_renderer/list_renderer.js",
            "list_column_filter_ucs/static/src/list_renderer/list_renderer.xml",
            "list_column_filter_ucs/static/src/list_renderer/list_renderer.css",
        ],
    },
}
