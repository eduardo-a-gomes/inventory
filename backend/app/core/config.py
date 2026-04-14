"""Configuracoes centrais da aplicacao."""

import os
from pathlib import Path


# Pasta raiz do projeto.
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Caminho da base de dados SQLite.
SQLITE_DB_PATH = Path(os.getenv("SQLITE_DB_PATH", PROJECT_ROOT / "inventario.db")).resolve()

# Caminho opcional para migração inicial a partir do Excel antigo.
LEGACY_EXCEL_PATH = Path(os.getenv("LEGACY_EXCEL_PATH", PROJECT_ROOT / "Base_dados.xlsx")).resolve()

# Nome da folha usada na migração do Excel antigo.
LEGACY_EXCEL_SHEET_NAME = os.getenv("LEGACY_EXCEL_SHEET_NAME", "Sheet1")
