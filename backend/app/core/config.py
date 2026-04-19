"""Configuracoes centrais da aplicacao."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


APP_FOLDER_NAME = "InventarioOficina"
IS_FROZEN = getattr(sys, "frozen", False)

# Pasta raiz do projeto quando estamos a correr em desenvolvimento.
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Pasta onde o PyInstaller extrai os recursos quando a app corre empacotada.
BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", PROJECT_ROOT)).resolve()


def _default_app_data_dir() -> Path:
    """Devolve a pasta onde os dados persistentes devem ficar guardados."""
    if not IS_FROZEN:
        return PROJECT_ROOT

    local_app_data = Path(os.getenv("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
    return local_app_data / APP_FOLDER_NAME


APP_DATA_DIR = Path(os.getenv("INVENTARIO_APP_DATA_DIR", str(_default_app_data_dir()))).expanduser().resolve()
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Pasta do frontend compilado, usada na versao executavel e nos smoke tests locais.
FRONTEND_DIST_DIR = ((BUNDLE_ROOT / "frontend_dist") if IS_FROZEN else (PROJECT_ROOT / "frontend" / "dist")).resolve()


def _resolve_sqlite_db_path() -> Path:
    """Resolve o caminho da base de dados e copia a seed na primeira execucao empacotada."""
    env_path = os.getenv("SQLITE_DB_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    if not IS_FROZEN:
        return (PROJECT_ROOT / "inventario.db").resolve()

    target = (APP_DATA_DIR / "inventario.db").resolve()
    if target.exists():
        return target

    bundled_seed = (BUNDLE_ROOT / "inventario.db").resolve()
    if bundled_seed.exists():
        shutil.copy2(bundled_seed, target)

    return target


def _resolve_legacy_excel_path() -> Path:
    """Resolve o caminho do Excel legacy, dando prioridade a um ficheiro externo ao executavel."""
    env_path = os.getenv("LEGACY_EXCEL_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    app_copy = (APP_DATA_DIR / "Base_dados.xlsx").resolve()
    bundled_copy = (BUNDLE_ROOT / "Base_dados.xlsx").resolve()

    if app_copy.exists():
        return app_copy
    if bundled_copy.exists():
        return bundled_copy
    if not IS_FROZEN:
        return (PROJECT_ROOT / "Base_dados.xlsx").resolve()
    return app_copy


# Caminho da base de dados SQLite.
SQLITE_DB_PATH = _resolve_sqlite_db_path()

# Caminho opcional para migracao inicial a partir do Excel antigo.
LEGACY_EXCEL_PATH = _resolve_legacy_excel_path()

# Nome da folha usada na migracao do Excel antigo.
LEGACY_EXCEL_SHEET_NAME = os.getenv("LEGACY_EXCEL_SHEET_NAME", "Sheet1")
